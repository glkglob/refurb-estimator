"use client";

import { BarChart } from "@tremor/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AuthBanner from "@/components/AuthBanner";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import TermTooltip from "@/components/TermTooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { deleteScenario, loadScenarios } from "@/lib/dataService";
import type { Scenario } from "@/lib/types";

function formatRoi(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ScenariosPage() {
  const gbpFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  });
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scenarioToDelete, setScenarioToDelete] = useState<Scenario | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const loaded = await loadScenarios();
        if (!isMounted) {
          return;
        }

        setScenarios(loaded);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const fallbackData =
          error && typeof error === "object" && "fallbackData" in error
            ? ((error as { fallbackData?: Scenario[] }).fallbackData ?? [])
            : [];
        setScenarios(fallbackData);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load scenarios from cloud. Showing local data."
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const sortedScenarios = useMemo(
    () =>
      [...scenarios].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [scenarios]
  );
  const scenarioCostChartData = useMemo(
    () =>
      sortedScenarios.map((scenario) => ({
        name: scenario.name,
        Low: scenario.result.totalLow,
        Typical: scenario.result.totalTypical,
        High: scenario.result.totalHigh
      })),
    [sortedScenarios]
  );
  const investmentChartData = useMemo(
    () =>
      sortedScenarios
        .filter(
          (scenario) =>
            typeof scenario.purchasePrice === "number" && typeof scenario.gdv === "number"
        )
        .map((scenario) => {
          const purchase = scenario.purchasePrice as number;
          const gdv = scenario.gdv as number;
          const refurbCost = scenario.result.totalTypical;
          const profit = gdv - purchase - refurbCost;

          return {
            name: scenario.name,
            Purchase: purchase,
            "Refurb Cost": refurbCost,
            GDV: gdv,
            Profit: profit
          };
        }),
    [sortedScenarios]
  );

  async function handleDeleteConfirm(): Promise<void> {
    if (!scenarioToDelete) {
      return;
    }

    try {
      await deleteScenario(scenarioToDelete.id);
      setScenarios((prev) => prev.filter((item) => item.id !== scenarioToDelete.id));
    } catch (error) {
      setScenarios((prev) => prev.filter((item) => item.id !== scenarioToDelete.id));
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to delete scenario from cloud. Deleted local copy."
      );
    }

    setScenarioToDelete(null);
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Scenario Comparison</h1>
      <AuthBanner />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading scenarios...</p> : null}
      {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}

      {!isLoading && sortedScenarios.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-4 text-sm text-muted-foreground">
            No scenarios saved yet. Create one from the{" "}
            <Link href="/" className="font-medium text-foreground underline">
              Quick Estimate
            </Link>{" "}
            or{" "}
            <Link href="/rooms" className="font-medium text-foreground underline">
              Detailed Rooms
            </Link>{" "}
            page.
          </CardContent>
        </Card>
      ) : !isLoading ? (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
            <Table className="min-w-[960px]">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="px-4">Name</TableHead>
                  <TableHead className="px-4">Total (Typical)</TableHead>
                  <TableHead className="px-4">£/m²</TableHead>
                  <TableHead className="px-4">Purchase Price</TableHead>
                  <TableHead className="px-4">
                    <TermTooltip
                      term="GDV"
                      explanation="Gross Development Value — the estimated market value of the property after refurbishment."
                    />
                  </TableHead>
                  <TableHead className="px-4">Profit</TableHead>
                  <TableHead className="px-4">
                    <TermTooltip
                      term="ROI"
                      explanation="Return on Investment — profit as a percentage of total purchase and refurbishment costs."
                    />
                  </TableHead>
                  <TableHead className="px-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedScenarios.map((scenario, index) => {
                  const totalTypical = scenario.result.totalTypical;
                  const costPerM2Typical = scenario.result.costPerM2.typical;
                  const purchasePrice = scenario.purchasePrice;
                  const gdv = scenario.gdv;
                  const hasFinancials =
                    typeof purchasePrice === "number" && typeof gdv === "number";
                  const profit = hasFinancials ? gdv - purchasePrice - totalTypical : null;
                  const roi =
                    hasFinancials && profit !== null
                      ? (profit / (purchasePrice + totalTypical)) * 100
                      : null;
                  const roiPositive = typeof roi === "number" ? roi >= 0 : false;

                  return (
                    <TableRow key={scenario.id} className={index % 2 !== 0 ? "bg-muted/20" : ""}>
                      <TableCell className="px-4 font-medium">{scenario.name}</TableCell>
                      <TableCell className="px-4">
                        <CurrencyDisplay amount={totalTypical} />
                      </TableCell>
                      <TableCell className="px-4">
                        <CurrencyDisplay amount={costPerM2Typical} />
                      </TableCell>
                      <TableCell className="px-4">
                        {typeof purchasePrice === "number" ? (
                          <CurrencyDisplay amount={purchasePrice} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        {typeof gdv === "number" ? <CurrencyDisplay amount={gdv} /> : "—"}
                      </TableCell>
                      <TableCell className="px-4">
                        {profit !== null ? <CurrencyDisplay amount={profit} /> : "—"}
                      </TableCell>
                      <TableCell className="px-4">
                        {roi !== null ? (
                          <Badge
                            variant={roiPositive ? "default" : "destructive"}
                            className="font-medium"
                          >
                            {formatRoi(roi)}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setScenarioToDelete(scenario)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {scenarioCostChartData.length >= 2 ? (
            <Card className="bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Scenario Cost Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={scenarioCostChartData}
                  index="name"
                  categories={["Low", "Typical", "High"]}
                  colors={["emerald", "teal", "rose"]}
                  valueFormatter={(value) => gbpFormatter.format(value)}
                  className="h-72"
                />
              </CardContent>
            </Card>
          ) : null}

          {investmentChartData.length > 0 ? (
            <Card className="bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Investment Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={investmentChartData}
                  index="name"
                  categories={["Purchase", "Refurb Cost", "GDV", "Profit"]}
                  colors={["slate", "teal", "emerald", "cyan"]}
                  valueFormatter={(value) => gbpFormatter.format(value)}
                  className="h-72"
                />
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      <Dialog
        open={Boolean(scenarioToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setScenarioToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Scenario</DialogTitle>
            <DialogDescription>
              {scenarioToDelete ? `Delete scenario ${scenarioToDelete.name}?` : "Delete scenario?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-0 bg-transparent p-0">
            <Button type="button" variant="outline" onClick={() => setScenarioToDelete(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
