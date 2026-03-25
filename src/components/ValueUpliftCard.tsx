"use client";

import { useMemo, useState } from "react";

import { calculateUplift, type RefurbType } from "@/lib/valuationData";
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

type ValueUpliftCardProps = {
  refurbCost: number;
  postcode?: string;
  currentValue?: number;
  defaultRefurbType?: RefurbType;
};

const REFURB_TYPE_OPTIONS: Array<{ value: RefurbType; label: string }> = [
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "extension", label: "Extension" },
  { value: "loft", label: "Loft" },
];

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

export function ValueUpliftCard({
  refurbCost,
  postcode,
  currentValue,
  defaultRefurbType = "medium",
}: ValueUpliftCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentValueInput, setCurrentValueInput] = useState(
    currentValue ? String(currentValue) : "",
  );
  const [refurbType, setRefurbType] = useState<RefurbType>(defaultRefurbType);

  const parsedCurrentValue = useMemo(() => {
    const trimmed = currentValueInput.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }, [currentValueInput]);

  const validationMessage = useMemo(() => {
    if (!currentValueInput.trim()) {
      return "Enter the current property value to estimate the value impact.";
    }

    if (parsedCurrentValue === null || parsedCurrentValue <= 0) {
      return "Current value must be greater than 0.";
    }

    if (!Number.isFinite(refurbCost) || refurbCost < 0) {
      return "Refurb cost must be a valid non-negative number.";
    }

    return null;
  }, [currentValueInput, parsedCurrentValue, refurbCost]);

  const result = useMemo(() => {
    if (validationMessage || parsedCurrentValue === null) {
      return null;
    }

    try {
      return calculateUplift({
        currentValue: parsedCurrentValue,
        refurbCost,
        refurbType,
        postcode,
      });
    } catch {
      return null;
    }
  }, [validationMessage, parsedCurrentValue, refurbCost, refurbType, postcode]);

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
              <Label htmlFor="current-value">Current value</Label>
              <Input
                id="current-value"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                placeholder="e.g. 350000"
                value={currentValueInput}
                onChange={(event) => setCurrentValueInput(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="refurb-type">Refurb type</Label>
              <Select
                value={refurbType}
                onValueChange={(value) => setRefurbType(value as RefurbType)}
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
