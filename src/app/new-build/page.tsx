"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import EstimateAssistantPanel from "@/components/EstimateAssistantPanel";
import NewBuildResults from "@/components/NewBuildResults";
import ShareEstimateModal from "@/components/ShareEstimateModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import type { AssistantAction } from "@/lib/assistant/schemas";
import { applyEditorActionsToNewBuildInput } from "@/lib/assistant/newBuildActions";
import { apiFetch } from "@/lib/apiClient";

import { calculateNewBuild } from "@/lib/newBuildEstimator";
import { applyLabourToNewBuildResult } from "@/lib/pricing/applyLabourCost";
import {
  estimateLabourCost,
  LABOUR_REGION_OPTIONS,
  type LabourRegion,
  TRADE_RATES,
} from "@/lib/pricing/tradeRates";

import {
  isCommercialPropertyType,
  isFlatLikePropertyType,
  PropertyType,
} from "@/lib/propertyType";

import type {
  NewBuildInput,
  NewBuildPropertyType,
  NewBuildResult,
  NewBuildSpec,
} from "@/lib/types";

/* ----------------------------- TYPES ----------------------------- */

type CommercialType = NonNullable<NewBuildInput["commercialType"]>;

/* ----------------------------- HELPERS ----------------------------- */

function parseNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCommercialTypeForPropertyType(
  propertyType: NewBuildPropertyType,
): CommercialType | undefined {
  switch (propertyType) {
    case PropertyType.OFFICE:
      return "office";
    case PropertyType.RETAIL:
      return "retail";
    case PropertyType.INDUSTRIAL:
      return "industrial";
    case PropertyType.LEISURE:
      return "leisure";
    case PropertyType.HEALTHCARE:
      return "healthcare";
    default:
      return undefined;
  }
}

/* ----------------------------- CONSTANTS ----------------------------- */

/* ----------------------------- COMPONENT ----------------------------- */

export default function NewBuildPage() {
  const { toast } = useToast();

  /* ----------------------------- STATE ----------------------------- */

  const [propertyType, setPropertyType] = useState<NewBuildPropertyType>(
    PropertyType.DETACHED_HOUSE
  );
  const [spec, setSpec] = useState<NewBuildSpec>("standard");

  const [totalAreaM2, setTotalAreaM2] = useState("120");
  const [bedrooms, setBedrooms] = useState("3");
  const [storeys, setStoreys] = useState("2");
  const [blockStoreys, setBlockStoreys] = useState("3");
  const [postcodeDistrict, setPostcodeDistrict] = useState("");

  const [result, setResult] = useState<NewBuildResult | null>(null);
  const [lastInput, setLastInput] = useState<NewBuildInput | null>(null);
  const [lastLabour, setLastLabour] = useState<{
    low: number;
    mid: number;
    high: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tradeId, setTradeId] = useState<string>("general_builder");
  const [labourDays, setLabourDays] = useState<number>(1);
  const [labourRegion, setLabourRegion] = useState<LabourRegion>("midlands");

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  /* ----------------------------- DERIVED ----------------------------- */

  const isCommercial = isCommercialPropertyType(propertyType);
  const isFlatLike = isFlatLikePropertyType(propertyType);
  const supportsMultiUnit = isFlatLike || isCommercial;

  const storeysMax = supportsMultiUnit ? 20 : 5;

  /* ----------------------------- EFFECTS ----------------------------- */

  useEffect(() => {
    if (result) {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  /* ----------------------------- CORE LOGIC ----------------------------- */

  function syncFormStateFromInput(input: NewBuildInput): void {
    setPropertyType(input.propertyType);
    setSpec(input.spec);
    setTotalAreaM2(String(input.totalAreaM2));
    setBedrooms(String(input.bedrooms));
    setStoreys(String(input.storeys));
    setBlockStoreys(String(input.numberOfStoreys ?? input.storeys));
    setPostcodeDistrict(input.postcodeDistrict);
  }

  function buildInput(): NewBuildInput | null {
    const area = parseNumber(totalAreaM2);
    const beds = parseNumber(bedrooms);
    const storeyVal = parseNumber(supportsMultiUnit ? blockStoreys : storeys);

    if (area === null || area <= 0) {
      setError("Total area must be > 0");
      return null;
    }

    if (!isCommercial && (beds === null || beds < 1)) {
      setError("Bedrooms must be ≥ 1");
      return null;
    }

    if (storeyVal === null || storeyVal < 1 || storeyVal > storeysMax) {
      setError(`Storeys must be 1–${storeysMax}`);
      return null;
    }

    if (!postcodeDistrict.trim()) {
      setError("Postcode required");
      return null;
    }

    return {
      propertyType,
      spec,
      totalAreaM2: area,
      bedrooms: isCommercial ? 1 : beds!,
      storeys: storeyVal,
      postcodeDistrict: postcodeDistrict.toUpperCase(),
      commercialType: isCommercial
        ? getCommercialTypeForPropertyType(propertyType)
        : undefined,
    };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const input = buildInput();
    if (!input) return;

    try {
      const labour = estimateLabourCost(tradeId, labourDays, labourRegion);
      const estimate = calculateNewBuild(input);
      setResult(applyLabourToNewBuildResult(estimate, labour, input.totalAreaM2));
      setLastInput(input);
      setLastLabour(labour);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calculation failed");
    }
  }

  function handleApplyAssistantEditorActions(actions: AssistantAction[]) {
    if (!lastInput) return;

    const applied = applyEditorActionsToNewBuildInput(lastInput, actions);
    if (applied.changedFields.length === 0 || !applied.shouldRecalculate) {
      return;
    }

    try {
      const labour = estimateLabourCost(tradeId, labourDays, labourRegion);
      const next = calculateNewBuild(applied.nextInput);
      const withLabour = applyLabourToNewBuildResult(
        next,
        labour,
        applied.nextInput.totalAreaM2,
      );

      syncFormStateFromInput(applied.nextInput);
      setLastInput(applied.nextInput);
      setResult(withLabour);
      setLastLabour(labour);
      setError(null);
    } catch {
      setError("Assistant recalculation failed");
    }
  }

  async function handleDownloadPdf() {
    if (!result || !lastInput) return;

    setIsGeneratingPdf(true);

    try {
      const response = await apiFetch("/api/v1/estimate/pdf", {
        method: "POST",
        body: JSON.stringify({ input: { result, lastInput } }),
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "estimate.pdf";
      a.click();

      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "PDF failed",
        description: "Try again",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  /* ----------------------------- UI ----------------------------- */

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold">New Build Estimate</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              value={totalAreaM2}
              onChange={(e) => setTotalAreaM2(e.target.value)}
            />

            <div className="space-y-2">
              <Label htmlFor="postcodeDistrict">Postcode district</Label>
              <Input
                id="postcodeDistrict"
                value={postcodeDistrict}
                onChange={(e) => setPostcodeDistrict(e.target.value.toUpperCase())}
                placeholder="e.g. LS1"
              />
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Labour Assumptions
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="new-build-trade">Trade</Label>
                  <select
                    id="new-build-trade"
                    value={tradeId}
                    onChange={(event) => setTradeId(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {TRADE_RATES.map((trade) => (
                      <option key={trade.id} value={trade.id}>
                        {trade.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-build-labour-days">Days</Label>
                  <Input
                    id="new-build-labour-days"
                    type="number"
                    min={1}
                    step={1}
                    value={labourDays}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setLabourDays(
                        Number.isFinite(nextValue) && nextValue >= 1 ? Math.floor(nextValue) : 1,
                      );
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-build-labour-region">Region</Label>
                  <select
                    id="new-build-labour-region"
                    value={labourRegion}
                    onChange={(event) => setLabourRegion(event.target.value as LabourRegion)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {LABOUR_REGION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {error ? <div className="text-red-500">{error}</div> : null}

            <Button type="submit">Calculate estimate</Button>
          </form>
        </CardContent>
      </Card>

      {result && lastInput ? <div id="results" className="space-y-6">
          <EstimateAssistantPanel
            mode="new_build"
            estimateInput={lastInput}
            estimateResult={result}
            onApplyEditorActions={handleApplyAssistantEditorActions}
          />

          {lastLabour ? (
            <div className="rounded-lg border border-border bg-background p-4">
              <p className="text-lg font-medium">
                Labour estimate: £{lastLabour.low.toLocaleString("en-GB")} – £
                {lastLabour.high.toLocaleString("en-GB")} (typical: £
                {lastLabour.mid.toLocaleString("en-GB")})
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Rates sourced from Checkatrade &amp; industry aggregators, April 2026. Excludes
                materials, VAT, and specialist certifications.
              </p>
            </div>
          ) : null}

          <NewBuildResults result={result} />

          <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="animate-spin" /> : "Download"}
          </Button>
        </div> : null}

      {isShareModalOpen ? <ShareEstimateModal
          isOpen
          onClose={() => setIsShareModalOpen(false)}
          snapshot={{ kind: "new_build", input: lastInput!, result: result! }}
        /> : null}
    </section>
  );
}
