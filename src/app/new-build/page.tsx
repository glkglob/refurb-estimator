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
  const [error, setError] = useState<string | null>(null);

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
      const estimate = calculateNewBuild(input);
      setResult(estimate);
      setLastInput(input);
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
      const next = calculateNewBuild(applied.nextInput);

      syncFormStateFromInput(applied.nextInput);
      setLastInput(applied.nextInput);
      setResult(next);
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
