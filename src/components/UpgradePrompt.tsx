"use client";

import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { PLANS, requirePlan, type Plan } from "@/lib/plans";

type UpgradePromptProps = {
  featureName: string;
  requiredPlan: Plan;
  currentPlan: Plan;
};

type CheckoutResponse = {
  url?: string;
  error?: string;
};

const CURRENCY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP"
});

async function parseCheckoutResponse(response: Response): Promise<CheckoutResponse> {
  try {
    return (await response.json()) as CheckoutResponse;
  } catch {
    return {};
  }
}

export default function UpgradePrompt({
  featureName,
  requiredPlan,
  currentPlan
}: UpgradePromptProps): React.ReactElement | null {
  const requiredPlanConfig = PLANS[requiredPlan];
  const currentPlanConfig = PLANS[currentPlan];
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const monthlyPriceLabel = useMemo(() => {
    return `${CURRENCY.format(requiredPlanConfig.monthlyPrice / 100)}/month`;
  }, [requiredPlanConfig.monthlyPrice]);

  if (requirePlan(requiredPlan, currentPlan)) {
    return null;
  }

  async function handleUpgradeClick(): Promise<void> {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plan: requiredPlan,
          period: "monthly"
        })
      });

      const data = await parseCheckoutResponse(response);

      if (!response.ok) {
        throw new Error(data.error?.trim() || "Unable to start checkout. Please try again.");
      }

      if (typeof data.url !== "string" || data.url.trim().length === 0) {
        throw new Error("Checkout URL was not returned.");
      }

      window.location.assign(data.url);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start checkout. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full border-primary/30 bg-[#0A1420]">
      <CardHeader className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg border border-primary/30 bg-primary/10 p-2 text-primary">
            <Lock className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base sm:text-lg">{featureName}</CardTitle>
            <CardDescription>
              Unlock this feature with the {requiredPlanConfig.name} plan.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="rounded-lg border border-[var(--border)] bg-muted/10 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Required plan</p>
          <p className="text-sm font-medium text-foreground">
            {requiredPlanConfig.name} · {monthlyPriceLabel}
          </p>
        </div>

        {errorMessage ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMessage}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex-col gap-3 bg-transparent sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">Current plan: {currentPlanConfig.name}</span>
        <Button
          type="button"
          variant="primary"
          className="w-full sm:w-auto"
          onClick={handleUpgradeClick}
          disabled={isLoading}
        >
          {isLoading ? "Redirecting..." : `Upgrade to ${requiredPlanConfig.name}`}
        </Button>
      </CardFooter>
    </Card>
  );
}
