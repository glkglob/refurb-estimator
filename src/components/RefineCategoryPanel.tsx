"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  REFINE_SCOPE,
  isRefineScopeItemDefaultSelected,
  type RefineScopeCategory,
  type RefineScopeItem
} from "@/lib/refineData";
import type { Condition, FinishLevel } from "@/lib/types";

const NOTES_MAX_LENGTH = 500;

const FINISH_OPTIONS = [
  { value: "budget", label: "Budget", multiplier: 0.8 },
  { value: "standard", label: "Standard", multiplier: 1.0 },
  { value: "premium", label: "Premium", multiplier: 1.35 }
] as const satisfies ReadonlyArray<{
  value: FinishLevel;
  label: string;
  multiplier: number;
}>;

type RefineAutoEstimate =
  | number
  | {
      total: number;
      areaM2?: number;
      buildCost?: number;
      defaultUnitCount?: number;
      unitsByItemId?: Partial<Record<string, number>>;
    };

export type RefineCategorySavePayload = {
  categoryName: RefineScopeCategory;
  selectedItemIds: string[];
  finishLevel: FinishLevel;
  notes: string;
  autoEstimateTotal: number;
  selectedScopeSubtotal: number;
  refinedTotal: number;
  multiplier: number;
};

type RefineCategoryPanelProps = {
  categoryName: RefineScopeCategory;
  autoEstimate: RefineAutoEstimate;
  condition: Condition;
  finishLevel: FinishLevel;
  onSave: (payload: RefineCategorySavePayload) => void;
  onClose: () => void;
};

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});

function getAutoEstimateTotal(autoEstimate: RefineAutoEstimate): number {
  if (typeof autoEstimate === "number") {
    return Math.max(0, autoEstimate);
  }

  return Math.max(0, autoEstimate.total);
}

function getPerUnitCount(item: RefineScopeItem, autoEstimate: RefineAutoEstimate): number {
  if (typeof autoEstimate === "number") {
    return 1;
  }

  const explicitCount = autoEstimate.unitsByItemId?.[item.id];
  if (typeof explicitCount === "number" && explicitCount > 0) {
    return explicitCount;
  }

  if (typeof autoEstimate.defaultUnitCount === "number" && autoEstimate.defaultUnitCount > 0) {
    return autoEstimate.defaultUnitCount;
  }

  return 1;
}

function getItemTypicalCost(item: RefineScopeItem, autoEstimate: RefineAutoEstimate): number {
  const typical = (item.low + item.high) / 2;

  if (item.unit === "fixed") {
    return typical;
  }

  if (item.unit === "per_m2") {
    const areaM2 = typeof autoEstimate === "number" ? 0 : autoEstimate.areaM2 ?? 0;
    return typical * Math.max(areaM2, 0);
  }

  if (item.unit === "per_unit") {
    return typical * getPerUnitCount(item, autoEstimate);
  }

  const buildCost =
    typeof autoEstimate === "number" ? autoEstimate : autoEstimate.buildCost ?? autoEstimate.total;
  return (typical / 100) * Math.max(buildCost, 0);
}

function getUnitHint(item: RefineScopeItem, autoEstimate: RefineAutoEstimate): string {
  if (item.unit === "fixed") {
    return "Fixed";
  }

  if (item.unit === "per_m2") {
    const areaM2 = typeof autoEstimate === "number" ? undefined : autoEstimate.areaM2;
    return areaM2 ? `per m² × ${areaM2}` : "per m²";
  }

  if (item.unit === "per_unit") {
    const count = getPerUnitCount(item, autoEstimate);
    return `per unit × ${count}`;
  }

  return "% of build";
}

export default function RefineCategoryPanel({
  categoryName,
  autoEstimate,
  condition,
  finishLevel,
  onSave,
  onClose
}: RefineCategoryPanelProps) {
  const config = REFINE_SCOPE[categoryName];
  const autoEstimateTotal = useMemo(() => getAutoEstimateTotal(autoEstimate), [autoEstimate]);

  const defaultSelectedIds = useMemo(() => {
    return config.items
      .filter((item) => isRefineScopeItemDefaultSelected(item, condition, finishLevel))
      .map((item) => item.id);
  }, [config.items, condition, finishLevel]);

  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(
    () => new Set(defaultSelectedIds)
  );
  const [selectedFinishLevel, setSelectedFinishLevel] = useState<FinishLevel>(finishLevel);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setSelectedItemIds(new Set(defaultSelectedIds));
    setSelectedFinishLevel(finishLevel);
    setNotes("");
  }, [categoryName, condition, defaultSelectedIds, finishLevel]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const selectedItems = useMemo(
    () => config.items.filter((item) => selectedItemIds.has(item.id)),
    [config.items, selectedItemIds]
  );

  const selectedScopeSubtotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + getItemTypicalCost(item, autoEstimate), 0);
  }, [autoEstimate, selectedItems]);

  const selectedFinishOption = useMemo(() => {
    return FINISH_OPTIONS.find((option) => option.value === selectedFinishLevel) ?? FINISH_OPTIONS[1];
  }, [selectedFinishLevel]);

  const baseForRefinement = selectedScopeSubtotal > 0 ? selectedScopeSubtotal : autoEstimateTotal;
  const refinedTotal = Math.round(baseForRefinement * selectedFinishOption.multiplier);

  function toggleItem(itemId: string): void {
    setSelectedItemIds((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }

  function handleResetToAuto(): void {
    setSelectedItemIds(new Set(defaultSelectedIds));
    setSelectedFinishLevel(finishLevel);
    setNotes("");
  }

  function handleSave(): void {
    onSave({
      categoryName,
      selectedItemIds: config.items.filter((item) => selectedItemIds.has(item.id)).map((item) => item.id),
      finishLevel: selectedFinishLevel,
      notes: notes.trim(),
      autoEstimateTotal,
      selectedScopeSubtotal,
      refinedTotal,
      multiplier: selectedFinishOption.multiplier
    });
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close refine panel"
        className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Refine ${config.label} estimate`}
        className="absolute inset-y-0 right-0 hidden w-full max-w-[480px] animate-in slide-in-from-right-10 border-l border-border bg-background shadow-2xl md:flex md:flex-col"
      >
        <header className="flex items-start justify-between border-b border-border px-4 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Refine {config.label} Estimate</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Review scope, adjust finish level, and save your refined total.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">{renderPanelContent()}</div>

        <footer className="border-t border-border px-4 py-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={handleResetToAuto}>
              Reset to auto
            </Button>
            <Button type="button" variant="primary" onClick={handleSave}>
              Save refinement
            </Button>
          </div>
        </footer>
      </div>

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Refine ${config.label} estimate`}
        className="absolute inset-x-0 bottom-0 flex max-h-[90vh] w-full animate-in slide-in-from-bottom-10 flex-col overflow-hidden rounded-t-2xl border-t border-border bg-background shadow-2xl md:hidden"
      >
        <header className="flex items-start justify-between border-b border-border px-4 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Refine {config.label} Estimate</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Review scope, adjust finish level, and save your refined total.
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">{renderPanelContent()}</div>

        <footer className="border-t border-border px-4 py-4">
          <div className="flex flex-col gap-2">
            <Button type="button" variant="primary" onClick={handleSave}>
              Save refinement
            </Button>
            <Button type="button" variant="ghost" onClick={handleResetToAuto}>
              Reset to auto
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );

  function renderPanelContent(): JSX.Element {
    return (
      <div className="space-y-5">
        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Finish level multiplier
          </p>
          <div className="grid grid-cols-3 gap-2">
            {FINISH_OPTIONS.map((option) => {
              const isSelected = option.value === selectedFinishLevel;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    "rounded-lg border px-3 py-2 text-sm transition",
                    isSelected
                      ? "border-[var(--primary)] bg-[var(--primary)]/15 text-foreground"
                      : "border-border bg-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  ].join(" ")}
                  onClick={() => setSelectedFinishLevel(option.value)}
                  aria-pressed={isSelected}
                >
                  <span className="block font-medium">{option.label}</span>
                  <span className="block text-xs">{option.multiplier.toFixed(2)}x</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scope checklist</p>
          <div className="space-y-2">
            {config.items.map((item) => {
              const isChecked = selectedItemIds.has(item.id);
              const typicalCost = getItemTypicalCost(item, autoEstimate);
              return (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition hover:bg-muted/30"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 rounded border-border accent-[var(--primary)]"
                    checked={isChecked}
                    onChange={() => toggleItem(item.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{item.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {gbpFormatter.format(item.low)} - {gbpFormatter.format(item.high)} ({getUnitHint(item, autoEstimate)})
                    </span>
                  </span>
                  <span className="text-xs font-medium text-foreground">{gbpFormatter.format(typicalCost)}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">
              Auto estimate: <span className="font-medium text-foreground">{gbpFormatter.format(autoEstimateTotal)}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Selected scope subtotal:{" "}
              <span className="font-medium text-foreground">{gbpFormatter.format(selectedScopeSubtotal)}</span>
            </p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              Refined estimate total: {gbpFormatter.format(refinedTotal)}
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <label htmlFor="refine-notes" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Notes
          </label>
          <textarea
            id="refine-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value.slice(0, NOTES_MAX_LENGTH))}
            maxLength={NOTES_MAX_LENGTH}
            placeholder="Add notes for this category refinement..."
            className="bp-focus-ring min-h-28 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
          />
          <p className="text-right text-xs text-muted-foreground">
            {notes.length}/{NOTES_MAX_LENGTH}
          </p>
        </section>
      </div>
    );
  }
}
