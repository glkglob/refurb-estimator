import { type EstimateInput } from "@/schemas/estimate";
import {
  BASE_COST_PER_M2,
  REGION_MULTIPLIERS,
  calculateEstimate,
  type EstimateResult,
} from "@/services/estimate";
import { isValidationError } from "@/utils/validator";

function expectEstimate(area: number, multiplier: number, result: EstimateResult): void {
  const expectedBase = Math.round(area * BASE_COST_PER_M2 * 100) / 100;
  const expectedTotal = Math.round(expectedBase * multiplier * 100) / 100;

  expect(result.breakdown.base).toBe(expectedBase);
  expect(result.breakdown.multiplier).toBe(multiplier);
  expect(result.totalCost).toBe(expectedTotal);
  expect(result.formatted).toMatch(/^£\d{1,3}(,\d{3})*(\.\d{2})$/);
}

describe("services/estimate", () => {
  test("calculates estimate for all configured regions", () => {
    const area = 100;

    const london = calculateEstimate({
      area,
      region: "london",
    });
    const southEast = calculateEstimate({
      area,
      region: "south_east",
    });
    const midlands = calculateEstimate({
      area,
      region: "midlands",
    });
    const north = calculateEstimate({
      area,
      region: "north",
    });

    expectEstimate(area, REGION_MULTIPLIERS.london, london);
    expectEstimate(area, REGION_MULTIPLIERS.south_east, southEast);
    expectEstimate(area, REGION_MULTIPLIERS.midlands, midlands);
    expectEstimate(area, REGION_MULTIPLIERS.north, north);
  });

  test("normalizes region strings and falls back unknown regions to midlands multiplier", () => {
    const southEast = calculateEstimate({
      area: 42,
      region: "South East",
    });

    const unknown = calculateEstimate({
      area: 42,
      region: "unknown_region",
    });

    expect(southEast.breakdown.multiplier).toBe(REGION_MULTIPLIERS.south_east);
    expect(unknown.breakdown.multiplier).toBe(REGION_MULTIPLIERS.midlands);
  });

  test("handles very large areas and keeps currency formatted to two decimals", () => {
    const result = calculateEstimate({
      area: 1_000_000,
      region: "london",
    });

    expect(result.totalCost).toBe(1_500_000_000);
    expect(result.formatted).toBe("£1,500,000,000.00");
  });

  test("raises typed validation errors for invalid estimate input", () => {
    const invalidInput = {
      area: 0,
      region: "",
    } as unknown as EstimateInput;

    try {
      calculateEstimate(invalidInput);
      throw new Error("Expected calculateEstimate to throw");
    } catch (error) {
      expect(isValidationError(error)).toBe(true);

      if (isValidationError(error)) {
        expect(error.code).toBe("VALIDATION_ERROR");
        expect(error.issues.length).toBeGreaterThan(0);
      }
    }
  });
});
