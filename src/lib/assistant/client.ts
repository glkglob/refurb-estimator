import { apiFetch } from "@/lib/apiClient";
import {
  AssistantRequestSchema,
  type AssistantAgent,
  type AssistantRequest,
  type ChatAssistantResponse,
  type EstimateEditorResponse,
  type ProjectCopilotResponse
} from "@/lib/assistant/schemas";
import { getResponseSchema } from "@/lib/assistant/runtime";

type AssistantResponseByAgent = {
  chat: ChatAssistantResponse;
  editor: EstimateEditorResponse;
  copilot: ProjectCopilotResponse;
};

const EDIT_INTENT_PATTERN =
  /\b(make|change|update|set|remove|add|increase|decrease|reduce|lower|raise|adjust|edit|switch|cheaper)\b/i;
const COPILOT_INTENT_PATTERN =
  /\b(next|plan|planning|sequence|roadmap|risk|timeline|priority|prioritise|prioritize|trade[- ]?off|what should i do)\b/i;

export function inferAssistantAgentFromMessage(message: string): AssistantAgent {
  const normalized = message.trim();

  if (EDIT_INTENT_PATTERN.test(normalized)) {
    return "editor";
  }

  if (COPILOT_INTENT_PATTERN.test(normalized)) {
    return "copilot";
  }

  return "chat";
}

export async function requestAssistantResponse<TAgent extends AssistantAgent>(
  request: AssistantRequest & { agent: TAgent }
): Promise<AssistantResponseByAgent[TAgent]> {
  const payload = AssistantRequestSchema.parse(request);
  const response = await apiFetch("/api/v1/assistant/chat", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const json = (await response.json()) as unknown;

  const schema = getResponseSchema(payload.agent);
  return schema.parse(json) as AssistantResponseByAgent[TAgent];
}
