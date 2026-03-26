/** @jest-environment jsdom */

import {
  loadScenarios,
  saveScenario,
  ScenarioLimitExceededError
} from "./storage";
import { PropertyType } from "./propertyType";
import type { Scenario } from "./types";

function buildScenario(id: string, name = `Scenario ${id}`): Scenario {
  const timestamp = "2026-03-26T10:00:00.000Z";
  return {
    id,
    name,
    input: {
      region: "London",
      projectType: "refurb",
      propertyType: PropertyType.FLAT_APARTMENT,
      totalAreaM2: 60,
      condition: "fair",
      finishLevel: "standard"
    },
    result: {
      totalLow: 50_000,
      totalTypical: 65_000,
      totalHigh: 80_000,
      costPerM2: {
        low: 833,
        typical: 1_083,
        high: 1_333
      },
      categories: []
    },
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

describe("storage scenario limits", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("allows saving one local scenario for signed-out usage", () => {
    saveScenario(buildScenario("scenario-1"));

    expect(loadScenarios()).toHaveLength(1);
  });

  test("blocks saving a second different local scenario", () => {
    saveScenario(buildScenario("scenario-1"));

    expect(() => saveScenario(buildScenario("scenario-2"))).toThrow(
      ScenarioLimitExceededError
    );
    expect(loadScenarios()).toHaveLength(1);
  });

  test("allows updating the same existing scenario id", () => {
    saveScenario(buildScenario("scenario-1", "Original"));
    saveScenario(buildScenario("scenario-1", "Updated"));

    const scenarios = loadScenarios();
    expect(scenarios).toHaveLength(1);
    expect(scenarios[0]?.name).toBe("Updated");
  });
});
