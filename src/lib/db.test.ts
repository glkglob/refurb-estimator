import { createClient } from "@/lib/supabase/client";
import {
  getScenarioFromDb,
  loadBudgetActualsFromDb,
  loadScenariosFromDb
} from "@/lib/supabase/db";
import type { Scenario } from "@/lib/types";

jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn()
}));

const mockedCreateClient = jest.mocked(createClient);

type MockSupabaseError = { message: string } | null;

type MockClientOptions = {
  from: jest.Mock;
  userId?: string | null;
  authError?: string;
};

function mockClient(options: MockClientOptions) {
  const getUser = jest.fn().mockResolvedValue({
    data: {
      user: options.userId === null ? null : { id: options.userId ?? "user-123" }
    },
    error: options.authError ? { message: options.authError } : null
  });

  const client = {
    auth: { getUser },
    from: options.from
  } as unknown as ReturnType<typeof createClient>;

  mockedCreateClient.mockReturnValue(client);
  return { getUser };
}

describe("supabase db helpers", () => {
  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log("TEST_SUITE_EXECUTED");
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("loadScenariosFromDb maps rows and filters invalid numeric values", async () => {
    expect.hasAssertions();
    expect.assertions(7);

    const row = {
      id: "scenario-1",
      user_id: "user-123",
      name: "Loft conversion",
      input: {} as Scenario["input"],
      result: {} as Scenario["result"],
      purchase_price: "250000",
      gdv: "not-a-number",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z"
    };

    const order = jest.fn().mockResolvedValue({ data: [row], error: null as MockSupabaseError });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    const { getUser } = mockClient({ from });

    const scenarios = await loadScenariosFromDb();

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("scenarios");
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]?.id).toBe("scenario-1");
    expect(scenarios[0]?.purchasePrice).toBe(250000);
    expect(scenarios[0]?.gdv).toBeUndefined();
    expect(scenarios[0]?.name).toBe("Loft conversion");
  });

  test("loadScenariosFromDb returns empty array when no rows exist", async () => {
    expect.hasAssertions();
    expect.assertions(2);

    const order = jest.fn().mockResolvedValue({ data: [], error: null as MockSupabaseError });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from });

    const scenarios = await loadScenariosFromDb();

    expect(from).toHaveBeenCalledWith("scenarios");
    expect(scenarios).toEqual([]);
  });

  test("loadScenariosFromDb returns empty array when database returns null data without error", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    const order = jest.fn().mockResolvedValue({ data: null, error: null as MockSupabaseError });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from });

    await expect(loadScenariosFromDb()).resolves.toEqual([]);
  });

  test("loadScenariosFromDb wraps database errors", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    const order = jest.fn().mockResolvedValue({
      data: null,
      error: { message: "db unavailable" } as MockSupabaseError
    });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from });

    await expect(loadScenariosFromDb()).rejects.toThrow("Failed to load scenarios: db unavailable");
  });

  test("getScenarioFromDb returns null when scenario is missing", async () => {
    expect.hasAssertions();
    expect.assertions(3);

    const builder = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null as MockSupabaseError })
    };
    builder.eq.mockReturnValue(builder);

    const select = jest.fn().mockReturnValue(builder);
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from, userId: "user-999" });

    const scenario = await getScenarioFromDb("scenario-missing");

    expect(scenario).toBeNull();
    expect(builder.eq).toHaveBeenNthCalledWith(1, "id", "scenario-missing");
    expect(builder.eq).toHaveBeenNthCalledWith(2, "user_id", "user-999");
  });

  test("getScenarioFromDb handles empty id input deterministically", async () => {
    expect.hasAssertions();
    expect.assertions(2);

    const builder = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null as MockSupabaseError })
    };
    builder.eq.mockReturnValue(builder);

    const select = jest.fn().mockReturnValue(builder);
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from, userId: "user-999" });

    await expect(getScenarioFromDb("")).resolves.toBeNull();
    expect(builder.eq).toHaveBeenNthCalledWith(1, "id", "");
  });

  test("loadBudgetActualsFromDb maps numeric values and drops invalid entries", async () => {
    expect.hasAssertions();
    expect.assertions(2);

    const builder = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          id: "budget-1",
          scenario_id: "scenario-1",
          user_id: "user-123",
          actuals: {
            kitchen: "1200",
            bathroom: "invalid",
            fees: 500
          },
          updated_at: "2026-01-03T00:00:00.000Z"
        },
        error: null as MockSupabaseError
      })
    };
    builder.eq.mockReturnValue(builder);

    const select = jest.fn().mockReturnValue(builder);
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from });

    const result = await loadBudgetActualsFromDb("scenario-1");

    expect(result?.actuals).toEqual({ kitchen: 1200, fees: 500 });
    expect(result?.scenarioId).toBe("scenario-1");
  });

  test("loadBudgetActualsFromDb wraps query errors", async () => {
    expect.hasAssertions();
    expect.assertions(1);

    const builder = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "permission denied" } as MockSupabaseError
      })
    };
    builder.eq.mockReturnValue(builder);

    const select = jest.fn().mockReturnValue(builder);
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from });

    await expect(loadBudgetActualsFromDb("scenario-1")).rejects.toThrow(
      "Failed to load budget actuals: permission denied"
    );
  });

  test("loadBudgetActualsFromDb tolerates unexpected row shape and falls back to empty actuals", async () => {
    expect.hasAssertions();
    expect.assertions(2);

    const builder = {
      eq: jest.fn(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          scenario_id: "scenario-1",
          updated_at: "2026-01-03T00:00:00.000Z"
        },
        error: null as MockSupabaseError
      })
    };
    builder.eq.mockReturnValue(builder);

    const select = jest.fn().mockReturnValue(builder);
    const from = jest.fn().mockReturnValue({ select });

    mockClient({ from });

    const result = await loadBudgetActualsFromDb("scenario-1");

    expect(result?.scenarioId).toBe("scenario-1");
    expect(result?.actuals).toEqual({});
  });
});
