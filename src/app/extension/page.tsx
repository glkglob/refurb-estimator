"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle } from "lucide-react";

import CurrencyDisplay from "@/components/CurrencyDisplay";
import { ValueUpliftCard } from "@/components/ValueUpliftCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  calculateExtensionEstimate,
  type ExtensionEstimatorInput,
  type ExtensionEstimatorResult,
  type ExtensionFinishLevel,
  type ExtensionType,
} from "@/lib/extensionEstimator";

const EXTENSION_TYPE_OPTIONS: Array<{ value: ExtensionType; label: string }> = [
  { value: "single_storey_rear", label: "Single storey rear" },
  { value: "double_storey_rear", label: "Double storey rear" },
  { value: "side_return", label: "Side return" },
  { value: "wrap_around", label: "Wrap-around (L-shape)" },
];

const FINISH_LEVEL_OPTIONS: Array<{
  value: ExtensionFinishLevel;
  label: string;
  helper: string;
}> = [
  {
    value: "basic",
    label: "Basic",
    helper: "Functional builder’s finish, cost-focused choices.",
  },
  {
    value: "standard",
    label: "Standard",
    helper: "Mid-range fittings and common specifications.",
  },
  {
    value: "premium",
    label: "Premium",
    helper: "High-spec / bespoke finishes and details.",
  },
];

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ExtensionPage() {
  const [extensionType, setExtensionType] =
    useState<ExtensionType>("single_storey_rear");
  const [finishLevel, setFinishLevel] =
    useState<ExtensionFinishLevel>("standard");

  // Slider not currently used elsewhere; use numeric input to keep consistent with repo.
  const [floorAreaM2, setFloorAreaM2] = useState("25");
  const [postcodeDistrict, setPostcodeDistrict] = useState("");

  const [includeKitchen, setIncludeKitchen] = useState(false);
  const [includeBifolds, setIncludeBifolds] = useState(false);
  const [includeUnderfloorHeating, setIncludeUnderfloorHeating] =
    useState(false);

  const [result, setResult] = useState<ExtensionEstimatorResult | null>(null);
  const [lastInput, setLastInput] = useState<ExtensionEstimatorInput | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const finishHelper = useMemo(
    () =>
      FINISH_LEVEL_OPTIONS.find((o) => o.value === finishLevel)?.helper ?? "",
    [finishLevel],
  );

  useEffect(() => {
    if (result) {
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [result]);

  function buildInput(): ExtensionEstimatorInput | null {
    const areaValue = parseNumber(floorAreaM2);

    if (!areaValue || areaValue <= 0) {
      setError("Floor area must be greater than zero");
      return null;
    }

    if (areaValue < 10 || areaValue > 80) {
      setError("Floor area must be between 10 and 80m²");
      return null;
    }

    if (postcodeDistrict.trim().length === 0) {
      setError("Postcode district is required");
      return null;
    }

    return {
      extensionType,
      floorAreaM2: areaValue,
      finishLevel,
      postcodeDistrict: postcodeDistrict.trim().toUpperCase(),
      includeKitchen,
      includeBifolds,
      includeUnderfloorHeating,
    };
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const input = buildInput();
    if (!input) return;

    try {
      const estimate = calculateExtensionEstimate(input);
      setResult(estimate);
      setLastInput(input);
    } catch (submitError) {
      setResult(null);
      setLastInput(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to calculate estimate",
      );
    }
  }

  function handleReset() {
    setExtensionType("single_storey_rear");
    setFinishLevel("standard");
    setFloorAreaM2("25");
    setPostcodeDistrict("");
    setIncludeKitchen(false);
    setIncludeBifolds(false);
    setIncludeUnderfloorHeating(false);
    setResult(null);
    setLastInput(null);
    setError(null);
    document.getElementById("extension-form")?.scrollIntoView({
      behavior: "smooth",
    });
  }

  const summaryCards = result
    ? [
        {
          label: "Low",
          total: result.totalLow,
          perM2: result.costPerM2.low,
          className: "flex-1 border-l-4 border-l-emerald-400 shadow-sm",
        },
        {
          label: "Typical",
          total: result.totalTypical,
          perM2: result.costPerM2.typical,
          className: "flex-1 border-l-4 border-l-primary bg-primary/5 shadow-md",
          recommended: true,
        },
        {
          label: "High",
          total: result.totalHigh,
          perM2: result.costPerM2.high,
          className: "flex-1 border-l-4 border-l-amber-400 shadow-sm",
        },
      ]
    : [];

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Extension Cost Calculator
      </h1>

      <p className="text-sm text-muted-foreground">
        Estimate the cost of a rear/side extension including finish level, key
        options, and regional pricing.
      </p>

      <Card id="extension-form">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Extension type</Label>
                <Select
                  value={extensionType}
                  onValueChange={(value) =>
                    setExtensionType(value as ExtensionType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select extension type" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTENSION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Finish level</Label>
                <Select
                  value={finishLevel}
                  onValueChange={(value) =>
                    setFinishLevel(value as ExtensionFinishLevel)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select finish level" />
                  </SelectTrigger>
                  <SelectContent>
                    {FINISH_LEVEL_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{finishHelper}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="extension-area">Floor area (m²)</Label>
                <Input
                  id="extension-area"
                  type="number"
                  min={10}
                  max={80}
                  step={1}
                  placeholder="e.g. 25"
                  value={floorAreaM2}
                  onChange={(event) => setFloorAreaM2(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Range: 10–80m²
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="extension-postcode">Postcode district</Label>
                <Input
                  id="extension-postcode"
                  type="text"
                  maxLength={8}
                  placeholder="e.g. SW1A"
                  value={postcodeDistrict}
                  onChange={(event) =>
                    setPostcodeDistrict(event.target.value.toUpperCase())
                  }
                />
                <p className="text-xs text-muted-foreground">
                  For regional pricing
                </p>
              </div>
            </div>

            <Card className="border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Options
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                    checked={includeKitchen}
                    onChange={(event) => setIncludeKitchen(event.target.checked)}
                  />
                  <span>Include new kitchen</span>
                </label>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                    checked={includeBifolds}
                    onChange={(event) => setIncludeBifolds(event.target.checked)}
                  />
                  <span>Bifold / sliding doors</span>
                </label>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary"
                    checked={includeUnderfloorHeating}
                    onChange={(event) =>
                      setIncludeUnderfloorHeating(event.target.checked)
                    }
                  />
                  <span>Underfloor heating</span>
                </label>
              </CardContent>
            </Card>

            {error ? (
              <div className="bp-warning flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="font-medium text-destructive">{error}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="default">
                Calculate estimate
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                New estimate
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {result ? (
        <div id="results" className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row">
            {summaryCards.map((card) => (
              <Card key={card.label} className={card.className}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                    {card.label}
                    {"recommended" in card && (card as any).recommended ? (
                      <Badge variant="secondary" className="ml-2 text-[10px]">
                        Recommended
                      </Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="whitespace-nowrap text-2xl font-semibold font-mono">
                    <CurrencyDisplay amount={card.total} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Cost per m²:
                    </span>{" "}
                    <CurrencyDisplay amount={card.perM2} />{" "}
                    <span className="font-mono">/m²</span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Timeline & planning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Timeline:</span>{" "}
                <span className="font-medium">{result.timeline}</span>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Planning note:</span>
                <p className="text-sm">{result.planningNote}</p>
              </div>
            </CardContent>
          </Card>

          {result.adjustments.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Options included</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {result.adjustments.map((adj) => (
                  <div key={adj.label} className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {adj.label}
                      </span>
                      <span className="text-sm text-foreground font-mono">
                        <CurrencyDisplay amount={adj.amount} />
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{adj.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Project details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">Extension type:</span>{" "}
                <span className="font-mono">{result.metadata.extensionType}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Finish level:</span>{" "}
                <span className="font-mono">{result.metadata.finishLevel}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Area:</span>{" "}
                <span className="font-mono">{result.metadata.floorAreaM2}m²</span>
              </div>
              <div>
                <span className="text-muted-foreground">Postcode:</span>{" "}
                <span className="font-mono">{result.metadata.postcodeDistrict}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Region:</span>{" "}
                {result.region}
              </div>
            </CardContent>
          </Card>

          <ValueUpliftCard
            refurbCost={result.totalTypical}
            postcode={lastInput?.postcodeDistrict}
            defaultRefurbType="extension"
          />

          <div className="flex">
            <Button asChild variant="default">
              <a href="/tradespeople">Get quotes from contractors →</a>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
