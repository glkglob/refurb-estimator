import { z } from "zod";
import { aiClient } from "@/lib/ai/client";
import { parseJson } from "@/lib/ai/utils";
import { getRequestId, jsonError, jsonSuccess, logError } from "@/lib/api-route";
import {
  AssistantRequestSchema,
  type AssistantAction,
  type ChatAssistantResponse,
  type EstimateEditorResponse,
  type ProjectCopilotResponse
} from "@/lib/assistant/schemas";
import {
  buildAssistantPrompt,
  getResponseSchema,
  getSystemPrompt,
  sanitizeAssistantActionsWithReport
} from "@/lib/assistant/runtime";
import { validateJsonRequest } from "@/lib/validate";

const ASSISTANT_MODEL =
  process.env.AI_PROVIDER === "lmstudio"
    ? process.env.LM_STUDIO_MODEL ?? "qwen/qwen3-4b"
    : "gpt-4o-mini";

const EMPTY_EDITOR_ACTION: EstimateEditorResponse["actions"][number] = {
  type: "none",
  reason: "No supported action could be safely applied."
};

function normalizeEditor(
  response: EstimateEditorResponse,
  mode: "rooms" | "new_build" | "development"
) {
  const sanitized = sanitizeAssistantActionsWithReport(mode, response.actions, {
    enforceRecalculate: true
  });

  let actions = sanitized.actions;

  if (actions.length === 0) {
    actions = [EMPTY_EDITOR_ACTION];
  }

  return {
    ...response,
    actions
  };
}

function normalizeChat(
  response:
    | ChatAssistantResponse
    | {
      reply: string;
      actions?: AssistantAction[];
      suggestions?: string[];
      suggestedActions?: AssistantAction[];
      nextSteps?: string[];
    },
  mode: "rooms" | "new_build" | "development"
) {
  const legacySuggestedActions =
    "suggestedActions" in response ? response.suggestedActions : undefined;
  const actions = response.actions ?? legacySuggestedActions ?? [];
  const sanitized = sanitizeAssistantActionsWithReport(mode, actions, {
    enforceRecalculate: false
  });

  const legacyNextSteps = "nextSteps" in response ? response.nextSteps : undefined;

  return {
    ...response,
    suggestions: response.suggestions ?? legacyNextSteps,
    actions: sanitized.actions
  };
}

function normalizeCopilot(
  response: ProjectCopilotResponse,
  mode: "rooms" | "new_build" | "development"
) {
  const actions = response.suggestedActions ?? [];
  const sanitized = sanitizeAssistantActionsWithReport(mode, actions, {
    enforceRecalculate: true
  });

  return {
    ...response,
    suggestedActions: sanitized.actions,
    actions: sanitized.actions
  };
}

function getRawActions(payload: unknown): AssistantAction[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const data = payload as { actions?: unknown; suggestedActions?: unknown };

  if (Array.isArray(data.actions)) {
    return data.actions as AssistantAction[];
  }

  if (Array.isArray(data.suggestedActions)) {
    return data.suggestedActions as AssistantAction[];
  }

  return [];
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const parsed = await validateJsonRequest(request, AssistantRequestSchema, {
      errorMessage: "Invalid assistant payload"
    });
    if (!parsed.success) return parsed.response;

    const assistantRequest = parsed.data;

    const prompt = buildAssistantPrompt({
      systemPrompt: getSystemPrompt(assistantRequest.agent),
      mode: assistantRequest.mode,
      message: assistantRequest.message,
      estimateInput: assistantRequest.estimateInput,
      estimateResult: assistantRequest.estimateResult,
      projectContext: assistantRequest.projectContext
    });

    const aiResponse = await aiClient.chat.completions.create({
      model: ASSISTANT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      ...(process.env.AI_PROVIDER === "lmstudio"
        ? {}
        : { response_format: { type: "json_object" as const } })
    });

    const rawText = aiResponse.choices[0]?.message?.content ?? "";
    if (!rawText) {
      return jsonError("Empty assistant response", requestId, 502);
    }

    const json = parseJson(rawText) as unknown;

    const rawActions = getRawActions(json);
    const hasActions = rawActions.length > 0;

    if (assistantRequest.agent === "editor" || hasActions) {
      const reply =
        typeof json === "object" && json !== null && "reply" in json &&
          typeof (json as { reply?: unknown }).reply === "string"
          ? (json as { reply: string }).reply
          : "Applied the requested estimate edits.";

      const normalized = normalizeEditor(
        {
          reply,
          actions: rawActions
        },
        assistantRequest.mode
      );

      const normalizedActions = normalized.actions ?? [];

      if (assistantRequest.agent === "copilot") {
        return jsonSuccess(
          {
            ...normalized,
            actions: normalizedActions,
            suggestedActions: normalizedActions
          },
          requestId
        );
      }

      return jsonSuccess(
        {
          ...normalized,
          actions: normalizedActions
        },
        requestId
      );
    }

    let response:
      | ReturnType<typeof normalizeChat>
      | ReturnType<typeof normalizeEditor>
      | ReturnType<typeof normalizeCopilot>;

    const schema = getResponseSchema(assistantRequest.agent);
    const parsedResponse = schema.parse(json);

    if (assistantRequest.agent === "chat") {
      response = normalizeChat(parsedResponse, assistantRequest.mode);
    } else if (assistantRequest.agent === "copilot") {
      response = normalizeCopilot(parsedResponse as ProjectCopilotResponse, assistantRequest.mode);
    } else {
      const editorResponse: EstimateEditorResponse =
        typeof parsedResponse === "object" &&
          parsedResponse !== null &&
          "actions" in parsedResponse &&
          Array.isArray((parsedResponse as { actions?: unknown[] }).actions)
          ? (parsedResponse as EstimateEditorResponse)
          : ({
            ...(parsedResponse as { reply: string }),
            actions: []
          } as EstimateEditorResponse);

      response = normalizeEditor(editorResponse, assistantRequest.mode);
    }

    /**
     * CRITICAL: flatten actions for test harness
     */
    return jsonSuccess(
      {
        ...response,
        actions: response.actions ?? []
      },
      requestId
    );
  } catch (error) {
    logError("assistant-chat", requestId, error);

    if (error instanceof z.ZodError) {
      return jsonError("Validation failed", requestId, 502);
    }

    if (error instanceof SyntaxError) {
      return jsonError("Invalid JSON from assistant", requestId, 502);
    }

    return jsonError("Assistant failed", requestId, 500);
  }
}