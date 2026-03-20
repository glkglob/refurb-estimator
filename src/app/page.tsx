"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import AuthBanner from "@/components/AuthBanner";
import EstimateForm from "@/components/EstimateForm";
import SaveScenarioModal from "@/components/SaveScenarioModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { saveScenario } from "@/lib/dataService";
import type { EstimateInput, EstimateResult, Scenario } from "@/lib/types";
import {
  calculateEnhancedEstimate,
  conditionToRenovationScope,
  getFallbackPostcodeDistrict,
  inferPropertyCategory
} from "@/lib/enhancedEstimator";

const EstimateResults = dynamic(() => import("@/components/EstimateResults"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-muted" />
});

export default function HomePage() {
  const [formKey, setFormKey] = useState(0);
  const [lastInput, setLastInput] = useState<EstimateInput | null>(null);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!result) {
      return;
    }

    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  }, [result]);

  function handleSubmit(input: EstimateInput) {
    try {
      const nextResult = calculateEnhancedEstimate({
        propertyCategory: inferPropertyCategory(input.propertyType),
        postcodeDistrict: getFallbackPostcodeDistrict(input.region),
        totalAreaM2: input.totalAreaM2,
        renovationScope: conditionToRenovationScope(input.condition),
        qualityTier: input.finishLevel,
        additionalFeatures: [],
        listedBuilding: false
      });
      setLastInput(input);
      setResult(nextResult);
      setSubmitError(null);
    } catch (error) {
      setLastInput(null);
      setResult(null);
      if (error instanceof Error) {
        setSubmitError(error.message);
        return;
      }
      setSubmitError("Unable to calculate estimate");
    }
  }

  async function handleSaveScenario(
    name: string,
    purchasePrice?: number,
    gdv?: number
  ): Promise<void> {
    setIsSaving(true);

    try {
      if (!lastInput || !result) {
        return;
      }

      const timestamp = new Date().toISOString();
      const scenario: Scenario = {
        id: crypto.randomUUID(),
        name,
        input: lastInput,
        result,
        createdAt: timestamp,
        updatedAt: timestamp,
        purchasePrice,
        gdv
      };

      await saveScenario(scenario);
      setIsSaveModalOpen(false);
      toast({
        title: "Scenario saved",
        description: "You can compare it on the Scenario Comparison page."
      });
    } catch (error) {
      setIsSaveModalOpen(false);
      toast({
        title: "Scenario saved locally",
        description:
          error instanceof Error ? error.message : "Cloud sync failed. Scenario was saved locally.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleNewEstimate() {
    setLastInput(null);
    setResult(null);
    setSubmitError(null);
    setFormKey((prev) => prev + 1);
    document.getElementById("estimate-form")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Quick Estimate</h1>
      <p className="text-sm text-muted-foreground">
        Enter your property details below and click Calculate to get an instant estimate.
      </p>
      <AuthBanner />
      <div id="estimate-form">
        <EstimateForm
          key={formKey}
          onSubmit={handleSubmit}
          onValidationError={() =>
            toast({
              title: "Missing fields",
              description: "Please fill in all required fields before calculating.",
              variant: "destructive"
            })
          }
        />
      </div>
      {submitError ? <p className="text-sm font-medium text-red-600">{submitError}</p> : null}
      {result ? (
        <div id="results" className="mt-8 space-y-6">
          {lastInput ? (
            <p className="text-sm text-muted-foreground">
              Estimate for: {lastInput.totalAreaM2}m² {lastInput.propertyType} in {lastInput.region},{" "}
              {lastInput.condition} condition, {lastInput.finishLevel} finish
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => setIsSaveModalOpen(true)}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save as Scenario
            </Button>
            <Button type="button" variant="outline" onClick={handleNewEstimate}>
              New estimate
            </Button>
          </div>
          <EstimateResults result={result} />
        </div>
      ) : null}
      <SaveScenarioModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveScenario}
        isSaving={isSaving}
      />
    </section>
  );
}
