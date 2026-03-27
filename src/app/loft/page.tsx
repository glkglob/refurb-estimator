"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import { AlertTriangle, Home, Mountain, PanelsTopLeft, Ruler } from "lucide-react";

import { ValueUpliftCard } from "@/components/ValueUpliftCard";
import { Button } from "@/components/ui/button";
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
import { calculateLoftEstimate } from "@/lib/loftEstimator";
import type { LoftConversionType, LoftFinishLevel } from "@/lib/types";

const CONVERSION_OPTIONS: Array<{ value: LoftConversionType; label: string; icon: ComponentType<{ className?: string }> }> = [
  { value: "rooflight", label: "Rooflight / Velux", icon: PanelsTopLeft },
  { value: "dormer", label: "Dormer", icon: Home },
  { value: "hip_to_gable", label: "Hip-to-gable", icon: Ruler },
  { value: "mansard", label: "Mansard", icon: Mountain },
];

const FINISH_OPTIONS: Array<{ value: LoftFinishLevel; label: string; helper: string }> = [
  { value: "basic", label: "Basic", helper: "Essential finishes" },
  { value: "standard", label: "Standard", helper: "Good quality finishes" },
  { value: "premium", label: "Premium", helper: "Higher-spec finishes" },
];

const PROPERTY_PRESETS = [
  { value: "terraced", label: "Terraced", area: 20 },
  { value: "semi", label: "Semi-detached", area: 25 },
  { value: "detached", label: "Detached", area: 35 },
];

type LoftResultState = ReturnType<typeof calculateLoftEstimate> | null;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function LoftPage() {
  const [conversionType, setConversionType] = useState<LoftConversionType>("rooflight");
  const [finishLevel, setFinishLevel] = useState<LoftFinishLevel>("standard");
  const [propertyType, setPropertyType] = useState(PROPERTY_PRESETS[0].value);
  const [area, setArea] = useState<number>(PROPERTY_PRESETS[0].area);
  const [postcode, setPostcode] = useState("");
  const [ensuite, setEnsuite] = useState(false);
  const [juliet, setJuliet] = useState(false);
  const { result, error } = useMemo<{ result: LoftResultState; error: string | null }>(() => {
    if (!postcode.trim()) {
      return { result: null, error: "Enter a postcode district to calculate an estimate." };
    }

    try {
      const next = calculateLoftEstimate({
        postcodeDistrict: postcode.trim().toUpperCase(),
        totalAreaM2: area,
        conversionType,
        finishLevel,
        addOns: { ensuite, juliet },
      });
      return { result: next, error: null };
    } catch (err) {
      return {
        result: null,
        error: err instanceof Error ? err.message : "Unable to calculate estimate",
      };
    }
  }, [postcode, area, conversionType, finishLevel, ensuite, juliet]);

  const finishHelper = useMemo(
    () => FINISH_OPTIONS.find((option) => option.value === finishLevel)?.helper ?? "",
    [finishLevel],
  );

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Loft conversion calculator</h1>
        <p className="text-sm text-muted-foreground">
          Quick, banded estimate with regional multiplier, flat add-ons, and planning notes for each conversion type.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="conversion-type">Conversion type</Label>
                <Select
                  value={conversionType}
                  onValueChange={(value) => setConversionType(value as LoftConversionType)}
                >
                  <SelectTrigger id="conversion-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONVERSION_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="inline-flex items-center gap-2">
                            <Icon className="size-4" />
                            {option.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="finish-level">Finish level</Label>
                <Select
                  value={finishLevel}
                  onValueChange={(value) => setFinishLevel(value as LoftFinishLevel)}
                >
                  <SelectTrigger id="finish-level">
                    <SelectValue placeholder="Select finish" />
                  </SelectTrigger>
                  <SelectContent>
                    {FINISH_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="inline-flex items-center gap-2">
                          {option.label}
                          <span className="text-xs text-muted-foreground">{option.helper}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{finishHelper}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="property-type">Property type (sets area)
                </Label>
                <Select
                  value={propertyType}
                  onValueChange={(value) => {
                    const match = PROPERTY_PRESETS.find((item) => item.value === value);
                    if (match) {
                      setPropertyType(value);
                      setArea(match.area);
                    }
                  }}
                >
                  <SelectTrigger id="property-type">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_PRESETS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label} · ~{option.area}m² loft area
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">You can override the area manually below.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode district</Label>
                <Input
                  id="postcode"
                  placeholder="e.g. SW1A"
                  value={postcode}
                  onChange={(event) => setPostcode(event.target.value)}
                  autoComplete="postal-code"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="area-slider">Usable loft area</Label>
                  <p className="text-xs text-muted-foreground">15–50 m² typical range</p>
                </div>
                <Input
                  id="area-input"
                  type="number"
                  min={15}
                  max={50}
                  step={1}
                  className="w-24"
                  value={area}
                  onChange={(event) => setArea(Number(event.target.value) || 0)}
                />
              </div>
              <input
                id="area-slider"
                type="range"
                min={15}
                max={50}
                step={1}
                value={area}
                onChange={(event) => setArea(Number(event.target.value))}
                className="touch-range w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15 m²</span>
                <span>50 m²</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Button
                type="button"
                variant={ensuite ? "default" : "outline"}
                onClick={() => setEnsuite((prev) => !prev)}
              >
                Ensuite
              </Button>
              <Button
                type="button"
                variant={juliet ? "default" : "outline"}
                onClick={() => setJuliet((prev) => !prev)}
              >
                Juliet balcony / dormer window
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Estimate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4" />
                <p>{error}</p>
              </div>
            ) : null}

            {result ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <SummaryCard title="Low" value={formatCurrency(result.totalLow)} />
                  <SummaryCard title="Typical" value={formatCurrency(result.totalTypical)} highlight />
                  <SummaryCard title="High" value={formatCurrency(result.totalHigh)} />
                </div>

                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Timeline: {result.timeline}</p>
                  <p className="mt-1">{result.planningNote}</p>
                  <p className="mt-2 text-xs">Region: {result.region}</p>
                </div>

                {result.adjustments.length ? (
                  <div className="rounded-lg border bg-background p-3">
                    <p className="text-sm font-medium text-foreground">Add-ons</p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {result.adjustments.map((item) => (
                        <li key={item.label} className="flex items-center justify-between gap-3">
                          <span>{item.label}</span>
                          <span className="font-medium text-foreground">{formatCurrency(item.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href="/tradespeople">Find tradespeople</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/new-build">New build calculator</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Enter a postcode to see your estimate.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {result ? (
        <ValueUpliftCard refurbCost={result.totalTypical} postcode={postcode} defaultRefurbType="loft" />
      ) : null}
    </section>
  );
}

function SummaryCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/60 shadow-sm" : undefined}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
