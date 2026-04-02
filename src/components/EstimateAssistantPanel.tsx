"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  inferAssistantAgentFromMessage,
  requestAssistantResponse
} from "@/lib/assistant/client";
import type { AssistantAction, AppMode, AssistantRequest } from "@/lib/assistant/schemas";
import { trackTelemetryEvent } from "@/lib/telemetry/client";

type EstimateAssistantPanelProps = {
  mode: AppMode;
  estimateInput: unknown;
  estimateResult: unknown;
  projectContext?: AssistantRequest["projectContext"];
  onApplyEditorActions?: (actions: AssistantAction[]) => void | Promise<void>;
};

type AssistantState = {
  reply: string;
  suggestions?: string[];
  nextSteps?: string[];
  noneReason?: string | null;
  agentLabel: "chat" | "editor" | "copilot";
};

const DEFAULT_PROMPT_PLACEHOLDER =
  "Ask a question about this estimate, request an edit, or ask for next steps.";

const EDIT_INTENT_PATTERN =
  /\b(make|change|update|set|remove|add|increase|decrease|reduce|lower|raise|adjust|edit|switch|cheaper)\b/i;

const UI_TELEMETRY_SAMPLE_RATE = Number.parseFloat(
  process.env.NEXT_PUBLIC_ASSISTANT_UI_SAMPLE_RATE ?? "0.03"
);

function shouldEmitUiTelemetrySample(): boolean {
  const sampleRate = Number.isFinite(UI_TELEMETRY_SAMPLE_RATE)
    ? Math.min(Math.max(UI_TELEMETRY_SAMPLE_RATE, 0), 1)
    : 0;

  if (sampleRate <= 0) {
    return false;
  }

  const isProductionLike =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "staging";

  return isProductionLike && Math.random() <= sampleRate;
}

type AssistantTelemetryProperties = {
  agent: "chat" | "editor" | "copilot";
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

function emitAssistantTelemetry(
  sampled: boolean,
  eventName: string,
  properties: Omit<AssistantTelemetryProperties, "timestamp_ms">
): void {
  if (!sampled) {
    return;
  }

  trackTelemetryEvent({
    eventName,
    properties: {
      ...properties,
      timestamp_ms: Date.now()
    }
  });
}

export default function EstimateAssistantPanel({
  mode,
  estimateInput,
  estimateResult,
  projectContext,
  onApplyEditorActions
}: EstimateAssistantPanelProps) {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assistantState, setAssistantState] = useState<AssistantState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => message.trim().length > 0 && !isSubmitting,
    [isSubmitting, message]
  );
  const telemetrySampled = useMemo(() => shouldEmitUiTelemetrySample(), []);

  useEffect(() => {
    emitAssistantTelemetry(telemetrySampled, "assistant.chat_shown", {
      agent: "chat",
      mode,
      trigger: "system",
      message_length: 0,
      actions_count: 0,
      dropped_fields_count: 0,
      dropped_actions_count: 0,
      had_recalculate: false
    });
  }, [mode, telemetrySampled]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const trimmedMessage = message.trim();
    const inferredAgent = inferAssistantAgentFromMessage(trimmedMessage);
    const agent =
      mode === "new_build"
        ? "editor"
        : mode === "rooms" && EDIT_INTENT_PATTERN.test(trimmedMessage)
          ? "editor"
          : inferredAgent;

    try {
      if (agent === "editor") {
        const response = await requestAssistantResponse({
          agent: "editor",
          mode,
          message: trimmedMessage,
          estimateInput,
          estimateResult,
          projectContext
        });
        const noneAction = response.actions.find((action) => action.type === "none");
        const hasStateAction = response.actions.some(
          (action) => action.type === "update_fields" || action.type === "add_room" || action.type === "remove_room"
        );
        const hadRecalculate = response.actions.some((action) => action.type === "recalculate");

        emitAssistantTelemetry(
          telemetrySampled,
          hasStateAction
            ? "assistant.editor_actions_proposed"
            : "assistant.editor_none_returned",
          {
            agent: "editor",
            mode,
            trigger: "user_input",
            message_length: trimmedMessage.length,
            actions_count: response.actions.length,
            ...(noneAction?.reason ? { none_reason: noneAction.reason } : {}),
            dropped_fields_count: 0,
            dropped_actions_count: 0,
            had_recalculate: hadRecalculate
          }
        );

        await onApplyEditorActions?.(response.actions);

        if (hasStateAction) {
          emitAssistantTelemetry(telemetrySampled, "assistant.editor_actions_applied", {
            agent: "editor",
            mode,
            trigger: "user_input",
            message_length: trimmedMessage.length,
            actions_count: response.actions.length,
            dropped_fields_count: 0,
            dropped_actions_count: 0,
            had_recalculate: hadRecalculate
          });
        }

        setAssistantState({
          reply: response.reply,
          noneReason: noneAction?.reason ?? null,
          agentLabel: agent
        });
      } else if (agent === "copilot") {
        const response = await requestAssistantResponse({
          agent: "copilot",
          mode,
          message: trimmedMessage,
          estimateInput,
          estimateResult,
          projectContext
        });
        setAssistantState({
          reply: response.reply,
          nextSteps: response.nextSteps,
          agentLabel: agent
        });

        emitAssistantTelemetry(telemetrySampled, "assistant.copilot_suggestion_shown", {
          agent: "copilot",
          mode,
          trigger: "user_input",
          message_length: trimmedMessage.length,
          actions_count: response.suggestedActions?.length ?? 0,
          dropped_fields_count: 0,
          dropped_actions_count: 0,
          had_recalculate:
            response.suggestedActions?.some((action) => action.type === "recalculate") ?? false
        });
      } else {
        const response = await requestAssistantResponse({
          agent: "chat",
          mode,
          message: trimmedMessage,
          estimateInput,
          estimateResult,
          projectContext
        });
        setAssistantState({
          reply: response.reply,
          suggestions: response.suggestions,
          agentLabel: agent
        });

        emitAssistantTelemetry(telemetrySampled, "assistant.chat_replied", {
          agent: "chat",
          mode,
          trigger: "user_input",
          message_length: trimmedMessage.length,
          actions_count: response.actions?.length ?? 0,
          dropped_fields_count: 0,
          dropped_actions_count: 0,
          had_recalculate: false
        });
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to contact the assistant."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const shouldShowClarificationHint =
    assistantState?.noneReason && assistantState.reply.trim().endsWith("?");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          Estimate Assistant
        </CardTitle>
        <CardDescription>
          Explanations route to Chat, clear edits route to Editor, and planning questions route to
          Copilot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={DEFAULT_PROMPT_PLACEHOLDER}
            className="bp-focus-ring min-h-24 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Running assistant...
                </>
              ) : (
                "Ask assistant"
              )}
            </Button>
            {assistantState ? (
              <Badge variant="secondary" className="capitalize">
                {assistantState.agentLabel}
              </Badge>
            ) : null}
          </div>
        </form>

        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}

        {assistantState ? (
          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/20 p-3 text-sm">
            <p className="text-foreground">{assistantState.reply}</p>

            {assistantState.noneReason ? (
              <p className="text-muted-foreground">
                Why no edit was applied: {assistantState.noneReason}
              </p>
            ) : null}

            {shouldShowClarificationHint ? (
              <p className="text-xs text-muted-foreground">
                Reply with a short follow-up so the editor can apply the correct change.
              </p>
            ) : null}

            {assistantState.suggestions && assistantState.suggestions.length > 0 ? (
              <ul className="list-disc pl-5 text-muted-foreground">
                {assistantState.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}

            {assistantState.nextSteps && assistantState.nextSteps.length > 0 ? (
              <ol className="list-decimal pl-5 text-muted-foreground">
                {assistantState.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
