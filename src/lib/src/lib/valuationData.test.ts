import { calculateUplift, calculateValuation } from "./valuationData";

describe("calculateUplift", () => {
  test("returns uplift, new value, and ROI for known inputs", () => {
    const result = calculateUplift({
      currentValue: 200_000,
      refurbCost: 20_000,
      refurbType: "medium",
    });

    expect(result.upliftMin).toBeCloseTo(20_000);
    expect(result.upliftMax).toBeCloseTo(30_000);
    expect(result.newValueMin).toBeCloseTo(220_000);
    expect(result.newValueMax).toBeCloseTo(230_000);
    expect(result.roiMin).toBeCloseTo(1);
    expect(result.roiMax).toBeCloseTo(1.5);
  });

  test("ROI changes when refurbCost changes for the same currentValue and refurbType", () => {
    const lowerCostResult = calculateUplift({
      currentValue: 250_000,
      refurbCost: 25_000,
      refurbType: "heavy",
    });

    const higherCostResult = calculateUplift({
      currentValue: 250_000,
      refurbCost: 50_000,
      refurbType: "heavy",
    });

    expect(lowerCostResult.upliftMin).toBeCloseTo(higherCostResult.upliftMin);
    expect(lowerCostResult.upliftMax).toBeCloseTo(higherCostResult.upliftMax);

    expect(lowerCostResult.roiMin).toBeCloseTo(1.5);
    expect(lowerCostResult.roiMax).toBeCloseTo(2.5);

    expect(higherCostResult.roiMin).toBeCloseTo(0.75);
    expect(higherCostResult.roiMax).toBeCloseTo(1.25);
  });

  test("returns roi 0 when refurbCost is 0", () => {
    const result = calculateUplift({
      currentValue: 200_000,
      refurbCost: 0,
      refurbType: "medium",
    });

    expect(result.upliftMin).toBeCloseTo(20_000);
    expect(result.upliftMax).toBeCloseTo(30_000);
    expect(result.roiMin).toBe(0);
    expect(result.roiMax).toBe(0);
  });

  test("throws when currentValue is 0", () => {
    expect(() =>
      calculateUplift({
        currentValue: 0,
        refurbCost: 10_000,
        refurbType: "light",
      }),
    ).toThrow("currentValue must be a finite number greater than 0");
  });
});

describe("calculateValuation", () => {
  test("calculates uplift and ROI for a profitable refurb", () => {
    const result = calculateValuation({
      currentValue: 350_000,
      refurbCost: 25_000,
      expectedValue: 425_000,
    });

    expect(result.grossUplift).toBe(75_000);
    expect(result.netUplift).toBe(50_000);
    expect(result.roiPercent).toBe(200.0);
  });

  test("handles zero refurb cost safely", () => {
    const result = calculateValuation({
      currentValue: 300_000,
      refurbCost: 0,
      expectedValue: 330_000,
    });

    expect(result.grossUplift).toBe(30_000);
    expect(result.netUplift).toBe(30_000);
    expect(result.roiPercent).toBe(0);
  });

  test("handles negative uplift (bad deal)", () => {
    const result = calculateValuation({
      currentValue: 400_000,
      refurbCost: 40_000,
      expectedValue: 380_000,
    });

    expect(result.grossUplift).toBe(-20_000);
    expect(result.netUplift).toBe(-60_000);
    expect(result.roiPercent).toBeCloseTo(-150.0);
  });
});
