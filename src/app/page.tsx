"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import AuthBanner from "@/components/AuthBanner";
import EstimateResultsFallback from "@/components/EstimateResultsFallback";
import EstimateForm from "@/components/EstimateForm";
import ScenarioLimitPromptDialog from "@/components/ScenarioLimitPromptDialog";
import SaveScenarioModal from "@/components/SaveScenarioModal";
import TestimonialsSection from "@/components/TestimonialsSection";
import TrustBanner from "@/components/TrustBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import { saveScenario } from "@/lib/dataService";
import {
  calculateEnhancedEstimate,
  conditionToRenovationScope,
  getFallbackPostcodeDistrict,
  inferPropertyCategory,
} from "@/lib/enhancedEstimator";
import { exportToCsv } from "@/lib/exportCsv";
import type { QuotePdfInput } from "@/lib/generateQuotePdf";
import { shareOrCopy } from "@/lib/share";
import { ScenarioLimitExceededError } from "@/lib/storage";
import type { EstimateInput, EstimateResult, Scenario } from "@/lib/types";

const EstimateResults = dynamic(() => import("@/components/EstimateResults"), {
  ssr: false,
  loading: () => <EstimateResultsFallback />,
});

export default function HomePage() {
  const [formKey, setFormKey] = useState(0);
  const [lastInput, setLastInput] = useState<EstimateInput | null>(null);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isScenarioLimitPromptOpen, setIsScenarioLimitPromptOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    void import("@/components/EstimateResults");
  }, []);

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
        listedBuilding: false,
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
    gdv?: number,
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
        gdv,
      };

      await saveScenario(scenario);
      setIsSaveModalOpen(false);

      toast({
        title: "Scenario saved",
        description: "You can compare it on the Scenario Comparison page.",
      });
    } catch (error) {
      setIsSaveModalOpen(false);

      if (error instanceof ScenarioLimitExceededError) {
        setIsScenarioLimitPromptOpen(true);
        return;
      }

      toast({
        title: "Scenario saved locally",
        description:
          error instanceof Error
            ? error.message
            : "Cloud sync failed. Scenario was saved locally.",
        variant: "destructive",
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

  async function handleDownloadPdf() {
    if (!result || !lastInput) {
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const pdfInput: QuotePdfInput = {
        propertyDescription: `${lastInput.totalAreaM2}m² ${lastInput.propertyType} in ${lastInput.region}, ${lastInput.condition} condition, ${lastInput.finishLevel} finish`,
        categories: result.categories.map((category) => ({
          category: category.category,
          low: category.low,
          typical: category.typical,
          high: category.high,
        })),
        totalLow: result.totalLow,
        totalTypical: result.totalTypical,
        totalHigh: result.totalHigh,
        costPerM2: result.costPerM2,
      };

      const response = await apiFetch("/api/v1/estimate/pdf", {
        method: "POST",
        body: JSON.stringify({ input: pdfInput }),
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "property-estimate.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "PDF generation failed",
        description: "Unable to generate the PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  async function handleShareEstimate() {
    if (!result || !lastInput) {
      return;
    }

    try {
      const shareText =
        `Refurb estimate for ${lastInput.region}\n` +
        `Low: £${result.totalLow.toLocaleString("en-GB")}\n` +
        `Typical: £${result.totalTypical.toLocaleString("en-GB")}\n` +
        `High: £${result.totalHigh.toLocaleString("en-GB")}`;

      await shareOrCopy("Refurb Estimate", shareText);
    } catch {
      toast({
        title: "Share failed",
        description: "Unable to share the estimate. Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Quick Estimate</h1>

      <p className="text-sm text-muted-foreground">
        Enter your property details below and click Calculate to get an instant estimate.
      </p>

      <TrustBanner />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-primary/40 bg-primary/5 sm:col-span-2">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Development Appraisal</CardTitle>
              <Badge variant="secondary">Pro feature — free during beta</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Run full deal viability checks with SDLT, finance, margin targets, and BRRR
              refinance outputs.
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/development">Open Development Appraisal →</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="border-primary/30 bg-primary/5 sm:col-span-2">
          <CardHeader className="space-y-2">
            <CardTitle>Find Tradespeople</CardTitle>
            <p className="text-sm text-muted-foreground">
              Browse verified contractors and send one enquiry to get matched locally.
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/tradespeople">Open tradespeople directory →</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Loft conversion</CardTitle>
            <p className="text-sm text-muted-foreground">
              Band a loft project with regional multipliers and add-ons.
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/loft">Open loft calculator</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New Build</CardTitle>
            <p className="text-sm text-muted-foreground">
              Estimate build costs for new homes and developments.
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/new-build">Open calculator →</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Extensions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Single/double storey rear, side return, and wrap-around extensions.
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/extension">Open calculator →</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detailed rooms</CardTitle>
            <p className="text-sm text-muted-foreground">
              Build a room-by-room estimate with a deeper breakdown.
            </p>
          </CardHeader>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/rooms">Open calculator →</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <AuthBanner />

      <div id="estimate-form">
        <EstimateForm
          key={formKey}
          onSubmit={handleSubmit}
          onValidationError={() =>
            toast({
              title: "Missing fields",
              description: "Please fill in all required fields before calculating.",
              variant: "destructive",
            })
          }
        />
      </div>

      {submitError ? (
        <div className="bp-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="font-medium text-destructive">{submitError}</p>
        </div>
      ) : null}

      {result ? (
        <div id="results" className="mt-8 space-y-6">
          {lastInput ? (
            <p className="text-sm text-muted-foreground">
              Estimate for: {lastInput.totalAreaM2}m² {lastInput.propertyType} in{" "}
              {lastInput.region}, {lastInput.condition} condition, {lastInput.finishLevel} finish
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

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? <Loader2 className="size-4 animate-spin" /> : null}
              Download PDF
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                exportToCsv(`${lastInput?.region.toLowerCase()}-estimate.csv`, [
                  ...result.categories.map((category) => ({
                    category: category.category,
                    low: category.low,
                    typical: category.typical,
                    high: category.high,
                  })),
                  {
                    category: "TOTAL",
                    low: result.totalLow,
                    typical: result.totalTypical,
                    high: result.totalHigh,
                  },
                ])
              }
            >
              Download CSV
            </Button>

            <Button type="button" variant="outline" onClick={() => void handleShareEstimate()}>
              Share
            </Button>

            <Button type="button" variant="outline" onClick={handleNewEstimate}>
              New estimate
            </Button>
          </div>

          <EstimateResults result={result} />
        </div>
      ) : null}

      <TestimonialsSection />

      <SaveScenarioModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSaveScenario}
        isSaving={isSaving}
      />
      <ScenarioLimitPromptDialog
        isOpen={isScenarioLimitPromptOpen}
        onOpenChange={setIsScenarioLimitPromptOpen}
      />
    </section>
  );
}
