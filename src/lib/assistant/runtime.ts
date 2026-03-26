import { CHAT_ASSISTANT_PROMPT, ESTIMATE_EDITOR_PROMPT, PROJECT_COPILOT_PROMPT } from "./prompts";
import {
  type AppMode,
  type AssistantAction,
  type AssistantAgent,
  ChatAssistantResponseSchema,
  EstimateEditorResponseSchema,
  MODE_FIELD_WHITELISTS,
  ProjectCopilotResponseSchema
} from "./schemas";

type PromptBuildInput = {
  systemPrompt: string;
  mode: AppMode;
  message: string;
  estimateInput?: unknown;
  estimateResult?: unknown;
  projectContext?: unknown;
};

type SanitizeActionOptions = {
  enforceRecalculate: boolean;
};

export type ActionSanitizationReport = {
  actions: AssistantAction[];
  droppedFields: string[];
  droppedActions: AssistantAction["type"][];
};

function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getArrayPathPattern(whitelistPath: string): RegExp {
  const tokens = whitelistPath.split("[]").map((segment) => escapeForRegex(segment));
  const pattern = tokens.join("\\[(?:\\d+)?\\]");
  return new RegExp(`^${pattern}$`);
}

export function getSystemPrompt(agent: AssistantAgent): string {
  switch (agent) {
    case "chat":
      return CHAT_ASSISTANT_PROMPT;
    case "editor":
      return ESTIMATE_EDITOR_PROMPT;
    case "copilot":
      return PROJECT_COPILOT_PROMPT;
  }
}

export function getResponseSchema(agent: AssistantAgent) {
  switch (agent) {
    case "chat":
      return ChatAssistantResponseSchema;
    case "editor":
      return EstimateEditorResponseSchema;
    case "copilot":
      return ProjectCopilotResponseSchema;
  }
}

export function buildAssistantPrompt(input: PromptBuildInput): string {
  const fieldWhitelist = MODE_FIELD_WHITELISTS[input.mode];

  return [
    input.systemPrompt,
    "",
    "Runtime context:",
    `mode: ${input.mode}`,
    `allowedFields: ${JSON.stringify(fieldWhitelist)}`,
    `estimateInput: ${JSON.stringify(input.estimateInput ?? null)}`,
    `estimateResult: ${JSON.stringify(input.estimateResult ?? null)}`,
    `projectContext: ${JSON.stringify(input.projectContext ?? null)}`,
    "",
    `User message: ${input.message}`
  ].join("\n");
}

export function isAllowedFieldForMode(mode: AppMode, field: string): boolean {
  const allowedFields = MODE_FIELD_WHITELISTS[mode] as readonly string[];
  if (allowedFields.includes(field)) {
    return true;
  }

  return allowedFields
    .filter((path) => path.includes("[]"))
    .some((path) => getArrayPathPattern(path).test(field));
}

export function filterAllowedFields(mode: AppMode, fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(([field]) => isAllowedFieldForMode(mode, field))
  );
}

function isStateChangingAction(action: AssistantAction): boolean {
  return action.type === "update_fields" || action.type === "add_room" || action.type === "remove_room";
}

export function sanitizeAssistantActions(
  mode: AppMode,
  actions: AssistantAction[],
  options: SanitizeActionOptions
): AssistantAction[] {
  return sanitizeAssistantActionsWithReport(mode, actions, options).actions;
}

export function sanitizeAssistantActionsWithReport(
  mode: AppMode,
  actions: AssistantAction[],
  options: SanitizeActionOptions
): ActionSanitizationReport {
  const normalized: AssistantAction[] = [];
  const droppedFields: string[] = [];
  const droppedActions: AssistantAction["type"][] = [];

  for (const action of actions) {
    if (action.type === "none") {
      if (normalized.length === 0) {
        normalized.push(action);
      } else {
        droppedActions.push(action.type);
      }
      continue;
    }

    if (action.type === "update_fields") {
      const safeEntries = Object.entries(action.fields).filter(([field]) =>
        isAllowedFieldForMode(mode, field)
      );
      const safeFields = Object.fromEntries(safeEntries);

      for (const [field] of Object.entries(action.fields)) {
        if (!(field in safeFields)) {
          droppedFields.push(field);
        }
      }

      if (Object.keys(safeFields).length > 0) {
        normalized.push({ type: "update_fields", fields: safeFields });
      } else {
        droppedActions.push(action.type);
      }
      continue;
    }

    if ((action.type === "add_room" || action.type === "remove_room") && mode !== "rooms") {
      droppedActions.push(action.type);
      continue;
    }

    normalized.push(action);
  }

  const filtered = normalized.filter((action) => action.type !== "none");
  if (filtered.length === 0) {
    return { actions: normalized, droppedFields, droppedActions };
  }

  if (!options.enforceRecalculate) {
    return { actions: filtered, droppedFields, droppedActions };
  }

  const hasStateChanges = filtered.some(isStateChangingAction);
  if (!hasStateChanges) {
    return { actions: filtered, droppedFields, droppedActions };
  }

  const withoutRecalculate = filtered.filter((action) => action.type !== "recalculate");
  return {
    actions: [...withoutRecalculate, { type: "recalculate" }],
    droppedFields,
    droppedActions
  };
}
