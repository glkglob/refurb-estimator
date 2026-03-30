"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, ChevronDown, Share2 } from "lucide-react";
import AuthGate from "@/components/AuthGate";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import EstimateAssistantPanel from "@/components/EstimateAssistantPanel";
import UpgradePrompt from "@/components/UpgradePrompt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  calculateDevelopmentAppraisal,
  type AppraisalInput,
  type AppraisalResult,
  type ViabilityStatus
} from "@/lib/developmentAppraisal";
import type { AssistantAction } from "@/lib/assistant/schemas";
import { applyEditorActionsToDevelopmentInput } from "@/lib/assistant/developmentActions";
import { type Plan, requirePlan } from "@/lib/plans";
import { shareOrCopy } from "@/lib/share";
import { createClientSafely } from "@/lib/supabase/client";

type FormState = {
  purchasePrice: string;
  grossDevelopmentValue: string;
  acquisitionLegalFees: string;
  buildCosts: string;
  professionalFees: string;
  planningCosts: string;
  contingencyPercent: string;
  includeFinance: boolean;
  bridgingRateMonthlyPercent: string;
  loanTermMonths: string;
  loanToValuePercent: string;
  saleLegalFees: string;
  estateAgentFeePercent: string;
  targetProfitMarginPercent: string;
};

const DEFAULT_FORM_STATE: FormState = {
  purchasePrice: "250000",
  grossDevelopmentValue: "450000",
  acquisitionLegalFees: "2000",
  buildCosts: "120000",
  professionalFees: "12000",
  planningCosts: "3000",
  contingencyPercent: "10",
  includeFinance: true,
  bridgingRateMonthlyPercent: "1",
  loanTermMonths: "9",
  loanToValuePercent: "70",
  saleLegalFees: "1500",
  estateAgentFeePercent: "1.5",
  targetProfitMarginPercent: "20"
};

const VIABILITY_META: Record<
  ViabilityStatus,
  {
    label: string;
    className: string;
  }
> = {
  viable: {
    label: "🟢 Viable",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
  },
  marginal: {
    label: "🟡 Marginal",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-700"
  },
  unviable: {
    label: "🔴 Unviable",
    className: "border-red-500/40 bg-red-500/10 text-red-700"
  }
};

const COST_BREAKDOWN_ROWS: Array<{
  label: string;
  key: keyof AppraisalResult["costBreakdown"];
}> = [
  { label: "Purchase", key: "purchasePrice" },
  { label: "SDLT", key: "stampDutyLandTax" },
  { label: "Legal (acquisition)", key: "acquisitionLegalFees" },
  { label: "Build / Refurb", key: "buildCosts" },
  { label: "Professional fees", key: "professionalFees" },
  { label: "Planning", key: "planningCosts" },
  { label: "Contingency", key: "contingencyCost" },
  { label: "Finance", key: "financeTotal" },
  { label: "Legal (sale)", key: "saleLegalFees" },
  { label: "Estate agent fee", key: "estateAgentFee" }
];

function parseRequiredNonNegativeNumber(value: string, fieldLabel: string): number {
  if (value.trim() === "") {
    throw new Error(`${fieldLabel} is required`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a non-negative number`);
  }
  return parsed;
}

function parseOptionalNonNegativeNumber(value: string, fieldLabel: string): number {
  if (value.trim() === "") {
    return 0;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a non-negative number`);
  }
  return parsed;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

type AuthState = "checking" | "authenticated" | "unauthenticated";

function resolvePlan(value: unknown): Plan {
  if (value === "free" || value === "pro" || value === "agency") {
    return value;
  }

  return "free";
}

export default function DevelopmentAppraisalPage() {
  const { toast } = useToast();
  const supabase = useMemo(() => createClientSafely(), []);

  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM_STATE);
  const [result, setResult] = useState<AppraisalResult | null>(null);
  const [inputSnapshot, setInputSnapshot] = useState<AppraisalInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFinance, setShowFinance] = useState(true);
  const [authState, setAuthState] = useState<AuthState>(
    supabase ? "checking" : "authenticated"
  );
  const [userPlan, setUserPlan] = useState<Plan>("free");

  const viabilityMeta = useMemo(
    () => (result ? VIABILITY_META[result.viability] : null),
    [result]
  );
  const hasDevelopmentAccess = requirePlan("pro", userPlan);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    let isActive = true;

    async function loadAccessState() {
      const {
        data: { user },
        error: userError
      } = await supabase.auth.getUser();

      if (!isActive) {
        return;
      }

      if (userError || !user) {
        setAuthState("unauthenticated");
        setUserPlan("free");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle();

      if (!isActive) {
        return;
      }

      if (profileError) {
        setUserPlan("free");
        setAuthState("authenticated");
        return;
      }

      const planValue =
        profileData && typeof profileData === "object" && "plan" in profileData
          ? profileData.plan
          : undefined;

      setUserPlan(resolvePlan(planValue));
      setAuthState("authenticated");
    }

    void loadAccessState();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      if (!isActive) {
        return;
      }

      setAuthState("checking");
      void loadAccessState();
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  function syncFormStateFromInput(input: AppraisalInput): void {
    setFormState({
      purchasePrice: String(input.purchasePrice),
      grossDevelopmentValue: String(input.grossDevelopmentValue),
      acquisitionLegalFees: String(input.acquisitionLegalFees),
      buildCosts: String(input.buildCosts),
      professionalFees: String(input.professionalFees),
      planningCosts: String(input.planningCosts),
      contingencyPercent: String(input.contingencyPercent),
      includeFinance: input.includeFinance,
      bridgingRateMonthlyPercent: String(input.bridgingRateMonthlyPercent),
      loanTermMonths: String(input.loanTermMonths),
      loanToValuePercent: String(input.loanToValuePercent),
      saleLegalFees: String(input.saleLegalFees),
      estateAgentFeePercent: String(input.estateAgentFeePercent),
      targetProfitMarginPercent: String(input.targetProfitMarginPercent)
    });
  }

  function buildInput(): AppraisalInput {
    const isFinanceIncluded = formState.includeFinance;

    return {
      purchasePrice: parseRequiredNonNegativeNumber(formState.purchasePrice, "Purchase price"),
      grossDevelopmentValue: parseRequiredNonNegativeNumber(
        formState.grossDevelopmentValue,
        "Gross development value"
      ),
      acquisitionLegalFees: parseRequiredNonNegativeNumber(
        formState.acquisitionLegalFees,
        "Acquisition legal fees"
      ),
      buildCosts: parseRequiredNonNegativeNumber(formState.buildCosts, "Build costs"),
      professionalFees: parseRequiredNonNegativeNumber(
        formState.professionalFees,
        "Professional fees"
      ),
      planningCosts: parseRequiredNonNegativeNumber(formState.planningCosts, "Planning costs"),
      contingencyPercent: parseRequiredNonNegativeNumber(
        formState.contingencyPercent,
        "Contingency percent"
      ),
      includeFinance: isFinanceIncluded,
      bridgingRateMonthlyPercent: isFinanceIncluded
        ? parseRequiredNonNegativeNumber(formState.bridgingRateMonthlyPercent, "Bridging rate")
        : parseOptionalNonNegativeNumber(
            formState.bridgingRateMonthlyPercent,
            "Bridging rate"
          ),
      loanTermMonths: isFinanceIncluded
        ? parseRequiredNonNegativeNumber(formState.loanTermMonths, "Loan term")
        : parseOptionalNonNegativeNumber(formState.loanTermMonths, "Loan term"),
      loanToValuePercent: isFinanceIncluded
        ? parseRequiredNonNegativeNumber(formState.loanToValuePercent, "Loan to value")
        : parseOptionalNonNegativeNumber(formState.loanToValuePercent, "Loan to value"),
      saleLegalFees: parseRequiredNonNegativeNumber(formState.saleLegalFees, "Sale legal fees"),
      estateAgentFeePercent: parseRequiredNonNegativeNumber(
        formState.estateAgentFeePercent,
        "Estate agent fee percent"
      ),
      targetProfitMarginPercent: parseRequiredNonNegativeNumber(
        formState.targetProfitMarginPercent,
        "Target profit margin percent"
      )
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);

    try {
      const nextInput = buildInput();
      const nextResult = calculateDevelopmentAppraisal(nextInput);

      setInputSnapshot(nextInput);
      setResult(nextResult);
    } catch (submitError) {
      setResult(null);
      setInputSnapshot(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to calculate development appraisal"
      );
    }
  }

  function handleApplyAssistantEditorActions(actions: AssistantAction[]): void {
    if (!inputSnapshot) {
      return;
    }

    const applied = applyEditorActionsToDevelopmentInput(inputSnapshot, actions);
    if (applied.changedFields.length === 0 || !applied.shouldRecalculate) {
      return;
    }

    try {
      const nextResult = calculateDevelopmentAppraisal(applied.nextInput);
      setInputSnapshot(applied.nextInput);
      syncFormStateFromInput(applied.nextInput);
      setResult(nextResult);
      setError(null);
    } catch (assistantError) {
      setError(
        assistantError instanceof Error
          ? assistantError.message
          : "Unable to recalculate appraisal after assistant changes"
      );
    }
  }

  function handleReset(): void {
    setFormState(DEFAULT_FORM_STATE);
    setResult(null);
    setInputSnapshot(null);
    setError(null);
    setShowFinance(true);
  }

  async function handleShare(): Promise<void> {
    if (!result || !inputSnapshot) {
      return;
    }

    try {
      const shareText = [
        "Development Appraisal",
        `GDV: £${Math.round(inputSnapshot.grossDevelopmentValue).toLocaleString("en-GB")}`,
        `Total costs: £${Math.round(result.totalCosts).toLocaleString("en-GB")}`,
        `Gross profit: £${Math.round(result.grossProfit).toLocaleString("en-GB")}`,
        `Margin: ${formatPercent(result.grossProfitPercent)}`,
        `ROC: ${formatPercent(result.returnOnCost)}`,
        `Viability: ${VIABILITY_META[result.viability].label}`
      ].join("\n");

      await shareOrCopy("Development Appraisal", shareText);
      toast({
        title: "Shared",
        description: "Appraisal summary copied or shared successfully."
      });
    } catch (shareError) {
      toast({
        title: "Share failed",
        description:
          shareError instanceof Error
            ? shareError.message
            : "Unable to share this appraisal.",
        variant: "destructive"
      });
    }
  }

  const resultsSection =
    result && viabilityMeta ? (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className={viabilityMeta.className}>
            {viabilityMeta.label}
          </Badge>
          <Button type="button" variant="outline" onClick={() => void handleShare()}>
            <Share2 className="mr-2 size-4" />
            Share this appraisal
          </Button>
        </div>

        {inputSnapshot ? (
          <EstimateAssistantPanel
            mode="development"
            estimateInput={inputSnapshot}
            estimateResult={result}
            onApplyEditorActions={handleApplyAssistantEditorActions}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Metric</TableHead>
                  <TableHead className="px-4">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="px-4 font-medium">Total costs</TableCell>
                  <TableCell className="px-4">
                    <CurrencyDisplay amount={result.totalCosts} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-4 font-medium">GDV</TableCell>
                  <TableCell className="px-4">
                    <CurrencyDisplay amount={inputSnapshot?.grossDevelopmentValue ?? 0} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-4 font-medium">Gross profit</TableCell>
                  <TableCell className="px-4">
                    <CurrencyDisplay amount={result.grossProfit} />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-4 font-medium">Margin %</TableCell>
                  <TableCell className="px-4 font-mono">
                    {formatPercent(result.grossProfitPercent)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-4 font-medium">ROC %</TableCell>
                  <TableCell className="px-4 font-mono">
                    {formatPercent(result.returnOnCost)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>BRRR Refinance Check</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Refinance value (75% GDV)</p>
              <p className="text-lg font-semibold">
                <CurrencyDisplay amount={result.brrr.refinanceValueAt75Percent} />
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Equity released</p>
              <p className="text-lg font-semibold">
                <CurrencyDisplay amount={result.brrr.equityReleased} />
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <details>
              <summary className="cursor-pointer font-medium">
                Full cost breakdown
              </summary>
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Cost item</TableHead>
                      <TableHead className="px-4">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {COST_BREAKDOWN_ROWS.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="px-4 font-medium">{row.label}</TableCell>
                        <TableCell className="px-4">
                          <CurrencyDisplay amount={result.costBreakdown[row.key]} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </details>
          </CardContent>
        </Card>
      </section>
    ) : null;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Development Appraisal</h1>
          <Badge variant="secondary">Pro plan feature</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Model acquisition, build, finance, and sale assumptions to assess development viability.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assumptions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>SDLT uses 2025/26 residential bands plus the 3% additional property surcharge.</li>
            <li>
              Finance uses simple bridging interest against the borrowed purchase amount based on
              monthly rate, term, and LTV.
            </li>
            <li>
              Viability compares gross profit margin to your target: at/above target is viable,
              within 5 percentage points below is marginal, lower than that is unviable.
            </li>
            <li>
              Outputs are indicative planning figures and not formal tax, legal, lending, or
              investment advice.
            </li>
          </ul>
        </CardContent>
      </Card>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Acquisition</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchase-price">Purchase price (£)</Label>
              <Input
                id="purchase-price"
                type="number"
                min="0"
                required
                value={formState.purchasePrice}
                onChange={(event) => updateField("purchasePrice", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="acquisition-legal-fees">Legal fees (acquisition) (£)</Label>
              <Input
                id="acquisition-legal-fees"
                type="number"
                min="0"
                value={formState.acquisitionLegalFees}
                onChange={(event) => updateField("acquisitionLegalFees", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Build / Refurb Costs</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="build-costs">Build / refurb costs (£)</Label>
              <Input
                id="build-costs"
                type="number"
                min="0"
                value={formState.buildCosts}
                onChange={(event) => updateField("buildCosts", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="professional-fees">Professional fees (£)</Label>
              <Input
                id="professional-fees"
                type="number"
                min="0"
                value={formState.professionalFees}
                onChange={(event) => updateField("professionalFees", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planning-costs">Planning costs (£)</Label>
              <Input
                id="planning-costs"
                type="number"
                min="0"
                value={formState.planningCosts}
                onChange={(event) => updateField("planningCosts", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contingency">Contingency (%)</Label>
              <Input
                id="contingency"
                type="number"
                min="0"
                value={formState.contingencyPercent}
                onChange={(event) => updateField("contingencyPercent", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-margin">Target profit margin (%)</Label>
              <Input
                id="target-margin"
                type="number"
                min="0"
                value={formState.targetProfitMarginPercent}
                onChange={(event) => updateField("targetProfitMarginPercent", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <details
              open={showFinance}
              onToggle={(event) => {
                setShowFinance(event.currentTarget.open);
              }}
              className="space-y-4"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                <span>Finance (optional)</span>
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
              </summary>

              <div className="space-y-4 pt-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={formState.includeFinance}
                    onChange={(event) => updateField("includeFinance", event.target.checked)}
                  />
                  Include finance costs
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="loan-term">Loan term (months)</Label>
                    <Input
                      id="loan-term"
                      type="number"
                      min="0"
                      value={formState.loanTermMonths}
                      onChange={(event) => updateField("loanTermMonths", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="loan-ltv">Loan to value (LTV %)</Label>
                    <Input
                      id="loan-ltv"
                      type="number"
                      min="0"
                      value={formState.loanToValuePercent}
                      onChange={(event) => updateField("loanToValuePercent", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bridging-rate">Bridging rate (% monthly)</Label>
                    <Input
                      id="bridging-rate"
                      type="number"
                      min="0"
                      value={formState.bridgingRateMonthlyPercent}
                      onChange={(event) =>
                        updateField("bridgingRateMonthlyPercent", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sale</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="gdv">Gross Development Value (GDV) (£)</Label>
              <Input
                id="gdv"
                type="number"
                min="0"
                required
                value={formState.grossDevelopmentValue}
                onChange={(event) => updateField("grossDevelopmentValue", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale-legal">Legal fees (sale) (£)</Label>
              <Input
                id="sale-legal"
                type="number"
                min="0"
                value={formState.saleLegalFees}
                onChange={(event) => updateField("saleLegalFees", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-fee">Estate agent fee (%)</Label>
              <Input
                id="agent-fee"
                type="number"
                min="0.5"
                max="5"
                step="0.1"
                value={formState.estateAgentFeePercent}
                onChange={(event) => updateField("estateAgentFeePercent", event.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit">Calculate appraisal</Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset defaults
          </Button>
        </div>
      </form>

      {error ? (
        <div className="bp-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="font-medium text-destructive">{error}</p>
        </div>
      ) : null}

      {result && viabilityMeta ? (
        authState !== "authenticated" ? (
          <AuthGate
            featureName="Development Appraisal"
            featureDescription={`Preview status: ${viabilityMeta.label}. Sign in to unlock exact totals, margin, ROC, and BRRR values.`}
          >
            {resultsSection}
          </AuthGate>
        ) : hasDevelopmentAccess ? (
          resultsSection
        ) : (
          <UpgradePrompt
            featureName="Development Appraisal"
            requiredPlan="pro"
            currentPlan={userPlan}
          />
        )
      ) : null}
    </section>
  );
}
