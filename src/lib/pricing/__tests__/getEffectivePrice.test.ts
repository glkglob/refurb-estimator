import { getEffectivePrice } from "../getEffectivePrice";
import type { MaterialId } from "../../../types/material";

describe("getEffectivePrice", () => {
  test("returns supplier override when provided", () => {
    const result = getEffectivePrice("paint", "mid", 5.789);

    expect(result).toBe(5.79);
  });

  test("falls back to internal material band when supplier price is missing", () => {
    const result = getEffectivePrice("laminate_flooring", "low", null);

    expect(result).toBe(15);
  });

  test("falls back to internal material band when supplier price is invalid", () => {
    const result = getEffectivePrice("engineered_wood", "high", Number.NaN);

    expect(result).toBe(120);
  });

  test("throws for unknown material id", () => {
    const invalidMaterialId = "not-a-material" as MaterialId;

    expect(() => getEffectivePrice(invalidMaterialId, "mid")).toThrow(
      "Material not found: not-a-material"
    );
  });
});
