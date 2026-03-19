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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  loadBudgetActuals,
  loadScenarios,
  saveBudgetActuals
} from "@/lib/dataService";
import type { CostCategory, Scenario } from "@/lib/types";

const COST_CATEGORIES: CostCategory[] = [
  "kitchen",
  "bathroom",
  "electrics",
  "plumbing",
  "heating",
  "windows",
  "doors",
  "plastering",
  "decoration",
  "flooring",
  "contingency",
  "fees"
];

type BudgetStatus = "none" | "ok" | "warning" | "alert";

function getStatus(actual: number | undefined, planned: number): BudgetStatus {
  if (typeof actual !== "number") {
    return "none";
  }

  if (actual <= planned) {
    return "ok";
  }

  if (actual <= planned * 1.1) {
    return "warning";
  }

  return "alert";
}

function getStatusBadge(status: BudgetStatus) {
  if (status === "ok") {
    return <Badge className="bg-green-600 text-white">✓ On budget</Badge>;
  }

  if (status === "warning") {
    return (
      <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">
        ⚠ Near limit
      </Badge>
    );
  }

  if (status === "alert") {
    return <Badge variant="destructive">✗ Over budget</Badge>;
  }

  return (
    <Badge variant="outline" className="text-muted-foreground">
      —
    </Badge>
  );
}

function getVarianceClass(actual: number | undefined, variance: number | undefined): string {
  if (typeof actual !== "number" || typeof variance !== "number") {
    return "text-muted-foreground";
  }

  if (variance > 0) {
    return "text-red-600";
  }

  if (variance < 0) {
    return "text-green-600";
  }

  return "text-foreground";
}

function formatCategoryLabel(category: CostCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function renderCategoryLabel(category: CostCategory) {
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

  return formatCategoryLabel(category);
}

export default function BudgetPage() {
  const gbpFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  });
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [actuals, setActuals] = useState<Partial<Record<CostCategory, number>>>({});

  useEffect(() => {
    let isMounted = true;

    (async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const loadedScenarios = await loadScenarios();
        if (!isMounted) {
          return;
        }

        const sorted = loadedScenarios.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setScenarios(sorted);
        if (sorted.length > 0) {
          setSelectedScenarioId((prev) => prev || sorted[0].id);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const fallbackData =
          error && typeof error === "object" && "fallbackData" in error
            ? ((error as { fallbackData?: Scenario[] }).fallbackData ?? [])
            : [];
        const sorted = fallbackData.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setScenarios(sorted);
        if (sorted.length > 0) {
          setSelectedScenarioId((prev) => prev || sorted[0].id);
        }
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

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId]
  );

  const plannedByCategory = useMemo(() => {
    if (!selectedScenario) {
      return null;
    }

    const map: Partial<Record<CostCategory, number>> = {};

    for (const entry of selectedScenario.result.categories) {
      map[entry.category] = entry.typical;
    }

    return map;
  }, [selectedScenario]);

  useEffect(() => {
    if (!selectedScenarioId) {
      setActuals({});
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        const saved = await loadBudgetActuals(selectedScenarioId);
        if (!isMounted) {
          return;
        }

        setActuals(saved?.actuals ?? {});
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const fallbackData =
          error && typeof error === "object" && "fallbackData" in error
            ? ((error as { fallbackData?: { actuals?: Partial<Record<CostCategory, number>> } | null }).fallbackData ??
              null)
            : null;
        setActuals(fallbackData?.actuals ?? {});
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load budget actuals from cloud. Showing local data."
        );
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedScenarioId]);

  useEffect(() => {
    if (!selectedScenarioId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      (async () => {
        try {
          await saveBudgetActuals({
            scenarioId: selectedScenarioId,
            actuals,
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to save budget actuals to cloud. Saved locally instead."
          );
        }
      })();
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actuals, selectedScenarioId]);

  function handleActualChange(category: CostCategory, value: string): void {
    if (value === "") {
      setActuals((prev) => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return;
    }

    setActuals((prev) => ({
      ...prev,
      [category]: parsed
    }));
  }

  if (isLoading) {
    return (
      <section className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Budget Tracker</h1>
        <AuthBanner />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (scenarios.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Budget Tracker</h1>
        <AuthBanner />
        {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}
        <Card className="py-12 text-center shadow-sm">
          <CardContent className="space-y-3">
            <p className="text-lg font-medium text-foreground">No scenarios to track</p>
            <p className="text-sm text-muted-foreground">
              Save a scenario first, then come back here to track actual spend against your
              estimate.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Button variant="default" asChild>
                <Link href="/">Quick Estimate</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/rooms">Detailed Rooms</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const rows = COST_CATEGORIES.map((category) => {
    const planned = plannedByCategory?.[category] ?? 0;
    const actual = actuals[category];
    const variance = typeof actual === "number" ? actual - planned : undefined;
    const status = getStatus(actual, planned);

    return {
      category,
      planned,
      actual,
      variance,
      status
    };
  });

  const totalPlanned = rows.reduce((sum, row) => sum + row.planned, 0);
  const hasAnyActual = rows.some((row) => typeof row.actual === "number");
  const totalActual = hasAnyActual
    ? rows.reduce((sum, row) => sum + (typeof row.actual === "number" ? row.actual : 0), 0)
    : undefined;
  const totalVariance =
    typeof totalActual === "number" ? totalActual - totalPlanned : undefined;
  const totalStatus = getStatus(totalActual, totalPlanned);
  const plannedVsActualChartData = rows
    .filter((row) => row.planned > 0)
    .map((row) => ({
      name: formatCategoryLabel(row.category),
      Planned: row.planned,
      Actual: typeof row.actual === "number" ? row.actual : 0
    }));

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Budget Tracker</h1>
      <AuthBanner />
      {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}

      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">Scenario</p>
            <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
              <SelectTrigger id="scenario-select" className="w-full">
                <SelectValue placeholder="Select scenario" />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedScenario ? (
        <>
          <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
            <Table className="min-w-[980px]">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="px-4">Category</TableHead>
                  <TableHead className="px-4">Planned (Typical)</TableHead>
                  <TableHead className="px-4">Actual</TableHead>
                  <TableHead className="px-4">Variance</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={row.category} className={index % 2 !== 0 ? "bg-muted/20" : ""}>
                    <TableCell className="px-4 font-medium">{renderCategoryLabel(row.category)}</TableCell>
                    <TableCell className="px-4">
                      <CurrencyDisplay amount={row.planned} />
                    </TableCell>
                    <TableCell className="px-4">
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        placeholder="£0"
                        value={typeof row.actual === "number" ? row.actual : ""}
                        onChange={(event) => handleActualChange(row.category, event.target.value)}
                        className="h-8 w-full max-w-40 text-right"
                      />
                    </TableCell>
                    <TableCell className={`px-4 ${getVarianceClass(row.actual, row.variance)}`}>
                      {typeof row.variance === "number" ? (
                        <CurrencyDisplay amount={row.variance} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="px-4">{getStatusBadge(row.status)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell className="px-4">Total</TableCell>
                  <TableCell className="px-4">
                    <CurrencyDisplay amount={totalPlanned} />
                  </TableCell>
                  <TableCell className="px-4">
                    {typeof totalActual === "number" ? (
                      <CurrencyDisplay amount={totalActual} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className={`px-4 ${getVarianceClass(totalActual, totalVariance)}`}>
                    {typeof totalVariance === "number" ? (
                      <CurrencyDisplay amount={totalVariance} />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="px-4">{getStatusBadge(totalStatus)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {hasAnyActual ? (
            <Card className="bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Planned vs Actual by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <BarChart
                    data={plannedVsActualChartData}
                    index="name"
                    categories={["Planned", "Actual"]}
                    colors={["teal", "slate"]}
                    valueFormatter={(value) => gbpFormatter.format(value)}
                    className="h-72 min-w-[500px]"
                  />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
