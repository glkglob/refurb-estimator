"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Pencil } from "lucide-react";
import AdditionalCostsPanel from "@/components/AdditionalCostsPanel";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import RefineCategoryPanel, {
  type RefineCategorySavePayload
} from "@/components/RefineCategoryPanel";
import TermTooltip from "@/components/TermTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { REFINE_SCOPE, type RefineScopeCategory } from "@/lib/refineData";
import type { Condition, EstimateResult, FinishLevel } from "@/lib/types";

type EstimateResultsProps = {
  result: EstimateResult;
  condition?: Condition;
  finishLevel?: FinishLevel;
};

type RefinedCategoryRow = EstimateResult["categories"][number] & {
  refined: boolean;
  refineCategory: RefineScopeCategory | null;
  refinement?: RefineCategorySavePayload;
};

const DonutChart = dynamic(
  () => import("@tremor/react").then((module) => module.DonutChart),
  {
    ssr: false,
    loading: () => <div className="h-56 animate-pulse rounded bg-muted md:h-72" />
  }
);

const CHART_COLORS = [
  "blue",
  "amber",
  "cyan",
  "violet",
  "emerald",
  "blue",
  "amber",
  "cyan",
  "violet",
  "emerald",
  "blue",
  "amber"
];

function toRefineScopeCategory(category: string): RefineScopeCategory | null {
  if (category in REFINE_SCOPE) {
    return category as RefineScopeCategory;
  }

  return null;
}

function applyRefinementToCategory(
  category: EstimateResult["categories"][number],
  refinement: RefineCategorySavePayload | undefined
): Pick<EstimateResult["categories"][number], "low" | "typical" | "high"> {
  if (!refinement) {
    return {
      low: category.low,
      typical: category.typical,
      high: category.high
    };
  }

  const refinedTypical = Math.max(0, refinement.refinedTotal);

  if (category.typical <= 0) {
    return {
      low: refinedTypical,
      typical: refinedTypical,
      high: refinedTypical
    };
  }

  const multiplier = refinedTypical / category.typical;
  return {
    low: Math.max(0, Math.round(category.low * multiplier)),
    typical: refinedTypical,
    high: Math.max(0, Math.round(category.high * multiplier))
  };
}

export default function EstimateResults({
  result,
  condition = "fair",
  finishLevel = "standard"
}: EstimateResultsProps) {
  const [activeRefineCategory, setActiveRefineCategory] = useState<RefineScopeCategory | null>(null);
  const [refinements, setRefinements] = useState<
    Partial<Record<RefineScopeCategory, RefineCategorySavePayload>>
  >({});

  const gbpFormatter = useMemo(() => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0
    });
  }, []);

  const refinedCategories = useMemo<RefinedCategoryRow[]>(() => {
    return result.categories.map((category) => {
      const refineCategory = toRefineScopeCategory(category.category);
      const refinement = refineCategory ? refinements[refineCategory] : undefined;
      const applied = applyRefinementToCategory(category, refinement);

      return {
        ...category,
        ...applied,
        refined: Boolean(refinement),
        refinement,
        refineCategory
      };
    });
  }, [refinements, result.categories]);

  const refinedTotals = useMemo(() => {
    return refinedCategories.reduce(
      (accumulator, category) => {
        return {
          low: accumulator.low + category.low,
          typical: accumulator.typical + category.typical,
          high: accumulator.high + category.high
        };
      },
      { low: 0, typical: 0, high: 0 }
    );
  }, [refinedCategories]);

  const estimatedAreaM2 = useMemo(() => {
    if (result.costPerM2.typical > 0) {
      return result.totalTypical / result.costPerM2.typical;
    }

    return 0;
  }, [result.costPerM2.typical, result.totalTypical]);

  const refinedCostPerM2 = useMemo(() => {
    if (estimatedAreaM2 <= 0) {
      return {
        low: result.costPerM2.low,
        typical: result.costPerM2.typical,
        high: result.costPerM2.high
      };
    }

    return {
      low: refinedTotals.low / estimatedAreaM2,
      typical: refinedTotals.typical / estimatedAreaM2,
      high: refinedTotals.high / estimatedAreaM2
    };
  }, [estimatedAreaM2, refinedTotals.high, refinedTotals.low, refinedTotals.typical, result.costPerM2.high, result.costPerM2.low, result.costPerM2.typical]);

  const summaryCards = [
    {
      label: "Low",
      total: refinedTotals.low,
      perM2: refinedCostPerM2.low,
      className: "flex-1 border-l-4 border-l-emerald-400 shadow-sm"
    },
    {
      label: "Typical",
      total: refinedTotals.typical,
      perM2: refinedCostPerM2.typical,
      className: "flex-1 border-l-4 border-l-primary bg-primary/5 shadow-md",
      recommended: true
    },
    {
      label: "High",
      total: refinedTotals.high,
      perM2: refinedCostPerM2.high,
      className: "flex-1 border-l-4 border-l-amber-400 shadow-sm"
    }
  ];

  const donutData = refinedCategories
    .filter((category) => category.typical > 0)
    .map((category) => ({
      name: category.category.charAt(0).toUpperCase() + category.category.slice(1),
      value: category.typical
    }));

  function handleSaveRefinement(payload: RefineCategorySavePayload): void {
    setRefinements((previous) => ({
      ...previous,
      [payload.categoryName]: payload
    }));
    setActiveRefineCategory(null);
  }

  function renderCategoryLabel(category: string) {
    if (category === "contingency") {
      return (
        <TermTooltip
          term="Contingency"
          explanation="A buffer (typically 5–10%) for unexpected costs during the refurbishment."
        />
      );
    }

    if (category === "fees") {
      return (
        <TermTooltip
          term="Fees"
          explanation="Professional fees including architect, surveyor, structural engineer, and building control."
        />
      );
    }

    return <span className="capitalize">{category}</span>;
  }

  return (
    <section className="space-y-6">
      <div className="overflow-x-auto">
        <div className="flex snap-x snap-mandatory gap-4 md:overflow-visible">
          {summaryCards.map((card) => (
            <Card
              key={card.label}
              className={`${card.className} min-w-[280px] snap-start md:min-w-0`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center text-sm font-medium text-muted-foreground">
                  {card.label}
                  {card.recommended ? (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Recommended
                    </Badge>
                  ) : null}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xl font-semibold font-mono sm:text-2xl">
                  <CurrencyDisplay amount={card.total} />
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Cost per m²:</span>{" "}
                  <CurrencyDisplay amount={card.perM2} /> <span className="font-mono">/m²</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <DonutChart
              data={donutData}
              category="value"
              index="name"
              colors={CHART_COLORS}
              valueFormatter={(value) => gbpFormatter.format(value)}
              label={gbpFormatter.format(refinedTotals.typical)}
              showLabel
              showTooltip
              className="h-56 md:h-72 [&_.tremor-base]:bg-transparent [&_[role='tooltip']]:border-border [&_[role='tooltip']]:bg-card [&_[role='tooltip']]:text-foreground"
            />
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {donutData.map((item, i) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="overflow-x-auto space-y-2 p-0">
          <p className="px-4 pt-4 text-xs text-muted-foreground">
            Includes{" "}
            <TermTooltip
              term="Contingency"
              explanation="A buffer (typically 5–10%) for unexpected costs during the refurbishment."
            />{" "}
            and{" "}
            <TermTooltip
              term="Fees"
              explanation="Professional fees including architect, surveyor, structural engineer, and building control."
            />
            .
          </p>
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="px-4">Category</TableHead>
                <TableHead className="px-4">Low</TableHead>
                <TableHead className="px-4 font-semibold text-foreground">Typical</TableHead>
                <TableHead className="px-4">High</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refinedCategories.map((category, index) => (
                <TableRow
                  key={category.category}
                  className={
                    index % 2 === 0 ? "bg-card hover:bg-muted/40" : "bg-muted/20 hover:bg-muted/40"
                  }
                >
                  <TableCell className="px-4 font-medium">
                    <div className="flex items-center justify-between gap-2">
                      <span>{renderCategoryLabel(category.category)}</span>
                      {category.refineCategory ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Refine ${category.category} category`}
                          onClick={() => setActiveRefineCategory(category.refineCategory)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <CurrencyDisplay amount={category.low} />
                  </TableCell>
                  <TableCell className="px-4">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <CurrencyDisplay amount={category.typical} />
                      {category.refined ? (
                        <Badge className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300">
                          Refined
                        </Badge>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="px-4">
                    <CurrencyDisplay amount={category.high} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdditionalCostsPanel buildCost={refinedTotals.typical} />

      {activeRefineCategory ? (
        <RefineCategoryPanel
          categoryName={activeRefineCategory}
          autoEstimate={refinedCategories.find((category) => category.category === activeRefineCategory)?.typical ?? 0}
          condition={condition}
          finishLevel={finishLevel}
          onSave={handleSaveRefinement}
          onClose={() => setActiveRefineCategory(null)}
        />
      ) : null}
    </section>
  );
}
