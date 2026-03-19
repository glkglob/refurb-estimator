import {
  deleteScenario as deleteScenarioLocal,
  getScenario as getScenarioLocal,
  loadScenarios as loadScenariosLocal,
  saveScenario as saveScenarioLocal
} from "@/lib/storage";
import {
  loadBudgetActuals as loadBudgetActualsLocal,
  saveBudgetActuals as saveBudgetActualsLocal
} from "@/lib/budget";
import type { BudgetActuals } from "@/lib/budget";
import { createClient } from "@/lib/supabase/client";
import {
  deleteScenarioFromDb,
  getScenarioFromDb,
  loadBudgetActualsFromDb,
  loadScenariosFromDb,
  saveBudgetActualsToDb,
  saveScenarioToDb
} from "@/lib/supabase/db";
import type { Scenario } from "@/lib/types";

type ErrorWithFallback<T> = Error & {
  fallbackData?: T;
};

const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function buildErrorWithFallback<T>(message: string, fallbackData?: T): ErrorWithFallback<T> {
  const error = new Error(message) as ErrorWithFallback<T>;
  if (fallbackData !== undefined) {
    error.fallbackData = fallbackData;
  }
  return error;
}

async function getAuthenticatedClient() {
  if (!isSupabaseConfigured) {
    return null;
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
      error
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return { supabase, user };
  } catch {
    return null;
  }
}

export async function saveScenario(scenario: Scenario): Promise<void> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    saveScenarioLocal(scenario);
    return;
  }

  try {
    await saveScenarioToDb(scenario);
  } catch (error) {
    saveScenarioLocal(scenario);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw buildErrorWithFallback<void>(
      `Failed to save scenario to cloud. Saved locally instead: ${message}`
    );
  }
}

export async function loadScenarios(): Promise<Scenario[]> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    return loadScenariosLocal();
  }

  try {
    return await loadScenariosFromDb();
  } catch (error) {
    const fallback = loadScenariosLocal();
    const message = error instanceof Error ? error.message : "Unknown error";
    throw buildErrorWithFallback<Scenario[]>(
      `Failed to load scenarios from cloud. Showing local data instead: ${message}`,
      fallback
    );
  }
}

export async function deleteScenario(id: string): Promise<void> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    deleteScenarioLocal(id);
    return;
  }

  try {
    await deleteScenarioFromDb(id);
  } catch (error) {
    deleteScenarioLocal(id);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw buildErrorWithFallback<void>(
      `Failed to delete scenario from cloud. Deleted locally instead: ${message}`
    );
  }
}

export async function getScenario(id: string): Promise<Scenario | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    return getScenarioLocal(id);
  }

  try {
    return await getScenarioFromDb(id);
  } catch (error) {
    const fallback = getScenarioLocal(id);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw buildErrorWithFallback<Scenario | null>(
      `Failed to load scenario from cloud. Showing local data instead: ${message}`,
      fallback
    );
  }
}

export async function saveBudgetActuals(data: BudgetActuals): Promise<void> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    saveBudgetActualsLocal(data);
    return;
  }

  try {
    await saveBudgetActualsToDb(data);
  } catch (error) {
    saveBudgetActualsLocal(data);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw buildErrorWithFallback<void>(
      `Failed to save budget actuals to cloud. Saved locally instead: ${message}`
    );
  }
}

export async function loadBudgetActuals(scenarioId: string): Promise<BudgetActuals | null> {
  const auth = await getAuthenticatedClient();
  if (!auth) {
    return loadBudgetActualsLocal(scenarioId);
  }

  try {
    return await loadBudgetActualsFromDb(scenarioId);
  } catch (error) {
    const fallback = loadBudgetActualsLocal(scenarioId);
    const message = error instanceof Error ? error.message : "Unknown error";
    throw buildErrorWithFallback<BudgetActuals | null>(
      `Failed to load budget actuals from cloud. Showing local data instead: ${message}`,
      fallback
    );
  }
}
