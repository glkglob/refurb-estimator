import AdditionalCostsPanel from "@/components/AdditionalCostsPanel";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import dynamic from "next/dynamic";
import TermTooltip from "@/components/TermTooltip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import type { EstimateResult } from "@/lib/types";

type EstimateResultsProps = {
  result: EstimateResult;
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

export default function EstimateResults({ result }: EstimateResultsProps) {
  const gbpFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  });

  const summaryCards = [
    {
      label: "Low",
      total: result.totalLow,
      perM2: result.costPerM2.low,
      className: "flex-1 border-l-4 border-l-emerald-400 shadow-sm"
    },
    {
      label: "Typical",
      total: result.totalTypical,
      perM2: result.costPerM2.typical,
      className: "flex-1 border-l-4 border-l-primary bg-primary/5 shadow-md",
      recommended: true
    },
    {
      label: "High",
      total: result.totalHigh,
      perM2: result.costPerM2.high,
      className: "flex-1 border-l-4 border-l-amber-400 shadow-sm"
    }
  ];
  const donutData = result.categories
    .filter((category) => category.typical > 0)
    .map((category) => ({
      name: category.category.charAt(0).toUpperCase() + category.category.slice(1),
      value: category.typical
    }));

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
      <div className="flex flex-col gap-4 md:flex-row">
        {summaryCards.map((card) => (
          <Card key={card.label} className={card.className}>
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

      <Card className="bp-card-border bg-card">
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
              label={gbpFormatter.format(result.totalTypical)}
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
              {result.categories.map((category, index) => (
                <TableRow
                  key={category.category}
                  className={
                    index % 2 === 0 ? "bg-card hover:bg-muted/40" : "bg-muted/20 hover:bg-muted/40"
                  }
                >
                  <TableCell className="px-4 font-medium">
                    {renderCategoryLabel(category.category)}
                  </TableCell>
                  <TableCell className="px-4">
                    <CurrencyDisplay amount={category.low} />
                  </TableCell>
                  <TableCell className="px-4">
                    <span className="font-medium">
                      <CurrencyDisplay amount={category.typical} />
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
          <AdditionalCostsPanel buildCost={result.totalTypical} />
</section>
  );
}
