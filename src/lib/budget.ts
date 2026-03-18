import type { BudgetActuals } from "./types";
export type { BudgetActuals } from "./types";

const BUDGET_KEY_PREFIX = "refurb-budget-";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getBudgetStorageKey(scenarioId: string): string {
  return `${BUDGET_KEY_PREFIX}${scenarioId}`;
}

export function saveBudgetActuals(data: BudgetActuals): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(getBudgetStorageKey(data.scenarioId), JSON.stringify(data));
}

export function loadBudgetActuals(scenarioId: string): BudgetActuals | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(getBudgetStorageKey(scenarioId));
  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed as BudgetActuals;
  } catch {
    return null;
  }
}
