"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type TermTooltipProps = {
  term: string;
  explanation: string;
};

export default function TermTooltip({ term, explanation }: TermTooltipProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{term}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-4 rounded-full p-0 text-muted-foreground"
            aria-label={`What is ${term}?`}
          >
            <CircleHelp className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent sideOffset={6}>{explanation}</TooltipContent>
      </Tooltip>
    </span>
  );
}
