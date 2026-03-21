import { calculateNewBuild } from "./newBuildEstimator";
import type { NewBuildInput } from "./types";

const baseHouseInput: NewBuildInput = {
  propertyType: "detached",
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
  test("Basic detached house returns expected typical total", () => {
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

  test("Bungalow costs more per m² than terraced at same spec", () => {
    const bungalow = calculateNewBuild(
      buildInput({ propertyType: "bungalow", totalAreaM2: 100, storeys: 1 })
    );
    const terraced = calculateNewBuild(
      buildInput({ propertyType: "terraced", totalAreaM2: 100, storeys: 1 })
    );

    expect(bungalow.costPerM2.typical).toBeGreaterThan(terraced.costPerM2.typical);
  });

  test("Block of flats returns cost per unit metadata", () => {
    const result = calculateNewBuild(
      buildInput({
        propertyType: "block_of_flats",
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

  test("Block of flats with lift adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: "block_of_flats",
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 6,
        numberOfStoreys: 3
      })
    );
    const withLift = calculateNewBuild(
      buildInput({
        propertyType: "block_of_flats",
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

  test("Commercial ground floor premium increases total", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: "block_of_flats",
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 6,
        numberOfStoreys: 3
      })
    );
    const withCommercial = calculateNewBuild(
      buildInput({
        propertyType: "block_of_flats",
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

  test("Blocks with 12+ units receive economies of scale discount", () => {
    const tenUnits = calculateNewBuild(
      buildInput({
        propertyType: "block_of_flats",
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 10,
        numberOfStoreys: 3
      })
    );
    const twelveUnits = calculateNewBuild(
      buildInput({
        propertyType: "block_of_flats",
        totalAreaM2: 600,
        bedrooms: 2,
        storeys: 3,
        numberOfUnits: 12,
        numberOfStoreys: 3
      })
    );

    expect(twelveUnits.totalTypical).toBeLessThan(tenUnits.totalTypical);
  });

  test("Garage option adds to total", () => {
    const base = calculateNewBuild(baseHouseInput);
    const withGarage = calculateNewBuild(buildInput({ garage: true }));

    expect(withGarage.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("Renewable energy option adds to total", () => {
    const base = calculateNewBuild(baseHouseInput);
    const withRenewables = calculateNewBuild(buildInput({ renewableEnergy: true }));

    expect(withRenewables.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("Basement option adds to total", () => {
    const base = calculateNewBuild(baseHouseInput);
    const withBasement = calculateNewBuild(buildInput({ basementIncluded: true }));

    expect(withBasement.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("Two storeys are cheaper per m² than one storey", () => {
    const oneStorey = calculateNewBuild(buildInput({ storeys: 1 }));
    const twoStorey = calculateNewBuild(buildInput({ storeys: 2 }));

    expect(twoStorey.costPerM2.typical).toBeLessThan(oneStorey.costPerM2.typical);
  });

  test("Zero area throws an error", () => {
    expect(() => calculateNewBuild(buildInput({ totalAreaM2: 0 }))).toThrow(
      "Total area must be between 1 and 10,000 square metres"
    );
  });

  test("Block of flats requires number of units", () => {
    expect(() =>
      calculateNewBuild(
        buildInput({ propertyType: "block_of_flats", numberOfUnits: undefined })
      )
    ).toThrow("Block of flats must include at least 2 units");
  });

  test("Category breakdown sums approximately to total", () => {
    const result = calculateNewBuild(baseHouseInput);
    const sum = result.categories.reduce((acc, category) => acc + category.typical, 0);
    expect(Math.abs(sum - result.totalTypical)).toBeLessThanOrEqual(100);
  });

  test("Postcode mapping applies London multiplier", () => {
    const midlands = calculateNewBuild(buildInput({ postcodeDistrict: "B1" }));
    const london = calculateNewBuild(buildInput({ postcodeDistrict: "SW1A" }));

    expect(london.totalTypical).toBeGreaterThan(midlands.totalTypical);
  });

  test("Flat ignores garage and basement add-ons", () => {
    const baseFlat = calculateNewBuild(
      buildInput({
        propertyType: "flat",
        totalAreaM2: 65,
        bedrooms: 2,
        storeys: 1,
        postcodeDistrict: "GU1"
      })
    );
    const withExtras = calculateNewBuild(
      buildInput({
        propertyType: "flat",
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

  test("HMO includes fire safety adjustment", () => {
    const result = calculateNewBuild(
      buildInput({
        propertyType: "hmo",
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 2,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6
      })
    );

    expect(result.adjustments.some((item) => item.label === "HMO fire safety package")).toBe(
      true
    );
  });

  test("HMO with en-suite rooms costs more than without", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: "hmo",
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 2,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6
      })
    );
    const withEnsuites = calculateNewBuild(
      buildInput({
        propertyType: "hmo",
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

  test("HMO fire escape is added for 3+ storeys", () => {
    const twoStorey = calculateNewBuild(
      buildInput({
        propertyType: "hmo",
        totalAreaM2: 200,
        bedrooms: 6,
        storeys: 2,
        postcodeDistrict: "NE1",
        numberOfLettableRooms: 6
      })
    );
    const threeStorey = calculateNewBuild(
      buildInput({
        propertyType: "hmo",
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

  test("Commercial shell only has lower total than Cat A", () => {
    const shellOnly = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "shell_only"
      })
    );
    const catA = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );

    expect(shellOnly.totalTypical).toBeLessThan(catA.totalTypical);
  });

  test("Commercial Cat B costs more than Cat A", () => {
    const catA = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );
    const catB = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_b"
      })
    );

    expect(catB.totalTypical).toBeGreaterThan(catA.totalTypical);
  });

  test("Commercial extraction adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a",
        commercialType: "restaurant"
      })
    );
    const withExtraction = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a",
        commercialType: "restaurant",
        extractionSystem: true
      })
    );

    expect(withExtraction.totalTypical).toBeGreaterThan(base.totalTypical);
  });

  test("Commercial parking adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );
    const withParking = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
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

  test("Commercial DDA compliance adds cost", () => {
    const base = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
        totalAreaM2: 500,
        bedrooms: 1,
        storeys: 1,
        postcodeDistrict: "M1",
        fitOutLevel: "cat_a"
      })
    );
    const withDda = calculateNewBuild(
      buildInput({
        propertyType: "commercial",
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

  test("HMO with fewer than 3 lettable rooms throws", () => {
    expect(() =>
      calculateNewBuild(
        buildInput({
          propertyType: "hmo",
          totalAreaM2: 200,
          bedrooms: 2,
          storeys: 2,
          postcodeDistrict: "NE1",
          numberOfLettableRooms: 2
        })
      )
    ).toThrow("HMOs require at least 3 lettable rooms");
  });
});
