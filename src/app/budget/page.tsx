"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import InfoTooltip from "@/components/InfoTooltip";
import { loadBudgetActuals, saveBudgetActuals } from "@/lib/budget";
import { loadScenarios } from "@/lib/storage";
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

function getStatusDisplay(status: BudgetStatus) {
  if (status === "ok") {
    return <span className="text-green-600">✓</span>;
  }

  if (status === "warning") {
    return <span className="text-amber-500">⚠</span>;
  }

  if (status === "alert") {
    return <span className="text-red-600">✗</span>;
  }

  return <span className="text-slate-400">—</span>;
}

function getVarianceClass(actual: number | undefined, variance: number | undefined): string {
  if (typeof actual !== "number" || typeof variance !== "number") {
    return "text-slate-500";
  }

  if (variance > 0) {
    return "text-red-600";
  }

  if (variance < 0) {
    return "text-green-600";
  }

  return "text-slate-700";
}

function formatCategoryLabel(category: CostCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function renderCategoryLabel(category: CostCategory) {
  if (category === "contingency") {
    return (
      <InfoTooltip
        term="Contingency"
        explanation="A buffer (typically 5–10%) for unexpected costs during the refurbishment."
      />
    );
  }

  if (category === "fees") {
    return (
      <InfoTooltip
        term="Fees"
        explanation="Professional fees including architect, surveyor, structural engineer, and building control."
      />
    );
  }

  return formatCategoryLabel(category);
}

export default function BudgetPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [actuals, setActuals] = useState<Partial<Record<CostCategory, number>>>({});

  useEffect(() => {
    const loadedScenarios = loadScenarios().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setScenarios(loadedScenarios);

    if (loadedScenarios.length > 0) {
      setSelectedScenarioId(loadedScenarios[0].id);
    }
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

    const saved = loadBudgetActuals(selectedScenarioId);
    setActuals(saved?.actuals ?? {});
  }, [selectedScenarioId]);

  useEffect(() => {
    if (!selectedScenarioId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveBudgetActuals({
        scenarioId: selectedScenarioId,
        actuals,
        updatedAt: new Date().toISOString()
      });
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

  if (scenarios.length === 0) {
    return (
      <section className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Budget Tracker</h1>
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          No scenarios saved yet. Save a scenario first to start tracking your budget. Create one from{" "}
          <Link href="/" className="font-medium text-slate-900 underline">
            Quick Estimate
          </Link>{" "}
          or{" "}
          <Link href="/rooms" className="font-medium text-slate-900 underline">
            Detailed Rooms
          </Link>{" "}
          .
        </p>
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

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Budget Tracker</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="scenario-select" className="mb-2 block text-sm font-medium text-slate-700">
          Scenario
        </label>
        <select
          id="scenario-select"
          value={selectedScenarioId}
          onChange={(event) => setSelectedScenarioId(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
      </div>

      {selectedScenario ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Planned (Typical)</th>
                <th className="px-4 py-3 font-semibold">Actual</th>
                <th className="px-4 py-3 font-semibold">Variance</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.category} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {renderCategoryLabel(row.category)}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <CurrencyDisplay amount={row.planned} />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      placeholder="£0"
                      value={typeof row.actual === "number" ? row.actual : ""}
                      onChange={(event) => handleActualChange(row.category, event.target.value)}
                      className="w-full max-w-40 rounded-md border border-slate-300 px-3 py-2 text-right text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </td>
                  <td className={`px-4 py-3 ${getVarianceClass(row.actual, row.variance)}`}>
                    {typeof row.variance === "number" ? (
                      <CurrencyDisplay amount={row.variance} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-lg">{getStatusDisplay(row.status)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-300 bg-slate-100 font-semibold">
                <td className="px-4 py-3 text-slate-900">Total</td>
                <td className="px-4 py-3 text-slate-900">
                  <CurrencyDisplay amount={totalPlanned} />
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {typeof totalActual === "number" ? (
                    <CurrencyDisplay amount={totalActual} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className={`px-4 py-3 ${getVarianceClass(totalActual, totalVariance)}`}>
                  {typeof totalVariance === "number" ? (
                    <CurrencyDisplay amount={totalVariance} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-lg">{getStatusDisplay(totalStatus)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
