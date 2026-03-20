import {
  calculateEnhancedEstimate,
  conditionToRenovationScope,
  inferPropertyCategory,
  postcodeToRegion
} from "./enhancedEstimator";
import type { EnhancedEstimateInput } from "./types";

describe("enhancedEstimator", () => {
  it("maps postcode districts to regions", () => {
    expect(postcodeToRegion("SW1A")).toBe("London");
    expect(postcodeToRegion("RG1")).toBe("SouthEast");
    expect(postcodeToRegion("B1")).toBe("Midlands");
    expect(postcodeToRegion("LS1")).toBe("North");
    expect(postcodeToRegion("EH1")).toBe("Scotland");
    expect(postcodeToRegion("CF10")).toBe("Wales");
    expect(postcodeToRegion("ZZ1")).toBe("Midlands");
  });

  it("calculates baseline standard renovation totals with postcode regional pricing", () => {
    const input: EnhancedEstimateInput = {
      propertyCategory: "terraced",
      postcodeDistrict: "LS1",
      totalAreaM2: 80,
      renovationScope: "standard",
      qualityTier: "standard"
    };

    const result = calculateEnhancedEstimate(input);

    expect(result.region).toBe("North");
    expect(result.totalLow).toBe(95693);
    expect(result.totalTypical).toBe(143539);
    expect(result.totalHigh).toBe(199360);

    expect(result.costPerM2.typical).toBeCloseTo(result.totalTypical / input.totalAreaM2, 6);

    const categoriesTypicalTotal = result.categories.reduce(
      (sum, category) => sum + category.typical,
      0
    );
    expect(categoriesTypicalTotal).toBe(result.totalTypical);
  });

  it("adds feature costs and age/listed adjustments", () => {
    const input: EnhancedEstimateInput = {
      propertyCategory: "detached",
      postcodeDistrict: "SW1A",
      totalAreaM2: 120,
      renovationScope: "full",
      qualityTier: "premium",
      yearBuilt: 1900,
      listedBuilding: true,
      additionalFeatures: ["loft_conversion", "new_roof", "full_rewire"]
    };

    const result = calculateEnhancedEstimate(input);

    expect(result.region).toBe("London");
    expect(result.contingencyPercent).toBe(10);
    expect(result.feesPercent).toBe(8);

    expect(result.additionalFeatureCosts).toHaveLength(3);
    expect(result.additionalFeatureCosts.find((item) => item.feature === "loft_conversion")?.typical).toBe(
      60750
    );
    expect(result.additionalFeatureCosts.find((item) => item.feature === "new_roof")?.typical).toBe(12150);
    expect(result.additionalFeatureCosts.find((item) => item.feature === "full_rewire")?.typical).toBe(8100);

    expect(result.adjustments.some((item) => item.label.includes("Property age adjustment"))).toBe(true);
    expect(result.adjustments.some((item) => item.label.includes("Listed building surcharge"))).toBe(true);

    expect(result.totalTypical).toBeGreaterThan(result.baseRenovation.typical);
    expect(result.metadata.listedBuilding).toBe(true);
    expect(result.metadata.yearBuilt).toBe(1900);
    expect(result.metadata.estimatedAt).toEqual(expect.any(String));
  });

  it("maps legacy helpers for compatibility", () => {
    expect(conditionToRenovationScope("good")).toBe("cosmetic");
    expect(conditionToRenovationScope("fair")).toBe("standard");
    expect(conditionToRenovationScope("poor")).toBe("full");

    expect(inferPropertyCategory("Flat/Apartment")).toBe("flat");
    expect(inferPropertyCategory("Semi-detached house")).toBe("semi-detached");
    expect(inferPropertyCategory("Detached house")).toBe("detached");
    expect(inferPropertyCategory("Bungalow")).toBe("bungalow");
    expect(inferPropertyCategory("HMO investment")).toBe("hmo");
    expect(inferPropertyCategory("Commercial unit")).toBe("commercial");
  });

  it("validates invalid area/year/postcode inputs", () => {
    expect(() =>
      calculateEnhancedEstimate({
        propertyCategory: "flat",
        postcodeDistrict: "B1",
        totalAreaM2: 0,
        renovationScope: "cosmetic",
        qualityTier: "budget"
      })
    ).toThrow("Area must be greater than zero and no more than 2000m²");

    expect(() =>
      calculateEnhancedEstimate({
        propertyCategory: "flat",
        postcodeDistrict: "B1",
        totalAreaM2: 2001,
        renovationScope: "cosmetic",
        qualityTier: "budget"
      })
    ).toThrow("Area must be greater than zero and no more than 2000m²");

    expect(() =>
      calculateEnhancedEstimate({
        propertyCategory: "flat",
        postcodeDistrict: "",
        totalAreaM2: 50,
        renovationScope: "cosmetic",
        qualityTier: "budget"
      })
    ).toThrow("Postcode district is required");

    const nextYear = new Date().getFullYear() + 1;
    expect(() =>
      calculateEnhancedEstimate({
        propertyCategory: "flat",
        postcodeDistrict: "B1",
        totalAreaM2: 50,
        renovationScope: "cosmetic",
        qualityTier: "budget",
        yearBuilt: nextYear
      })
    ).toThrow(`Year built must be an integer between 1000 and ${new Date().getFullYear()}`);
  });
});
