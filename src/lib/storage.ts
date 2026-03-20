import type { Scenario } from "@/lib/types";

const STORAGE_KEY = "refurb-scenarios";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readScenariosFromStorage(): Scenario[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as Scenario[];
  } catch {
    return [];
  }
}

function writeScenariosToStorage(scenarios: Scenario[]): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
}

export function saveScenario(scenario: Scenario): void {
  if (!canUseStorage()) {
    return;
  }

  const scenarios = readScenariosFromStorage();
  const index = scenarios.findIndex((item) => item.id === scenario.id);

  if (index >= 0) {
    scenarios[index] = scenario;
  } else {
    scenarios.push(scenario);
  }

  writeScenariosToStorage(scenarios);
}

export function loadScenarios(): Scenario[] {
  return readScenariosFromStorage();
}

// TODO: unused export
export function loadLocal(): Scenario[] {
  return readScenariosFromStorage();
}

export function deleteScenario(id: string): void {
  if (!canUseStorage()) {
    return;
  }

  const scenarios = readScenariosFromStorage();
  const nextScenarios = scenarios.filter((scenario) => scenario.id !== id);
  writeScenariosToStorage(nextScenarios);
}

export function getScenario(id: string): Scenario | null {
  if (!canUseStorage()) {
    return null;
  }

  const scenarios = readScenariosFromStorage();
  return scenarios.find((scenario) => scenario.id === id) ?? null;
}
