"use client";

import CurrencyDisplay from "@/components/CurrencyDisplay";
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
import type { NewBuildCategory, NewBuildResult } from "@/lib/types";

type NewBuildResultsProps = {
  result: NewBuildResult;
};

const CATEGORY_LABELS: Record<NewBuildCategory, string> = {
  substructure: "Substructure & foundations",
  superstructure: "Superstructure",
  external_envelope: "External envelope",
  windows_and_doors: "Windows & doors",
  internal_finishes: "Internal finishes",
  kitchen: "Kitchen",
  bathrooms: "Bathrooms",
  electrics: "Electrics",
  plumbing_and_heating: "Plumbing & heating",
  external_works: "External works",
  preliminaries: "Preliminaries",
  contingency: "Contingency",
  professional_fees: "Professional fees"
};

export default function NewBuildResults({ result }: NewBuildResultsProps) {
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

  const costPerUnit = result.metadata.costPerUnit;
  const costPerLettableRoom = result.metadata.costPerLettableRoom;
  const estimatedAt = new Date(result.metadata.estimatedAt);
  const formattedDate = Number.isNaN(estimatedAt.getTime())
    ? result.metadata.estimatedAt
    : estimatedAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });

  function renderCategoryLabel(category: NewBuildCategory) {
    if (category === "contingency") {
      return (
        <TermTooltip
          term="Contingency"
          explanation="A buffer (typically 5–12%) for unexpected costs during construction."
        />
      );
    }

    if (category === "professional_fees") {
      return (
        <TermTooltip
          term="Professional fees"
          explanation="Architect, structural engineer, building control, and warranty fees."
        />
      );
    }

    return <span>{CATEGORY_LABELS[category]}</span>;
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
              <p className="whitespace-nowrap text-2xl font-semibold font-mono">
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

      {costPerUnit ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cost per unit
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Low:</span>{" "}
              <CurrencyDisplay amount={costPerUnit.low} />
            </div>
            <div>
              <span className="text-muted-foreground">Typical:</span>{" "}
              <CurrencyDisplay amount={costPerUnit.typical} />
            </div>
            <div>
              <span className="text-muted-foreground">High:</span>{" "}
              <CurrencyDisplay amount={costPerUnit.high} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {costPerLettableRoom ? (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cost per lettable room
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Low:</span>{" "}
              <CurrencyDisplay amount={costPerLettableRoom.low} />
            </div>
            <div>
              <span className="text-muted-foreground">Typical:</span>{" "}
              <CurrencyDisplay amount={costPerLettableRoom.typical} />
            </div>
            <div>
              <span className="text-muted-foreground">High:</span>{" "}
              <CurrencyDisplay amount={costPerLettableRoom.high} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table className="min-w-[760px]">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="px-4">Stage</TableHead>
                <TableHead className="px-4">Low</TableHead>
                <TableHead className="px-4 font-semibold text-foreground">
                  Typical
                </TableHead>
                <TableHead className="px-4">High</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.categories.map((category, index) => (
                <TableRow
                  key={category.category}
                  className={
                    index % 2 === 0
                      ? "bg-card hover:bg-muted/40"
                      : "bg-muted/20 hover:bg-muted/40"
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

      {result.adjustments.length > 0 ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Adjustments & Add-ons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {result.adjustments.map((adjustment) => (
              <div key={adjustment.label} className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-foreground">
                    {adjustment.label}
                  </span>
                  <span className="text-sm text-foreground font-mono">
                    <CurrencyDisplay amount={adjustment.amount} />
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {adjustment.reason}
                </p>
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
            <span className="text-muted-foreground">Property type:</span>{" "}
            {result.metadata.propertyType.replace("_", " ")}
          </div>
          <div>
            <span className="text-muted-foreground">Specification:</span>{" "}
            {result.metadata.spec}
          </div>
          <div>
            <span className="text-muted-foreground">Bedrooms:</span>{" "}
            <span className="font-mono">{result.metadata.bedrooms}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Storeys:</span>{" "}
            <span className="font-mono">{result.metadata.storeys}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Postcode:</span>{" "}
            <span className="font-mono">{result.metadata.postcodeDistrict}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Region:</span> {result.region}
          </div>
          <div>
            <span className="text-muted-foreground">Estimated:</span>{" "}
            <span className="font-mono">{formattedDate}</span>
          </div>
          {result.metadata.numberOfUnits ? (
            <div>
              <span className="text-muted-foreground">Units:</span>{" "}
              <span className="font-mono">{result.metadata.numberOfUnits}</span>
            </div>
          ) : null}
          {result.metadata.numberOfLettableRooms ? (
            <div>
              <span className="text-muted-foreground">Lettable rooms:</span>{" "}
              <span className="font-mono">{result.metadata.numberOfLettableRooms}</span>
            </div>
          ) : null}
          {result.metadata.commercialType ? (
            <div>
              <span className="text-muted-foreground">Commercial type:</span>{" "}
              {result.metadata.commercialType}
            </div>
          ) : null}
          {result.metadata.fitOutLevel ? (
            <div>
              <span className="text-muted-foreground">Fit-out:</span>{" "}
              {result.metadata.fitOutLevel.replace("_", " ")}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
