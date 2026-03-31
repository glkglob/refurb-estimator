import {
  calculateEnhancedEstimate,
  conditionToRenovationScope,
  inferPropertyCategory,
  postcodeToRegion,
} from "./enhancedEstimator";
import type { EnhancedEstimateInput } from "./types";

describe("enhancedEstimator", () => {
  describe("postcodeToRegion", () => {
    const postcodeCases: Array<[string, string]> = [
      ["SW1A", "london"],
      ["RG1", "south_east"],
      ["CB1", "east_of_england"],
      ["NG1", "east_midlands"],
      ["B1", "west_midlands"],
      ["BS1", "south_west"],
      ["L1", "north_west"],
      ["NE1", "north_east"],
      ["LS1", "yorkshire_and_humber"],
      ["EH1", "scotland"],
      ["CF10", "wales"],
      ["BT1", "northern_ireland"],
    ];

    it.each(postcodeCases)("maps %s to %s", (postcode, expectedRegion) => {
      expect(postcodeToRegion(postcode)).toBe(expectedRegion);
    });

    it("normalizes spacing and casing", () => {
      expect(postcodeToRegion(" sw1a ")).toBe("london");
      expect(postcodeToRegion("l1")).toBe("north_west");
      expect(postcodeToRegion("ne1")).toBe("north_east");
    });

    it("supports full postcodes when outward code is present", () => {
      expect(postcodeToRegion("SW1A 1AA")).toBe("london");
      expect(postcodeToRegion("L1 8JQ")).toBe("north_west");
      expect(postcodeToRegion("EH1 1YZ")).toBe("scotland");
    });
  });

  describe("regional estimate examples", () => {
    const regionalExamples: Array<{
      region: string;
      input: EnhancedEstimateInput;
    }> = [
      {
        region: "london",
        input: {
          propertyCategory: "flat",
          postcodeDistrict: "SW1A",
          totalAreaM2: 55,
          renovationScope: "cosmetic",
          qualityTier: "standard",
        },
      },
      {
        region: "south_east",
        input: {
          propertyCategory: "semi-detached",
          postcodeDistrict: "RG1",
          totalAreaM2: 95,
          renovationScope: "standard",
          qualityTier: "standard",
        },
      },
      {
        region: "east_of_england",
        input: {
          propertyCategory: "terraced",
          postcodeDistrict: "CB1",
          totalAreaM2: 82,
          renovationScope: "standard",
          qualityTier: "budget",
        },
      },
      {
        region: "east_midlands",
        input: {
          propertyCategory: "detached",
          postcodeDistrict: "NG1",
          totalAreaM2: 130,
          renovationScope: "full",
          qualityTier: "standard",
        },
      },
      {
        region: "west_midlands",
        input: {
          propertyCategory: "bungalow",
          postcodeDistrict: "B1",
          totalAreaM2: 88,
          renovationScope: "standard",
          qualityTier: "standard",
        },
      },
      {
        region: "south_west",
        input: {
          propertyCategory: "terraced",
          postcodeDistrict: "BS1",
          totalAreaM2: 78,
          renovationScope: "cosmetic",
          qualityTier: "premium",
        },
      },
      {
        region: "north_west",
        input: {
          propertyCategory: "terraced",
          postcodeDistrict: "L1",
          totalAreaM2: 80,
          renovationScope: "standard",
          qualityTier: "standard",
        },
      },
      {
        region: "north_east",
        input: {
          propertyCategory: "flat",
          postcodeDistrict: "NE1",
          totalAreaM2: 60,
          renovationScope: "full",
          qualityTier: "budget",
        },
      },
      {
        region: "yorkshire_and_humber",
        input: {
          propertyCategory: "semi-detached",
          postcodeDistrict: "LS1",
          totalAreaM2: 92,
          renovationScope: "standard",
          qualityTier: "standard",
        },
      },
      {
        region: "scotland",
        input: {
          propertyCategory: "flat",
          postcodeDistrict: "EH1",
          totalAreaM2: 68,
          renovationScope: "cosmetic",
          qualityTier: "standard",
        },
      },
      {
        region: "wales",
        input: {
          propertyCategory: "detached",
          postcodeDistrict: "CF10",
          totalAreaM2: 110,
          renovationScope: "full",
          qualityTier: "standard",
        },
      },
      {
        region: "northern_ireland",
        input: {
          propertyCategory: "semi-detached",
          postcodeDistrict: "BT1",
          totalAreaM2: 85,
          renovationScope: "standard",
          qualityTier: "budget",
        },
      },
    ];

    it.each(regionalExamples)(
      "calculates a valid estimate example for $region",
      ({ region, input }) => {
        const result = calculateEnhancedEstimate(input);

        expect(result.region).toBe(region);

        expect(result.totalLow).toBeGreaterThan(0);
        expect(result.totalTypical).toBeGreaterThan(0);
        expect(result.totalHigh).toBeGreaterThan(0);

        expect(result.totalLow).toBeLessThan(result.totalTypical);
        expect(result.totalTypical).toBeLessThan(result.totalHigh);

        expect(result.costPerM2.low).toBeGreaterThan(0);
        expect(result.costPerM2.typical).toBeGreaterThan(0);
        expect(result.costPerM2.high).toBeGreaterThan(0);

        expect(result.costPerM2.low).toBeCloseTo(
          result.totalLow / input.totalAreaM2,
          6,
        );
        expect(result.costPerM2.typical).toBeCloseTo(
          result.totalTypical / input.totalAreaM2,
          6,
        );
        expect(result.costPerM2.high).toBeCloseTo(
          result.totalHigh / input.totalAreaM2,
          6,
        );

        expect(result.categories.length).toBeGreaterThan(0);

        const lowCategoriesTotal = result.categories.reduce(
          (sum, category) => sum + category.low,
          0,
        );
        const typicalCategoriesTotal = result.categories.reduce(
          (sum, category) => sum + category.typical,
          0,
        );
        const highCategoriesTotal = result.categories.reduce(
          (sum, category) => sum + category.high,
          0,
        );

        expect(lowCategoriesTotal).toBe(result.totalLow);
        expect(typicalCategoriesTotal).toBe(result.totalTypical);
        expect(highCategoriesTotal).toBe(result.totalHigh);

        expect(result.metadata.estimatedAt).toEqual(expect.any(String));
        expect(Number.isNaN(Date.parse(result.metadata.estimatedAt))).toBe(false);
      },
    );

    it("includes a detailed London example with additional features and adjustments", () => {
      const input: EnhancedEstimateInput = {
        propertyCategory: "detached",
        postcodeDistrict: "SW1A",
        totalAreaM2: 120,
        renovationScope: "full",
        qualityTier: "premium",
        yearBuilt: 1900,
        listedBuilding: true,
        additionalFeatures: ["loft_conversion", "new_roof", "full_rewire"],
      };

      const result = calculateEnhancedEstimate(input);

      expect(result.region).toBe("london");
      expect(result.contingencyPercent).toBe(10);
      expect(result.feesPercent).toBe(8);

      expect(result.additionalFeatureCosts).toHaveLength(3);

      const featureCosts = Object.fromEntries(
        result.additionalFeatureCosts.map((item) => [item.feature, item.typical]),
      );

      expect(featureCosts.loft_conversion).toBeGreaterThan(0);
      expect(featureCosts.new_roof).toBeGreaterThan(0);
      expect(featureCosts.full_rewire).toBeGreaterThan(0);

      expect(
        result.adjustments.some((item) =>
          item.label.includes("Property age adjustment"),
        ),
      ).toBe(true);

      expect(
        result.adjustments.some((item) =>
          item.label.includes("Listed building surcharge"),
        ),
      ).toBe(true);

      expect(result.totalTypical).toBeGreaterThan(result.baseRenovation.typical);
      expect(result.metadata.listedBuilding).toBe(true);
      expect(result.metadata.yearBuilt).toBe(1900);
    });
  });

  describe("legacy compatibility helpers", () => {
    it("maps condition to renovation scope", () => {
      expect(conditionToRenovationScope("good")).toBe("cosmetic");
      expect(conditionToRenovationScope("fair")).toBe("standard");
      expect(conditionToRenovationScope("poor")).toBe("full");
    });

    it("infers property category from legacy labels", () => {
      expect(inferPropertyCategory("Flat/Apartment")).toBe("flat");
      expect(inferPropertyCategory("Semi-detached house")).toBe("semi-detached");
      expect(inferPropertyCategory("Detached house")).toBe("detached");
      expect(inferPropertyCategory("Bungalow")).toBe("bungalow");
      expect(inferPropertyCategory("HMO investment")).toBe("hmo");
      expect(inferPropertyCategory("Commercial unit")).toBe("commercial");
    });
  });

  describe("validation", () => {
    it("validates invalid area/year/postcode inputs", () => {
      expect(() =>
        calculateEnhancedEstimate({
          propertyCategory: "flat",
          postcodeDistrict: "B1",
          totalAreaM2: 0,
          renovationScope: "cosmetic",
          qualityTier: "budget",
        }),
      ).toThrow("Area must be greater than zero and no more than 2000m²");

      expect(() =>
        calculateEnhancedEstimate({
          propertyCategory: "flat",
          postcodeDistrict: "B1",
          totalAreaM2: 2001,
          renovationScope: "cosmetic",
          qualityTier: "budget",
        }),
      ).toThrow("Area must be greater than zero and no more than 2000m²");

      expect(() =>
        calculateEnhancedEstimate({
          propertyCategory: "flat",
          postcodeDistrict: "",
          totalAreaM2: 50,
          renovationScope: "cosmetic",
          qualityTier: "budget",
        }),
      ).toThrow("Postcode district is required");

      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      expect(() =>
        calculateEnhancedEstimate({
          propertyCategory: "flat",
          postcodeDistrict: "B1",
          totalAreaM2: 50,
          renovationScope: "cosmetic",
          qualityTier: "budget",
          yearBuilt: nextYear,
        }),
      ).toThrow(
        `Year built must be an integer between 1000 and ${currentYear}`,
      );
    });
  });
});
