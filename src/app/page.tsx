"use client";

import type React from "react";
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

const WIN_RAISED: React.CSSProperties = {
  backgroundColor: "#d4d0c8",
  borderTop: "2px solid #ffffff",
  borderLeft: "2px solid #ffffff",
  borderRight: "2px solid #808080",
  borderBottom: "2px solid #808080",
};

function WinCard({
  title,
  badge,
  description,
  href,
  btnLabel,
  featured = false,
  colSpan = false,
}: {
  title: string;
  badge?: string;
  description: string;
  href: string;
  btnLabel: string;
  featured?: boolean;
  colSpan?: boolean;
}) {
  return (
    <div
      className={colSpan ? "sm:col-span-2" : ""}
      style={{
        ...WIN_RAISED,
        padding: "8px",
        backgroundColor: featured ? "#c8d8f0" : "#d4d0c8",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span style={{ fontWeight: "bold", fontSize: "11px", color: "#000000" }}>{title}</span>
        {badge ? (
          <span
            style={{
              fontSize: "9px",
              backgroundColor: "#000080",
              color: "#ffffff",
              padding: "1px 4px",
              fontFamily: "Tahoma, Verdana, Arial, sans-serif",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <p style={{ fontSize: "11px", color: "#444444", marginBottom: "6px" }}>{description}</p>
      <Link
        href={href}
        style={{
          ...WIN_RAISED,
          display: "inline-block",
          padding: "2px 10px",
          fontSize: "11px",
          color: "#000000",
          textDecoration: "none",
          fontFamily: "Tahoma, Verdana, Arial, sans-serif",
        }}
      >
        {btnLabel}
      </Link>
    </div>
  );
}

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
    <section className="space-y-3" style={{ fontFamily: "Tahoma, Verdana, Arial, sans-serif", fontSize: "11px", color: "#000000" }}>
      {/* Win2000-style page title bar */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background: "linear-gradient(90deg, #0a246a 0%, #3a6ea5 60%, #a6caf0 100%)",
          color: "#ffffff",
        }}
      >
        <span
          className="inline-flex h-5 w-5 items-center justify-center text-[10px] font-bold"
          style={{ background: "#ffffff", color: "#0a246a", border: "1px solid #808080" }}
        >
          Q
        </span>
        <h1 className="text-[13px] font-bold text-white">Quick Estimate</h1>
      </div>

      <p style={{ color: "#000000", fontSize: "11px" }}>
        Enter your property details below and click Calculate to get an instant estimate.
      </p>

      <TrustBanner />

      {/* Calculator grid — Win2000 groupbox style */}
      <div
        style={{
          border: "1px solid #808080",
          backgroundColor: "#d4d0c8",
          padding: "8px",
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "-8px",
            left: "8px",
            backgroundColor: "#d4d0c8",
            padding: "0 4px",
            fontSize: "11px",
            fontWeight: "bold",
            color: "#000000",
          }}
        >
          Calculators &amp; Tools
        </span>

        <div className="grid gap-2 sm:grid-cols-2 mt-2">
          {/* Development Appraisal — featured */}
          <WinCard
            title="Development Appraisal"
            badge="Pro feature — free during beta"
            description="Run full deal viability checks with SDLT, finance, margin targets, and BRRR refinance outputs."
            href="/development"
            btnLabel="Open Development Appraisal"
            featured
            colSpan
          />

          <WinCard
            title="Find Tradespeople"
            description="Browse verified contractors and send one enquiry to get matched locally."
            href="/tradespeople"
            btnLabel="Open Tradespeople Directory"
            colSpan
          />

          <WinCard
            title="Loft Conversion"
            description="Band a loft project with regional multipliers and add-ons."
            href="/loft"
            btnLabel="Open Loft Calculator"
          />

          <WinCard
            title="New Build"
            description="Estimate build costs for new homes and developments."
            href="/new-build"
            btnLabel="Open Calculator"
          />

          <WinCard
            title="Extensions"
            description="Single/double storey rear, side return, and wrap-around extensions."
            href="/extension"
            btnLabel="Open Calculator"
          />

          <WinCard
            title="Detailed Rooms"
            description="Build a room-by-room estimate with a deeper breakdown."
            href="/rooms"
            btnLabel="Open Calculator"
          />
        </div>
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
        <div className="bp-warning flex items-start gap-2 px-3 py-2 text-[11px]">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" style={{ color: "#cc0000" }} />
          <p style={{ color: "#cc0000" }}>{submitError}</p>
        </div>
      ) : null}

      {result ? (
        <div id="results" className="mt-4 space-y-3">
          {lastInput ? (
            <p style={{ color: "#000080", fontSize: "11px" }}>
              Estimate for: {lastInput.totalAreaM2}m² {lastInput.propertyType} in{" "}
              {lastInput.region}, {lastInput.condition} condition, {lastInput.finishLevel} finish
            </p>
          ) : null}

          <div className="flex flex-wrap gap-1">
            {[
              { label: "Save as Scenario", onClick: () => setIsSaveModalOpen(true), disabled: isSaving, loading: isSaving },
              { label: "Download PDF", onClick: () => void handleDownloadPdf(), disabled: isGeneratingPdf, loading: isGeneratingPdf },
              {
                label: "Download CSV",
                onClick: () =>
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
                  ]),
              },
              { label: "Share", onClick: () => void handleShareEstimate() },
              { label: "New Estimate", onClick: handleNewEstimate },
            ].map(({ label, onClick, disabled, loading }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                disabled={disabled}
                style={{
                  backgroundColor: "#d4d0c8",
                  borderTop: "2px solid #ffffff",
                  borderLeft: "2px solid #ffffff",
                  borderRight: "2px solid #808080",
                  borderBottom: "2px solid #808080",
                  color: "#000000",
                  fontSize: "11px",
                  fontFamily: "Tahoma, Verdana, Arial, sans-serif",
                  padding: "3px 12px",
                  cursor: disabled ? "not-allowed" : "default",
                  opacity: disabled ? 0.6 : 1,
                  minWidth: "80px",
                }}
              >
                {loading ? <Loader2 className="inline size-3 animate-spin mr-1" /> : null}
                {label}
              </button>
            ))}
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
