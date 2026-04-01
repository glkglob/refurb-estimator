"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/apiClient";
import { PLANS, requirePlan } from "@/lib/plans";

type Plan = keyof typeof PLANS;

type CheckoutResponse = {
  url?: string;
  error?: string;
};

type UpgradePromptProps = {
  requiredPlan: Plan;
  currentPlan: Plan;
  redirectTo?: (url: string) => void;
};

export function UpgradePrompt({
  requiredPlan,
  currentPlan,
  redirectTo,
}: UpgradePromptProps) {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiredPlanConfig = PLANS[requiredPlan];
  const isUnlocked = requirePlan(requiredPlan, currentPlan);

  async function handleUpgrade(): Promise<void> {
    if (isUnlocked || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch("/api/stripe/checkout", {
        method: "POST",
        body: JSON.stringify({
          plan: requiredPlan,
          period: billing,
        }),
      });

      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }

      // ✅ test-safe + production-safe redirect
      if (redirectTo) {
        redirectTo(data.url);
      } else if (typeof window !== "undefined") {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded-xl space-y-3">
      <p>Current plan: {currentPlanConfigLabel(currentPlan)}</p>
      <p>Selected: {requiredPlanConfig.name} ({billing})</p>

      <div className="flex gap-2">
        <Button onClick={() => setBilling("monthly")}>Monthly</Button>
        <Button onClick={() => setBilling("annual")}>Annual</Button>
      </div>

      {error ? <p className="text-red-500">{error}</p> : null}

      <Button onClick={handleUpgrade} disabled={isUnlocked || isLoading}>
        {isLoading ? "Loading..." : `Upgrade to ${requiredPlanConfig.name}`}
      </Button>
    </div>
  );
}

function currentPlanConfigLabel(plan: Plan): string {
  return PLANS[plan]?.name ?? plan;
}
