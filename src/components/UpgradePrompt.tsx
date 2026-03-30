"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import { PLANS, type Plan, type PlanFeatures, type PlanPeriod } from "@/lib/plans";

type UpgradePromptProps = {
  feature: keyof PlanFeatures;
  userPlan: Plan;
  requiredPlan: Plan;
};

type CheckoutSessionResponse = {
  url?: string;
  message?: string;
};

const FEATURE_LABELS: Record<keyof PlanFeatures, string> = {
  unlimitedEstimates: "Unlimited estimates",
  aiEstimatesPerMonth: "AI estimates per month",
  scenarioLimit: "Scenario comparisons",
  devAppraisal: "Developer appraisal",
  refineEstimate: "Refine estimate scope builder",
  pdfExport: "PDF export",
  csvExport: "CSV export",
  budgetTracker: "Budget tracker",
  teamSeats: "Team seats",
  whiteLabelPdf: "White-label PDF reports",
  apiAccess: "API access"
};

const CURRENCY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP"
});

const PLAN_ORDER: Plan[] = ["free", "pro", "agency"];

function getTargetPlan(requiredPlan: Plan): Plan {
  if (requiredPlan === "free") {
    return "pro";
  }

  return requiredPlan;
}

function hasRequiredPlan(userPlan: Plan, requiredPlan: Plan): boolean {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

function formatPrice(plan: Plan, period: PlanPeriod): string {
  const amountPence =
    period === "monthly" ? PLANS[plan].monthlyPrice : PLANS[plan].annualPrice;

  return CURRENCY.format(amountPence / 100);
}

function getCheckoutButtonLabel(plan: Plan): string {
  return plan === "agency" ? "Upgrade to Agency" : "Upgrade to Pro";
}

function getSelectedPlanLabel(plan: Plan, period: PlanPeriod): string {
  return `${PLANS[plan].name} (${period === "monthly" ? "monthly" : "annual"})`;
}

async function parseCheckoutResponse(response: Response): Promise<CheckoutSessionResponse> {
  try {
    return (await response.json()) as CheckoutSessionResponse;
  } catch {
    return {};
  }
}

export default function UpgradePrompt({
  feature,
  userPlan,
  requiredPlan
}: UpgradePromptProps): React.ReactElement {
  const [period, setPeriod] = useState<PlanPeriod>("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const targetPlan = useMemo(() => getTargetPlan(requiredPlan), [requiredPlan]);
  const featureLabel = FEATURE_LABELS[feature];
  const targetPlanConfig = PLANS[targetPlan];
  const userPlanConfig = PLANS[userPlan];
  const alreadyUnlocked = useMemo(
    () => hasRequiredPlan(userPlan, targetPlan),
    [userPlan, targetPlan]
  );

  const checkoutButtonLabel = useMemo(() => {
    if (alreadyUnlocked) {
      return "Included in your plan";
    }

    if (isLoading) {
      return "Redirecting…";
    }

    return getCheckoutButtonLabel(targetPlan);
  }, [alreadyUnlocked, isLoading, targetPlan]);

  async function handleCheckout(): Promise<void> {
    if (alreadyUnlocked || isLoading) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: targetPlan,
          period
        })
      });

      const payload = await parseCheckoutResponse(response);

      if (!response.ok) {
        throw new Error(
          payload.message?.trim() || "Unable to start checkout. Please try again."
        );
      }

      if (typeof payload.url !== "string" || payload.url.trim().length === 0) {
        throw new Error("Checkout URL was not returned by the server.");
      }

      window.location.assign(payload.url);
    } catch (error: unknown) {
      if (isApiFetchError(error)) {
        setErrorMessage(error.message);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unable to start checkout. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-500/40 text-amber-200"
          >
            Feature locked
          </Badge>
          <Badge variant="secondary">Current plan: {userPlanConfig.name}</Badge>
        </div>

        <CardTitle>{featureLabel}</CardTitle>

        <CardDescription>
          Unlock this feature on the {targetPlanConfig.name} plan.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {targetPlanConfig.description}
        </p>

        <fieldset className="space-y-2" disabled={isLoading || alreadyUnlocked}>
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Billing period
          </legend>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Billing period">
            <Button
              type="button"
              variant={period === "monthly" ? "primary" : "outline"}
              size="sm"
              onClick={() => setPeriod("monthly")}
              aria-pressed={period === "monthly"}
              disabled={isLoading || alreadyUnlocked}
            >
              Monthly · {formatPrice(targetPlan, "monthly")}
            </Button>

            <Button
              type="button"
              variant={period === "annual" ? "primary" : "outline"}
              size="sm"
              onClick={() => setPeriod("annual")}
              aria-pressed={period === "annual"}
              disabled={isLoading || alreadyUnlocked}
            >
              Annual · {formatPrice(targetPlan, "annual")}
            </Button>
          </div>
        </fieldset>

        {errorMessage ? (
          <p
            className="text-sm text-destructive"
            role="alert"
            aria-atomic="true"
          >
            {errorMessage}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          Selected: {getSelectedPlanLabel(targetPlan, period)}
        </span>

        <Button
          type="button"
          variant="primary"
          className="w-full sm:w-auto"
          onClick={handleCheckout}
          disabled={isLoading || alreadyUnlocked}
        >
          {checkoutButtonLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
