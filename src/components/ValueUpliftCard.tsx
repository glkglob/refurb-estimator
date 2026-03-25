"use client";

import { useMemo, useState } from "react";

import { calculateUplift, type RefurbType } from "@/lib/valuationData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ValueUpliftCardProps = {
  refurbCost: number;
  postcode?: string;

  // Required + controlled by parent
  currentValue: number;
  refurbType: RefurbType;

  // Required change handlers (to keep inputs editable)
  onCurrentValueChange: (nextValue: number) => void;
  onRefurbTypeChange: (nextValue: RefurbType) => void;
};

const REFURB_TYPE_OPTIONS: Array<{ value: RefurbType; label: string }> = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "extension", label: "Extension" },
  { value: "loft", label: "Loft" },
];

export function ValueUpliftCard({
  refurbCost,
  postcode,
  currentValue,
  refurbType,
  onCurrentValueChange,
  onRefurbTypeChange,
}: ValueUpliftCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(0)}%`;
  }

  const result = useMemo(() => {
    try {
      return calculateUplift({
        currentValue,
        refurbCost,
        refurbType,
      });
    } catch {
      return null;
    }
  }, [currentValue, refurbCost, refurbType]);

  const validationMessage = useMemo(() => {
    if (!Number.isFinite(currentValue) || currentValue <= 0) {
      return "Current value must be greater than 0.";
    }

    if (!Number.isFinite(refurbCost) || refurbCost < 0) {
      return "Refurb cost must be a valid non-negative number.";
    }

    return null;
  }, [currentValue, refurbCost]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Value uplift</CardTitle>
            <p className="text-sm text-muted-foreground">
              Estimate the potential value impact of this refurb.
              {postcode ? ` Postcode: ${postcode}.` : ""}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded ? "Hide value impact" : "Show value impact"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded ? (
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="current-value"
                className="text-sm font-medium text-foreground"
              >
                Current value
              </label>
              <Input
                id="current-value"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="e.g. 350000"
                value={Number.isFinite(currentValue) ? String(currentValue) : ""}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  onCurrentValueChange(next);
                }}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="refurb-type"
                className="text-sm font-medium text-foreground"
              >
                Refurb type
              </label>
              <Select
                value={refurbType}
                onValueChange={(value) => onRefurbTypeChange(value as RefurbType)}
              >
                <SelectTrigger id="refurb-type">
                  <SelectValue placeholder="Select refurb type" />
                </SelectTrigger>
                <SelectContent>
                  {REFURB_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                Refurb cost
              </span>
              <span className="text-sm font-semibold text-foreground">
                {formatCurrency(refurbCost)}
              </span>
            </div>

            {validationMessage ? (
              <p className="text-sm text-muted-foreground">{validationMessage}</p>
            ) : result ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Estimated uplift
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(result.upliftMin)} –{" "}
                    {formatCurrency(result.upliftMax)}
                  </p>
                </div>

                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    New estimated value
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatCurrency(result.newValueMin)} –{" "}
                    {formatCurrency(result.newValueMax)}
                  </p>
                </div>

                <div className="rounded-md border bg-background p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Estimated ROI
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {formatPercent(result.roiMin)} – {formatPercent(result.roiMax)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Unable to calculate uplift for the provided inputs.
              </p>
            )}
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Disclaimer: This is an indicative valuation range only. Actual uplift
            depends on specification, layout, local demand, planning constraints,
            and sale execution. It is not a formal valuation or financial advice.
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
