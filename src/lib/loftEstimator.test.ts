import { calculateLoftEstimate, loftBaseRates } from "./loftEstimator";

describe("loftEstimator", () => {
  const baseInput = {
    postcodeDistrict: "B1", // West Midlands multiplier 1.0
    totalAreaM2: 20,
    conversionType: "rooflight" as const,
    finishLevel: "standard" as const,
  };

  it("keeps base rate ordering across types and finish levels", () => {
    expect(loftBaseRates.rooflight.standard).toBeLessThan(loftBaseRates.dormer.standard);
    expect(loftBaseRates.dormer.standard).toBeLessThan(loftBaseRates.hip_to_gable.standard);
    expect(loftBaseRates.hip_to_gable.standard).toBeLessThan(loftBaseRates.mansard.standard);

    expect(loftBaseRates.rooflight.basic).toBeLessThan(loftBaseRates.rooflight.standard);
    expect(loftBaseRates.rooflight.standard).toBeLessThan(loftBaseRates.rooflight.premium);
  });

  it("calculates totals and cost per m² without add-ons", () => {
    const result = calculateLoftEstimate(baseInput);

    expect(result.totalLow).toBe(17100);
    expect(result.totalTypical).toBe(19000);
    expect(result.totalHigh).toBe(21860);
    expect(result.costPerM2).toEqual({ low: 855, typical: 950, high: 1093 });
    expect(result.region).toBe("WestMidlands");
  });

  it("applies ensuite add-on as a flat amount", () => {
    const result = calculateLoftEstimate({ ...baseInput, addOns: { ensuite: true } });

    expect(result.totalLow).toBe(22100);
    expect(result.totalTypical).toBe(27500);
    expect(result.totalHigh).toBe(33860);
    expect(result.adjustments.some((item) => item.label === "Ensuite")).toBe(true);
  });

  it("applies juliet balcony add-on as a flat amount", () => {
    const result = calculateLoftEstimate({ ...baseInput, addOns: { juliet: true } });

    expect(result.totalLow).toBe(20100);
    expect(result.totalTypical).toBe(23000);
    expect(result.totalHigh).toBe(26860);
    expect(result.adjustments.some((item) => item.label.includes("Juliet"))).toBe(true);
  });

  it("applies both add-ons together", () => {
    const result = calculateLoftEstimate({ ...baseInput, addOns: { ensuite: true, juliet: true } });

    expect(result.totalLow).toBe(25100);
    expect(result.totalTypical).toBe(31500);
    expect(result.totalHigh).toBe(38860);
  });

  it("applies regional multiplier to all tiers", () => {
    const londonInput = { ...baseInput, postcodeDistrict: "SW1A" };
    const result = calculateLoftEstimate(londonInput);

    expect(result.region).toBe("London");
    expect(result.totalTypical).toBe(25650); // 19,000 * 1.35
    expect(result.totalLow).toBe(23085); // 17,100 * 1.35 -> 23,085
    expect(result.totalHigh).toBe(29511); // 21,860 * 1.35 -> 29,511
  });

  it.each([
    ["rooflight", "3–5 weeks"],
    ["dormer", "6–8 weeks"],
    ["hip_to_gable", "7–10 weeks"],
    ["mansard", "10–14 weeks"],
  ] as const)("sets planning note and timeline for %s", (conversionType, expectedTimeline) => {
    const result = calculateLoftEstimate({ ...baseInput, conversionType });
    expect(result.timeline).toBe(expectedTimeline);
    expect(result.planningNote.length).toBeGreaterThan(0);
  });
});
