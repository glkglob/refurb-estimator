import { z } from "zod";
import { aiClient } from "@/lib/ai/client";
import { parseJson } from "@/lib/ai/utils";
import { getRequestId, jsonError, jsonSuccess, logError } from "@/lib/api-route";
import {
  AssistantRequestSchema,
  type AppMode,
  type AssistantAction,
  type AssistantAgent,
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
import { recordServerTelemetryEvent } from "@/lib/telemetry/server";
import { validateJsonRequest } from "@/lib/validate";

const ASSISTANT_MODEL =
  process.env.AI_PROVIDER === "lmstudio"
    ? (process.env.LM_STUDIO_MODEL ?? "qwen/qwen3-4b")
    : "gpt-4o-mini";
const IS_LM_STUDIO = process.env.AI_PROVIDER === "lmstudio";
const SHOULD_LOG_DETAILED_ASSISTANT_OBSERVABILITY =
  process.env.NODE_ENV !== "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.APP_ENV === "staging";
const ASSISTANT_SAMPLE_RATE = Number.parseFloat(
  process.env.ASSISTANT_OBSERVABILITY_SAMPLE_RATE ?? "0.02"
);

function shouldLogSampledAssistantTelemetry(): boolean {
  const sampleRate = Number.isFinite(ASSISTANT_SAMPLE_RATE)
    ? Math.min(Math.max(ASSISTANT_SAMPLE_RATE, 0), 1)
    : 0;
  if (sampleRate <= 0) {
    return false;
  }

  const isProductionLike =
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "staging" ||
    process.env.VERCEL_ENV === "production";

  return isProductionLike && Math.random() <= sampleRate;
}

const EMPTY_EDITOR_ACTION: EstimateEditorResponse["actions"][number] = {
  type: "none",
  reason: "No supported action could be safely applied."
};

type AssistantTelemetryProperties = {
  agent: AssistantAgent;
  mode: AppMode;
  trigger: "user_input" | "auto_followup" | "system";
  message_length: number;
  actions_count: number;
  none_reason?: string;
  dropped_fields_count: number;
  dropped_actions_count: number;
  had_recalculate: boolean;
  timestamp_ms: number;
};

function hasRecalculateAction(actions: AssistantAction[]): boolean {
  return actions.some((action) => action.type === "recalculate");
}

function emitAssistantTelemetry(
  eventName: string,
  properties: Omit<AssistantTelemetryProperties, "timestamp_ms">
): void {
  void recordServerTelemetryEvent({
    eventName,
    properties: {
      ...properties,
      timestamp_ms: Date.now()
    }
  });
}

function normalizeChatResponse(
  response: ChatAssistantResponse,
  mode: "rooms" | "new_build" | "development"
): {
  response: ChatAssistantResponse;
  droppedFields: string[];
  droppedActions: ChatAssistantResponse["actions"][number]["type"][];
} {
  const sanitized = sanitizeAssistantActionsWithReport(mode, response.actions, {
    enforceRecalculate: false
  });

  return {
    response: {
      ...response,
      actions: sanitized.actions
    },
    droppedFields: sanitized.droppedFields,
    droppedActions: sanitized.droppedActions
  };
}

function normalizeEditorResponse(
  response: EstimateEditorResponse,
  mode: "rooms" | "new_build" | "development"
): {
  response: EstimateEditorResponse;
  droppedFields: string[];
  droppedActions: EstimateEditorResponse["actions"][number]["type"][];
} {
  const sanitized = sanitizeAssistantActionsWithReport(mode, response.actions, {
    enforceRecalculate: true
  });
  const { actions } = sanitized;

  if (actions.length === 0) {
    return {
      response: {
        ...response,
        actions: [EMPTY_EDITOR_ACTION]
      },
      droppedFields: sanitized.droppedFields,
      droppedActions: sanitized.droppedActions
    };
  }

  return {
    response: { ...response, actions },
    droppedFields: sanitized.droppedFields,
    droppedActions: sanitized.droppedActions
  };
}

function normalizeCopilotResponse(
  response: ProjectCopilotResponse,
  mode: "rooms" | "new_build" | "development"
): {
  response: ProjectCopilotResponse;
  droppedFields: string[];
  droppedActions: EstimateEditorResponse["actions"][number]["type"][];
} {
  if (!response.suggestedActions) {
    return {
      response,
      droppedFields: [],
      droppedActions: []
    };
  }

  const sanitized = sanitizeAssistantActionsWithReport(mode, response.suggestedActions, {
    enforceRecalculate: true
  });
  const { actions: suggestedActions } = sanitized;

  return {
    response: {
      ...response,
      ...(suggestedActions.length > 0 ? { suggestedActions } : {})
    },
    droppedFields: sanitized.droppedFields,
    droppedActions: sanitized.droppedActions
  };
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const shouldLogSampledTelemetry = shouldLogSampledAssistantTelemetry();

  try {
    const parsed = await validateJsonRequest(request, AssistantRequestSchema, {
      errorMessage: "Invalid assistant payload"
    });

    if (!parsed.success) {
      return parsed.response;
    }

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
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      ...(!IS_LM_STUDIO ? { response_format: { type: "json_object" as const } } : {})
    });

    const rawText = aiResponse.choices[0]?.message?.content ?? "";
    if (!rawText || typeof rawText !== "string") {
      return jsonError("Assistant returned an empty response", requestId, 502);
    }

    const json = parseJson(rawText);
    const responseSchema = getResponseSchema(assistantRequest.agent);
    const parsedResponse = responseSchema.parse(json);
    const logContext = {
      agent: assistantRequest.agent,
      mode: assistantRequest.mode,
      rawModelJson: rawText
    };

    if (assistantRequest.agent === "chat") {
      const normalized = normalizeChatResponse(
        parsedResponse as ChatAssistantResponse,
        assistantRequest.mode
      );

      if (SHOULD_LOG_DETAILED_ASSISTANT_OBSERVABILITY) {
        console.warn(
          JSON.stringify({
            level: "info",
            route: "assistant-chat",
            requestId,
            ...logContext,
            parsedResponse: normalized.response,
            droppedFields: normalized.droppedFields,
            droppedActions: normalized.droppedActions
          })
        );
      }

      if (shouldLogSampledTelemetry) {
        emitAssistantTelemetry("assistant.chat_replied", {
          agent: assistantRequest.agent,
          mode: assistantRequest.mode,
          trigger: "user_input",
          message_length: assistantRequest.message.length,
          actions_count: normalized.response.actions.length,
          dropped_fields_count: normalized.droppedFields.length,
          dropped_actions_count: normalized.droppedActions.length,
          had_recalculate: hasRecalculateAction(normalized.response.actions)
        });
      }

      return jsonSuccess(normalized.response, requestId);
    }

    if (assistantRequest.agent === "editor") {
      const normalized = normalizeEditorResponse(
        parsedResponse as EstimateEditorResponse,
        assistantRequest.mode
      );

      if (SHOULD_LOG_DETAILED_ASSISTANT_OBSERVABILITY) {
        console.warn(
          JSON.stringify({
            level: "info",
            route: "assistant-chat",
            requestId,
            ...logContext,
            parsedResponse: normalized.response,
            droppedFields: normalized.droppedFields,
            droppedActions: normalized.droppedActions
          })
        );
      }

      if (shouldLogSampledTelemetry) {
        const noneReason = normalized.response.actions.find((action) => action.type === "none")?.reason;
        const hasStateAction = normalized.response.actions.some(
          (action) =>
            action.type === "update_fields" || action.type === "add_room" || action.type === "remove_room"
        );

        emitAssistantTelemetry(
          hasStateAction
            ? "assistant.editor_actions_proposed"
            : "assistant.editor_none_returned",
          {
            agent: assistantRequest.agent,
            mode: assistantRequest.mode,
            trigger: "user_input",
            message_length: assistantRequest.message.length,
            actions_count: normalized.response.actions.length,
            ...(noneReason ? { none_reason: noneReason } : {}),
            dropped_fields_count: normalized.droppedFields.length,
            dropped_actions_count: normalized.droppedActions.length,
            had_recalculate: hasRecalculateAction(normalized.response.actions)
          }
        );
      }

      return jsonSuccess(normalized.response, requestId);
    }

    const normalized = normalizeCopilotResponse(
      parsedResponse as ProjectCopilotResponse,
      assistantRequest.mode
    );

    if (SHOULD_LOG_DETAILED_ASSISTANT_OBSERVABILITY) {
      console.warn(
        JSON.stringify({
          level: "info",
          route: "assistant-chat",
          requestId,
          ...logContext,
          parsedResponse: normalized.response,
          droppedFields: normalized.droppedFields,
          droppedActions: normalized.droppedActions
        })
      );
    }

    if (shouldLogSampledTelemetry) {
      const copilotActions = normalized.response.suggestedActions ?? [];

      emitAssistantTelemetry("assistant.copilot_suggestion_shown", {
        agent: assistantRequest.agent,
        mode: assistantRequest.mode,
        trigger: "user_input",
        message_length: assistantRequest.message.length,
        actions_count: copilotActions.length,
        dropped_fields_count: normalized.droppedFields.length,
        dropped_actions_count: normalized.droppedActions.length,
        had_recalculate: hasRecalculateAction(copilotActions)
      });

      if (normalized.droppedFields.length > 0 || normalized.droppedActions.length > 0) {
        emitAssistantTelemetry("assistant.copilot_suggested_actions_dropped", {
          agent: assistantRequest.agent,
          mode: assistantRequest.mode,
          trigger: "user_input",
          message_length: assistantRequest.message.length,
          actions_count: copilotActions.length,
          dropped_fields_count: normalized.droppedFields.length,
          dropped_actions_count: normalized.droppedActions.length,
          had_recalculate: hasRecalculateAction(copilotActions)
        });
      }
    }

    return jsonSuccess(normalized.response, requestId);
  } catch (error: unknown) {
    logError("assistant-chat", requestId, error);

    if (error instanceof z.ZodError) {
      return jsonError(
        "Assistant response validation failed",
        requestId,
        502,
        { details: error.issues.map((issue) => issue.message) }
      );
    }

    if (error instanceof SyntaxError) {
      return jsonError("Assistant returned invalid JSON", requestId, 502);
    }

    const message = error instanceof Error ? error.message : "Assistant request failed";
    return jsonError(message, requestId, 500);
  }
}
