import { describe, expect, it } from "vitest";

import {
  applyRegionMultiplier,
  calculateEstimateSpec,
} from "@/services/estimate";
import { isValidationError } from "@/utils/validator";

describe("services/estimate spec adapters", () => {
  it("maps the current estimate result to the spec shape", () => {
    const result = calculateEstimateSpec({
      area: 100,
      region: "london",
    });

    expect(result).toEqual({
      total: 150000,
      formatted: "£150,000.00",
    });
  });

  it("returns region multipliers for known and unknown regions", () => {
    expect(applyRegionMultiplier("South East")).toBe(1.15);
    expect(applyRegionMultiplier("unknown-region")).toBe(1);
  });

  it("preserves typed validation failures through the spec adapter", () => {
    let thrownError: unknown;

    try {
      calculateEstimateSpec({
        area: 0,
        region: "",
      });
    } catch (error) {
      thrownError = error;
    }

    expect(isValidationError(thrownError)).toBe(true);
  });
});
