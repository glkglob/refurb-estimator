"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CurrencyDisplay from "@/components/CurrencyDisplay";
import InfoTooltip from "@/components/InfoTooltip";
import { deleteScenario, loadScenarios } from "@/lib/storage";
import type { Scenario } from "@/lib/types";

function formatRoi(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => {
    setScenarios(loadScenarios());
  }, []);

  const sortedScenarios = useMemo(
    () =>
      [...scenarios].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [scenarios]
  );

  function handleDelete(scenario: Scenario): void {
    if (!window.confirm(`Delete scenario ${scenario.name}?`)) {
      return;
    }

    deleteScenario(scenario.id);
    setScenarios((prev) => prev.filter((item) => item.id !== scenario.id));
  }

  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Scenario Comparison</h1>

      {sortedScenarios.length === 0 ? (
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          No scenarios saved yet. Create one from the{" "}
          <Link href="/" className="font-medium text-slate-900 underline">
            Quick Estimate
          </Link>{" "}
          or{" "}
          <Link href="/rooms" className="font-medium text-slate-900 underline">
            Detailed Rooms
          </Link>{" "}
          page.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[960px] w-full text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Total (Typical)</th>
                <th className="px-4 py-3 font-semibold">£/m²</th>
                <th className="px-4 py-3 font-semibold">Purchase Price</th>
                <th className="px-4 py-3 font-semibold">
                  <InfoTooltip
                    term="GDV"
                    explanation="Gross Development Value — the estimated market value of the property after refurbishment."
                  />
                </th>
                <th className="px-4 py-3 font-semibold">Profit</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <InfoTooltip
                      term="ROI"
                      explanation="Return on Investment — profit as a percentage of total purchase and refurbishment costs."
                    />
                    %
                  </span>
                </th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
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

                return (
                  <tr key={scenario.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="px-4 py-3 font-medium text-slate-900">{scenario.name}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <CurrencyDisplay amount={totalTypical} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <CurrencyDisplay amount={costPerM2Typical} />
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {typeof purchasePrice === "number" ? (
                        <CurrencyDisplay amount={purchasePrice} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {typeof gdv === "number" ? (
                        <CurrencyDisplay amount={gdv} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {profit !== null ? <CurrencyDisplay amount={profit} /> : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{roi !== null ? formatRoi(roi) : "—"}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(scenario)}
                        className="rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
