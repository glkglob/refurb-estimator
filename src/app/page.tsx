"use client";

import { useEffect, useState } from "react";
import EstimateForm from "@/components/EstimateForm";
import EstimateResults from "@/components/EstimateResults";
import SaveScenarioModal from "@/components/SaveScenarioModal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { estimateProject } from "@/lib/estimator";
import { saveScenario } from "@/lib/storage";
import type { EstimateInput, EstimateResult, Scenario } from "@/lib/types";

export default function HomePage() {
  const [lastInput, setLastInput] = useState<EstimateInput | null>(null);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!result) {
      return;
    }

    document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
  }, [result]);

  function handleSubmit(input: EstimateInput) {
    try {
      const nextResult = estimateProject(input, defaultCostLibrary);
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

  function handleSaveScenario(
    name: string,
    purchasePrice?: number,
    gdv?: number
  ): void {
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

    saveScenario(scenario);
    setIsSaveModalOpen(false);
    toast({
      title: "Scenario saved",
      description: "You can compare it on the Scenario Comparison page."
    });
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Quick Estimate</h1>
      <p className="text-sm text-muted-foreground">
        Enter your property details below and click Calculate to get an instant estimate.
      </p>
      <EstimateForm onSubmit={handleSubmit} />
      {submitError ? <p className="text-sm font-medium text-red-600">{submitError}</p> : null}
      {result ? (
        <div id="results" className="space-y-4">
          {lastInput ? (
            <p className="text-sm text-muted-foreground">
              Estimate for: {lastInput.totalAreaM2}m² {lastInput.propertyType} in {lastInput.region},{" "}
              {lastInput.condition} condition, {lastInput.finishLevel} finish
            </p>
          ) : null}
          <Button type="button" onClick={() => setIsSaveModalOpen(true)}>
            Save as Scenario
          </Button>
          <EstimateResults result={result} />
        </div>
      ) : null}
      <SaveScenarioModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveScenario}
      />
    </section>
  );
}
