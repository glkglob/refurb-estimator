import { calculateNewBuild } from "./newBuildEstimator";
import { PropertyType } from "./propertyType";
import type { NewBuildInput } from "./types";

const baseHouseInput: NewBuildInput = {
  propertyType: PropertyType.DETACHED_HOUSE,
  spec: "standard",
  totalAreaM2: 120,
  bedrooms: 3,
  storeys: 2,
  postcodeDistrict: "B1"
};

function buildInput(overrides: Partial<NewBuildInput>): NewBuildInput {
  return {
    ...baseHouseInput,
    ...overrides
  };
}

describe("calculateNewBuild", () => {
  test("basic detached house returns expected typical total", () => {
    const result = calculateNewBuild(baseHouseInput);
    const baseTypical = 120 * 2800 * 0.95;
    const expectedTypical = Math.round(baseTypical * 1.22);
    expect(result.totalTypical).toBeCloseTo(expectedTypical, 0);
  });

  test("London premium detached is significantly higher than Midlands standard", () => {
    const midlands = calculateNewBuild(baseHouseInput);
    const london = calculateNewBuild(
      buildInput({
        spec: "premium",
        postcodeDistrict: "SW1A"
      })
    );

    expect(london.totalTypical).toBeGreaterThan(midlands.totalTypical * 1.5);
  });

  test("bungalow costs more per m² than terraced at same spec", () => {
    const bungalow = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.BUNGALOW,
        totalAreaM2: 100,
        storeys: 1
      })
    );
    const terraced = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.TERRACED_HOUSE,
        totalAreaM2: 100,
        storeys: 1
      })
    );

    expect(bungalow.costPerM2.typical).toBeGreaterThan(terraced.costPerM2.typical);
  });

  test("multi-unit flat build returns cost per unit metadata", () => {
    const result = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 6,
        numberOfStoreys: 3
      })
    );

    expect(result.metadata.costPerUnit).toBeDefined();
    expect(result.metadata.costPerUnit?.typical).toBeGreaterThan(0);
  });

  test("multi-unit build with lift adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 6,
        numberOfStoreys: 3
      })
    );
    const withLift = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 6,
        numberOfStoreys: 3,
        liftIncluded: true
      })
    );

    expect(withLift.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("commercial ground floor premium increases total", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 6,
        numberOfStoreys: 3
      })
    );
    const withCommercial = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 6,
        numberOfStoreys: 3,
        commercialGroundFloor: true
      })
    );

    expect(withCommercial.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("developments with 12+ units receive economies-of-scale discount", () => {
    const tenUnits = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 10,
        numberOfStoreys: 3
      })
    );
    const twelveUnits = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 12,
        numberOfStoreys: 3
      })
    );

    expect(twelveUnits.totalTypical).toBeLessThan(tenUnits.totalTypical);
  });

  test("garage option adds to total for houses", () => {
    const base = calculateNewBuild(baseHouseInput);
    const withGarage = calculateNewBuild(buildInput({ garage: true }));
    expect(withGarage.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("renewable energy option adds to total", () => {
    const base = calculateNewBuild(baseHouseInput);
    const withRenewables = calculateNewBuild(buildInput({ renewableEnergy: true }));
    expect(withRenewables.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("basement option adds to total for houses", () => {
    const base = calculateNewBuild(baseHouseInput);
    const withBasement = calculateNewBuild(buildInput({ basementIncluded: true }));
    expect(withBasement.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("two storeys are cheaper per m² than one storey", () => {
    const oneStorey = calculateNewBuild(buildInput({ storeys: 1 }));
    const twoStorey = calculateNewBuild(buildInput({ storeys: 2 }));
    expect(twoStorey.costPerM2.typical).toBeLessThan(oneStorey.costPerM2.typical);
  });

  test("zero area throws an error", () => {
    expect(() => calculateNewBuild(buildInput({ totalAreaM2: 0 }))).toThrow(
      "Total area must be between 1 and 10,000 square metres"
    );
  });

  test("numberOfUnits below 2 throws", () => {
    expect(() =>
      calculateNewBuild(
        buildInput({
          propertyType: PropertyType.FLAT_APARTMENT,
          numberOfUnits: 1
        })
      )
    ).toThrow("Developments with units must include at least 2 units");
  });

  test("category breakdown sums approximately to total", () => {
    const result = calculateNewBuild(baseHouseInput);
    const sum = result.categories.reduce((acc, category) => acc + category.typical, 0);
    expect(Math.abs(sum - result.totalTypical)).toBeLessThanOrEqual(100);
  });

  test("postcode mapping applies London multiplier", () => {
    const midlands = calculateNewBuild(buildInput({ postcodeDistrict: "B1" }));
    const london = calculateNewBuild(buildInput({ postcodeDistrict: "SW1A" }));
    expect(london.totalTypical).toBeGreaterThan(midlands.totalTypical);
  });

  test("flat/apartment ignores garage and basement add-ons", () => {
    const baseFlat = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 65,
        bedrooms: 2,
        storeys: 1,
        postcodeDistrict: "GU1"
      })
    );
    const withExtras = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.FLAT_APARTMENT,
        totalAreaM2: 65,
        bedrooms: 2,
        storeys: 1,
        postcodeDistrict: "GU1",
        garage: true,
        basementIncluded: true
      })
    );

    expect(withExtras.totalTypical).toBe(baseFlat.totalTypical);
  });

  test("rental layout includes fire safety adjustment", () => {
    const result = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.TOWNHOUSE,
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 2,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6
      })
    );

    expect(
      result.adjustments.some((item) => item.label === "Rental fire safety package")
    ).toBe(true);
  });

  test("rental layout with en-suite rooms costs more than without", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.TOWNHOUSE,
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 2,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6
      })
    );
    const withEnsuites = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.TOWNHOUSE,
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 2,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6,
        enSuitePerRoom: true
      })
    );

    expect(withEnsuites.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("external fire escape is added for 3+ storeys with rental layout", () => {
    const twoStorey = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.TOWNHOUSE,
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 2,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6
      })
    );
    const threeStorey = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.TOWNHOUSE,
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 3,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6
      })
    );

    const twoStoreyEscape = twoStorey.adjustments.find(
      (adjustment) => adjustment.label === "External fire escape"
    );
    const threeStoreyEscape = threeStorey.adjustments.find(
      (adjustment) => adjustment.label === "External fire escape"
    );

    expect(twoStoreyEscape).toBeUndefined();
    expect(threeStoreyEscape?.amount ?? 0).toBeGreaterThan(0);
  });

  test("office shell-only has lower total than cat A", () => {
    const shellOnly = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.OFFICE,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "shell_only"
      })
    );
    const catA = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.OFFICE,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );

    expect(shellOnly.totalTypical).toBeLessThan(catA.totalTypical);
  });

  test("office cat B costs more than cat A", () => {
    const catA = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.OFFICE,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );
    const catB = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.OFFICE,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_b"
      })
    );

    expect(catB.totalTypical).toBeGreaterThan(catA.totalTypical);
  });

  test("retail extraction adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.RETAIL,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a",
        extractionSystem: false
      })
    );
    const withExtraction = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.RETAIL,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a",
        extractionSystem: true
      })
    );

    expect(withExtraction.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("commercial parking adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.INDUSTRIAL,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );
    const withParking = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.INDUSTRIAL,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a",
        parkingSpaces: 10
      })
    );

    expect(withParking.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("commercial DDA compliance adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.HEALTHCARE,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );
    const withDda = calculateNewBuild(
      buildInput({
        propertyType: PropertyType.HEALTHCARE,
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a",
        disabledAccess: true
      })
    );

    expect(withDda.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("lettable rooms below 3 throws", () => {
    expect(() =>
      calculateNewBuild(
        buildInput({
          propertyType: PropertyType.TOWNHOUSE,
          totalAreaM2: 200,
          bedrooms: 2,
          storeys: 2,
          postcodeDistrict: "NE1",
          numberOfLettableRooms: 2
        })
      )
    ).toThrow("Lettable rooms must be at least 3");
  });
});
