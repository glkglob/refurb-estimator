"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TermTooltip from "@/components/TermTooltip";

type AdditionalCostsPanelProps = {
  buildCost?: number; // optional — used to calculate %-based fees
};

const ADDITIONAL_COSTS = [
  {
    label: "Architect / designer fees",
    range: "5–12% of build cost",
    tooltip: "Required for extensions, loft conversions, and full refurbs. Fees typically range from 5% for basic drawings to 12% for full project management.",
    isPercentage: true,
    minPct: 0.05,
    maxPct: 0.12,
  },
  {
    label: "Planning application fee",
    range: "£258 (householder) / £578 (larger works)",
    tooltip: "Fixed fee payable to your local planning authority. £258 for standard householder applications (extensions, loft conversions). £578+ for larger or commercial works.",
    isPercentage: false,
  },
  {
    label: "Structural engineer",
    range: "£500 – £1,500",
    tooltip: "Required for load-bearing wall removals, extensions, and loft conversions. Provides structural calculations needed by building control.",
    isPercentage: false,
  },
  {
    label: "Party wall surveyor",
    range: "£800 – £2,000 (if applicable)",
    tooltip: "Required if your works affect a shared wall with a neighbour. Each neighbour may appoint their own surveyor, doubling costs. Only applies to semi-detached or terraced properties.",
    isPercentage: false,
  },
  {
    label: "Building control / building regulations",
    range: "£500 – £1,200",
    tooltip: "Mandatory for structural works, extensions, loft conversions, and new electrical or plumbing installations. Covers plan check and site inspection fees.",
    isPercentage: false,
  },
  {
    label: "Contingency (recommended)",
    range: "10–15% of build cost",
    tooltip: "A buffer for unexpected costs — hidden defects, price rises, scope changes. Industry standard is 10% for straightforward projects and 15%+ for older properties.",
    isPercentage: true,
    minPct: 0.10,
    maxPct: 0.15,
  },
];

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export default function AdditionalCostsPanel({ buildCost }: AdditionalCostsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="shadow-sm border-amber-500/30 bg-card">
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setIsOpen((prev) => !prev)}
        role="button"
        aria-expanded={isOpen}
        aria-controls="additional-costs-content"
      >
        <CardTitle className="flex items-center justify-between text-sm font-semibold text-amber-400">
          <span className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            Additional costs not included in this estimate
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
        </CardTitle>
      </CardHeader>

      {isOpen && (
        <CardContent
          id="additional-costs-content"
          className="space-y-3 pt-0"
        >
          <div className="divide-y divide-border rounded-md border border-border">
            {ADDITIONAL_COSTS.map((item) => {
              const derivedRange =
                item.isPercentage && buildCost && item.minPct && item.maxPct
                  ? `${gbp.format(buildCost * item.minPct)} – ${gbp.format(buildCost * item.maxPct)} (${item.range})`
                  : item.range;

              return (
                <div
                  key={item.label}
                  className="flex flex-col gap-0.5 px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-medium text-foreground">
                    <TermTooltip term={item.label} explanation={item.tooltip} />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground sm:text-right">
                    {derivedRange}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            These costs are not included in the estimate above. Figures are typical UK ranges for
            guidance only. Always obtain professional quotes before committing to a project.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
