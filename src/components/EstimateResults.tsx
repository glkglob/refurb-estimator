import CurrencyDisplay from "@/components/CurrencyDisplay";
import { DonutChart } from "@tremor/react";
import TermTooltip from "@/components/TermTooltip";
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

export default function EstimateResults({ result }: EstimateResultsProps) {
  const gbpFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  });

  const summaryCards = [
    { label: "Low", total: result.totalLow, perM2: result.costPerM2.low },
    { label: "Typical", total: result.totalTypical, perM2: result.costPerM2.typical },
    { label: "High", total: result.totalHigh, perM2: result.costPerM2.high }
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
          <Card key={card.label} className="flex-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-semibold">
                <CurrencyDisplay amount={card.total} />
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Cost per m²:</span>{" "}
                <CurrencyDisplay amount={card.perM2} /> /m²
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <DonutChart
            data={donutData}
            category="value"
            index="name"
            colors={[
              "teal",
              "cyan",
              "blue",
              "indigo",
              "slate",
              "emerald",
              "amber",
              "violet",
              "rose",
              "zinc",
              "lime",
              "orange"
            ]}
            valueFormatter={(value) => gbpFormatter.format(value)}
            label={gbpFormatter.format(result.totalTypical)}
            showLabel
            className="h-56 md:h-72"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="px-4">
                  <span className="inline-flex items-center gap-2">
                    Category
                    <span className="inline-flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      <TermTooltip
                        term="Contingency"
                        explanation="A buffer (typically 5–10%) for unexpected costs during the refurbishment."
                      />
                      <TermTooltip
                        term="Fees"
                        explanation="Professional fees including architect, surveyor, structural engineer, and building control."
                      />
                    </span>
                  </span>
                </TableHead>
                <TableHead className="px-4">Low</TableHead>
                <TableHead className="px-4">Typical</TableHead>
                <TableHead className="px-4">High</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
            {result.categories.map((category, index) => (
                <TableRow key={category.category} className={index % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <TableCell className="px-4 font-medium">
                  {renderCategoryLabel(category.category)}
                  </TableCell>
                  <TableCell className="px-4">
                  <CurrencyDisplay amount={category.low} />
                  </TableCell>
                  <TableCell className="px-4">
                  <CurrencyDisplay amount={category.typical} />
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
    </section>
  );
}
