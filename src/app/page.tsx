"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { 
  AlertTriangle, 
  ArrowRight, 
  Building2, 
  Calculator, 
  Camera, 
  Download, 
  FileText, 
  LayoutGrid, 
  Loader2, 
  Save, 
  Share2, 
  Sparkles, 
  Wrench 
} from "lucide-react";
import { useEffect, useState } from "react";

import AuthBanner from "@/components/AuthBanner";
import EstimateResultsFallback from "@/components/EstimateResultsFallback";
import EstimateForm from "@/components/EstimateForm";
import ScenarioLimitPromptDialog from "@/components/ScenarioLimitPromptDialog";
import SaveScenarioModal from "@/components/SaveScenarioModal";
import TestimonialsSection from "@/components/TestimonialsSection";
import TrustBanner from "@/components/TrustBanner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const tools = [
  {
    title: "Development Appraisal",
    description: "Run full deal viability checks with SDLT, finance, and BRRR refinance outputs.",
    href: "/development",
    icon: Building2,
    featured: true,
    badge: "Pro - Free during beta",
  },
  {
    title: "Find Tradespeople",
    description: "Browse verified contractors and get matched locally.",
    href: "/tradespeople",
    icon: Wrench,
  },
  {
    title: "AI Photo Estimate",
    description: "Upload photos and get AI-powered renovation cost estimates.",
    href: "/photo",
    icon: Camera,
  },
  {
    title: "New Build Calculator",
    description: "Estimate build costs for new homes and developments.",
    href: "/new-build",
    icon: Building2,
  },
  {
    title: "Loft Conversion",
    description: "Calculate loft project costs with regional multipliers.",
    href: "/loft",
    icon: Calculator,
  },
  {
    title: "Room-by-Room",
    description: "Build detailed estimates with granular room breakdowns.",
    href: "/rooms",
    icon: LayoutGrid,
  },
];

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
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-b from-card to-background px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Renovation Estimates</span>
            </div>
            
            {/* Headline */}
            <h1 className="mb-6 max-w-4xl font-serif text-4xl font-normal tracking-tight text-foreground md:text-6xl lg:text-7xl">
              <span className="text-balance">Know your renovation costs</span>{" "}
              <span className="text-[hsl(24_49%_26%)]">before you commit</span>
            </h1>
            
            {/* Subheadline */}
            <p className="mb-10 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Get accurate, region-specific refurbishment estimates for UK properties in seconds. 
              Trusted by property investors, developers, and homeowners.
            </p>
            
            {/* CTA Button */}
            <Button 
              size="lg" 
              className="h-12 gap-2 bg-[hsl(18_64%_46%)] px-8 text-base font-semibold text-white shadow-sm hover:bg-[hsl(18_64%_40%)]"
              onClick={() => document.getElementById("estimate-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              Get Your Free Estimate
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Trust Banner */}
      <section className="border-y border-[hsl(35_22%_80%)] bg-[hsl(40_26%_90%)] px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <TrustBanner />
        </div>
      </section>

      {/* Tools Section */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 font-serif text-3xl font-normal tracking-tight md:text-4xl">
              Calculators &amp; Tools
            </h2>
            <p className="text-muted-foreground">
              Everything you need to plan your property renovation with confidence.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.href} href={tool.href} className="group">
                  <Card className={`h-full transition-all duration-200 hover:border-accent hover:shadow-lg ${tool.featured ? "border-accent bg-accent/5" : ""}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tool.featured ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {tool.badge ? <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                            {tool.badge}
                          </span> : null}
                      </div>
                      <CardTitle className="mt-4 text-lg font-medium">{tool.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-sm leading-relaxed text-[hsl(30_6%_29%)]">
                        {tool.description}
                      </CardDescription>
                      <div className="mt-4 flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                        Open tool <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Auth Banner */}
      <section className="px-6">
        <div className="mx-auto max-w-6xl">
          <AuthBanner />
        </div>
      </section>

      {/* Estimate Form Section */}
      <section id="estimate-form" className="scroll-mt-20 px-6 py-16 md:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 font-serif text-3xl font-normal tracking-tight md:text-4xl">
              Quick Estimate
            </h2>
            <p className="text-muted-foreground">
              Enter your property details below to get an instant cost estimate.
            </p>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-6 md:p-8">
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
            </CardContent>
          </Card>

          {submitError ? <div className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{submitError}</p>
            </div> : null}
        </div>
      </section>

      {/* Results Section */}
      {result ? <section id="results" className="scroll-mt-20 bg-card px-6 py-16 md:py-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <h2 className="mb-2 font-serif text-2xl font-normal tracking-tight md:text-3xl">
                Your Estimate
              </h2>
              {lastInput ? <p className="text-muted-foreground">
                  {lastInput.totalAreaM2}m² {lastInput.propertyType} in {lastInput.region}
                  <span className="mx-2">·</span>
                  {lastInput.condition} condition
                  <span className="mx-2">·</span>
                  {lastInput.finishLevel} finish
                </p> : null}
            </div>

            {/* Action Buttons */}
            <div className="mb-8 flex flex-wrap justify-center gap-3">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setIsSaveModalOpen(true)}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Scenario
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void handleDownloadPdf()}
                disabled={isGeneratingPdf}
              >
                {isGeneratingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Download PDF
              </Button>
              <Button
                variant="outline"
                className="gap-2"
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
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => void handleShareEstimate()}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button
                variant="default"
                className="gap-2"
                onClick={handleNewEstimate}
              >
                New Estimate
              </Button>
            </div>

            <EstimateResults result={result} />
          </div>
        </section> : null}

      {/* Testimonials Section */}
      <section className="px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl">
          <TestimonialsSection />
        </div>
      </section>

      {/* Modals */}
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
    </div>
  );
}
