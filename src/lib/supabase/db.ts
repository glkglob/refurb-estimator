import { createServerSupabaseClient } from "./server";
import type { Scenario } from "../types";
import type { BudgetActuals } from "../budget";

type ScenarioRow = {
  id: string;
  user_id: string;
  name: string;
  input: Scenario["input"];
  result: Scenario["result"];
  purchase_price: number | string | null;
  gdv: number | string | null;
  created_at: string;
  updated_at: string;
};

type BudgetActualsRow = {
  id: string;
  scenario_id: string;
  user_id: string;
  actuals: Record<string, number | string> | null;
  updated_at: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function toOptionalNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function mapScenarioRowToScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    name: row.name,
    input: row.input,
    result: row.result,
    purchasePrice: toOptionalNumber(row.purchase_price),
    gdv: toOptionalNumber(row.gdv),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapActuals(
  rawActuals: Record<string, number | string> | null
): BudgetActuals["actuals"] {
  if (!rawActuals) {
    return {};
  }

  return Object.entries(rawActuals).reduce<BudgetActuals["actuals"]>(
    (acc, [category, rawValue]) => {
      const numericValue = toOptionalNumber(rawValue);
      if (numericValue !== undefined) {
        acc[category as keyof BudgetActuals["actuals"]] = numericValue;
      }
      return acc;
    },
    {}
  );
}

async function getAuthenticatedClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(`Failed to get authenticated user: ${error.message}`);
  }

  if (!user) {
    throw new Error("Not authenticated");
  }

  return { supabase, user };
}

// === Scenarios ===
export async function saveScenarioToDb(scenario: Scenario): Promise<void> {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { error } = await supabase.from("scenarios").upsert(
      {
        id: scenario.id,
        user_id: user.id,
        name: scenario.name,
        input: scenario.input,
        result: scenario.result,
        purchase_price: scenario.purchasePrice ?? null,
        gdv: scenario.gdv ?? null,
        created_at: scenario.createdAt,
        updated_at: scenario.updatedAt
      },
      { onConflict: "id" }
    );

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Failed to save scenario", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      throw error;
    }
    throw new Error(`Failed to save scenario: ${getErrorMessage(error)}`);
  }
}

export async function loadScenariosFromDb(): Promise<Scenario[]> {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("scenarios")
      .select("id, user_id, name, input, result, purchase_price, gdv, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return (data as ScenarioRow[]).map(mapScenarioRowToScenario);
  } catch (error) {
    console.error("Failed to load scenarios", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      throw error;
    }
    throw new Error(`Failed to load scenarios: ${getErrorMessage(error)}`);
  }
}

export async function deleteScenarioFromDb(id: string): Promise<void> {
  try {
    const { supabase } = await getAuthenticatedClient();
    const { error } = await supabase.from("scenarios").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Failed to delete scenario", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      throw error;
    }
    throw new Error(`Failed to delete scenario: ${getErrorMessage(error)}`);
  }
}

export async function getScenarioFromDb(id: string): Promise<Scenario | null> {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("scenarios")
      .select("id, user_id, name, input, result, purchase_price, gdv, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    return mapScenarioRowToScenario(data as ScenarioRow);
  } catch (error) {
    console.error("Failed to get scenario", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      throw error;
    }
    throw new Error(`Failed to get scenario: ${getErrorMessage(error)}`);
  }
}

// === Budget Actuals ===
export async function saveBudgetActualsToDb(data: BudgetActuals): Promise<void> {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { data: existing, error: existingError } = await supabase
      .from("budget_actuals")
      .select("id")
      .eq("scenario_id", data.scenarioId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message);
    }

    const payload = {
      id: existing?.id,
      scenario_id: data.scenarioId,
      user_id: user.id,
      actuals: data.actuals,
      updated_at: data.updatedAt
    };

    const { error } = await supabase
      .from("budget_actuals")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    console.error("Failed to save budget actuals", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      throw error;
    }
    throw new Error(`Failed to save budget actuals: ${getErrorMessage(error)}`);
  }
}

export async function loadBudgetActualsFromDb(
  scenarioId: string
): Promise<BudgetActuals | null> {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("budget_actuals")
      .select("id, scenario_id, user_id, actuals, updated_at")
      .eq("scenario_id", scenarioId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return null;
    }

    const row = data as BudgetActualsRow;
    return {
      scenarioId: row.scenario_id,
      actuals: mapActuals(row.actuals),
      updatedAt: row.updated_at
    };
  } catch (error) {
    console.error("Failed to load budget actuals", error);
    if (error instanceof Error && error.message === "Not authenticated") {
      throw error;
    }
    throw new Error(`Failed to load budget actuals: ${getErrorMessage(error)}`);
  }
}
