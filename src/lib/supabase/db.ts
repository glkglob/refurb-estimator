import { createClient } from "./client";
import type { Scenario, BudgetActuals } from "../types";

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

function toNullableNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function toScenario(row: ScenarioRow): Scenario {
  return {
    id: row.id,
    name: row.name,
    input: row.input,
    result: row.result,
    purchasePrice: toNullableNumber(row.purchase_price),
    gdv: toNullableNumber(row.gdv),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toActuals(value: Record<string, number | string> | null): BudgetActuals["actuals"] {
  if (!value) {
    return {};
  }

  return Object.entries(value).reduce<BudgetActuals["actuals"]>((acc, [key, rawValue]) => {
    const category = key as keyof BudgetActuals["actuals"];
    const numericValue = toNullableNumber(rawValue);
    if (numericValue !== undefined) {
      acc[category] = numericValue;
    }
    return acc;
  }, {});
}

async function getAuthenticatedContext() {
  const supabase = createClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("User not authenticated");
  }

  return { supabase, user };
}

// Scenario CRUD
export async function saveScenarioToDb(scenario: Scenario): Promise<void> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
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
      throw error;
    }
  } catch (error) {
    console.error("Failed to save scenario to database", error);
    throw error;
  }
}

export async function loadScenariosFromDb(): Promise<Scenario[]> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data, error } = await supabase
      .from("scenarios")
      .select("id, user_id, name, input, result, purchase_price, gdv, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data as ScenarioRow[] | null)?.map(toScenario) ?? [];
  } catch (error) {
    console.error("Failed to load scenarios from database", error);
    throw error;
  }
}

export async function deleteScenarioFromDb(id: string): Promise<void> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { error } = await supabase.from("scenarios").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Failed to delete scenario from database", error);
    throw error;
  }
}

export async function getScenarioFromDb(id: string): Promise<Scenario | null> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data, error } = await supabase
      .from("scenarios")
      .select("id, user_id, name, input, result, purchase_price, gdv, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    return toScenario(data as ScenarioRow);
  } catch (error) {
    console.error("Failed to get scenario from database", error);
    throw error;
  }
}

// Budget CRUD
export async function saveBudgetActualsToDb(data: BudgetActuals): Promise<void> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data: existingRows, error: selectError } = await supabase
      .from("budget_actuals")
      .select("id")
      .eq("scenario_id", data.scenarioId)
      .eq("user_id", user.id)
      .limit(1);

    if (selectError) {
      throw selectError;
    }

    if (existingRows && existingRows.length > 0) {
      const { error: updateError } = await supabase
        .from("budget_actuals")
        .update({
          actuals: data.actuals,
          updated_at: data.updatedAt
        })
        .eq("id", existingRows[0].id)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      return;
    }

    const { error: insertError } = await supabase.from("budget_actuals").insert({
      scenario_id: data.scenarioId,
      user_id: user.id,
      actuals: data.actuals,
      updated_at: data.updatedAt
    });

    if (insertError) {
      throw insertError;
    }
  } catch (error) {
    console.error("Failed to save budget actuals to database", error);
    throw error;
  }
}

export async function loadBudgetActualsFromDb(scenarioId: string): Promise<BudgetActuals | null> {
  try {
    const { supabase, user } = await getAuthenticatedContext();
    const { data, error } = await supabase
      .from("budget_actuals")
      .select("id, scenario_id, user_id, actuals, updated_at")
      .eq("scenario_id", scenarioId)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    const latestRecord = (data as BudgetActualsRow[] | null)?.[0];
    if (!latestRecord) {
      return null;
    }

    return {
      scenarioId: latestRecord.scenario_id,
      actuals: toActuals(latestRecord.actuals),
      updatedAt: latestRecord.updated_at
    };
  } catch (error) {
    console.error("Failed to load budget actuals from database", error);
    throw error;
  }
}
