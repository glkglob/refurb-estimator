"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  inferAssistantAgentFromMessage,
  requestAssistantResponse
} from "@/lib/assistant/client";
import type { AssistantAction, AppMode, AssistantRequest } from "@/lib/assistant/schemas";

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

function emitUiTelemetry(event: {
  mode: AppMode;
  agent: "chat" | "editor" | "copilot";
  outcome: "applied" | "rejected" | "none";
  actionCount: number;
  noneReason?: string | null;
}): void {
  if (!shouldEmitUiTelemetrySample()) {
    return;
  }

  console.warn(
    JSON.stringify({
      level: "info",
      route: "assistant-ui",
      mode: event.mode,
      agent: event.agent,
      outcome: event.outcome,
      actionCount: event.actionCount,
      noneReason: event.noneReason ?? null
    })
  );
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const trimmedMessage = message.trim();
    const agent = inferAssistantAgentFromMessage(trimmedMessage);

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

        await onApplyEditorActions?.(response.actions);

        emitUiTelemetry({
          mode,
          agent,
          outcome: hasStateAction ? "applied" : "none",
          actionCount: response.actions.length,
          noneReason: noneAction?.reason ?? null
        });

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
      }
    } catch (submitError) {
      if (agent === "editor") {
        emitUiTelemetry({
          mode,
          agent,
          outcome: "rejected",
          actionCount: 0
        });
      }

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
