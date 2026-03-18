import { defaultCostLibrary } from "./costLibrary";
import { estimateProject, estimateRooms } from "./estimator";
import type { EstimateInput, RoomInput } from "./types";

describe("estimateProject", () => {
  test("Budget North flat: 50m² gives typical ≈ £60,750", () => {
    const input: EstimateInput = {
      region: "North",
      projectType: "refurb",
      propertyType: "flat",
      totalAreaM2: 50,
      condition: "fair",
      finishLevel: "budget"
    };

    const result = estimateProject(input, defaultCostLibrary);

    expect(result.totalTypical).toBeCloseTo(60750, 2);
  });

  test("Premium London terrace totals are significantly higher than budget North case", () => {
    const budgetNorth: EstimateInput = {
      region: "North",
      projectType: "refurb",
      propertyType: "flat",
      totalAreaM2: 50,
      condition: "fair",
      finishLevel: "budget"
    };

    const premiumLondon: EstimateInput = {
      region: "London",
      projectType: "refurb",
      propertyType: "terrace",
      totalAreaM2: 100,
      condition: "poor",
      finishLevel: "premium"
    };

    const budgetResult = estimateProject(budgetNorth, defaultCostLibrary);
    const premiumResult = estimateProject(premiumLondon, defaultCostLibrary);

    expect(premiumResult.totalTypical).toBeCloseTo(438750, 2);
    expect(premiumResult.totalTypical).toBeGreaterThan(budgetResult.totalTypical * 5);
    expect(premiumResult.totalLow).toBeGreaterThan(budgetResult.totalLow * 5);
    expect(premiumResult.totalHigh).toBeGreaterThan(budgetResult.totalHigh * 5);
  });

  test("Standard Midlands baseline: 75m² gives typical £135,000 with no multiplier distortion", () => {
    const input: EstimateInput = {
      region: "Midlands",
      projectType: "refurb",
      propertyType: "semi",
      totalAreaM2: 75,
      condition: "fair",
      finishLevel: "standard"
    };

    const result = estimateProject(input, defaultCostLibrary);

    expect(result.totalTypical).toBeCloseTo(135000, 2);
    expect(result.costPerM2.typical).toBeCloseTo(1800, 2);
  });

  test("Zero area throws 'Area must be greater than zero'", () => {
    const input: EstimateInput = {
      region: "Midlands",
      projectType: "refurb",
      propertyType: "flat",
      totalAreaM2: 0,
      condition: "fair",
      finishLevel: "standard"
    };

    expect(() => estimateProject(input, defaultCostLibrary)).toThrow(
      "Area must be greater than zero"
    );
  });

  test("Negative area throws 'Area must be greater than zero'", () => {
    const input: EstimateInput = {
      region: "Midlands",
      projectType: "refurb",
      propertyType: "flat",
      totalAreaM2: -10,
      condition: "fair",
      finishLevel: "standard"
    };

    expect(() => estimateProject(input, defaultCostLibrary)).toThrow(
      "Area must be greater than zero"
    );
  });

  test("Category sum check: categories typical sum equals totalTypical within £1", () => {
    const input: EstimateInput = {
      region: "SouthEast",
      projectType: "refurb",
      propertyType: "detached",
      totalAreaM2: 120,
      condition: "fair",
      finishLevel: "standard"
    };

    const result = estimateProject(input, defaultCostLibrary);
    const categoriesTypicalSum = result.categories.reduce(
      (sum, category) => sum + category.typical,
      0
    );

    expect(Math.abs(categoriesTypicalSum - result.totalTypical)).toBeLessThanOrEqual(1);
  });

  test("Cost per m² check: typical equals totalTypical / totalAreaM2 within £1", () => {
    const input: EstimateInput = {
      region: "Scotland",
      projectType: "refurb",
      propertyType: "terraced",
      totalAreaM2: 88,
      condition: "good",
      finishLevel: "standard"
    };

    const result = estimateProject(input, defaultCostLibrary);
    const expectedTypicalCostPerM2 = result.totalTypical / input.totalAreaM2;

    expect(Math.abs(result.costPerM2.typical - expectedTypicalCostPerM2)).toBeLessThanOrEqual(
      1
    );
  });
});

describe("estimateRooms", () => {
  const londonFair = {
    region: "London" as const,
    condition: "fair" as const
  };
  const midlandsFair = {
    region: "Midlands" as const,
    condition: "fair" as const
  };

  const fullRooms: RoomInput[] = [
    {
      id: "room-kitchen",
      roomType: "kitchen",
      areaM2: 20,
      intensity: "full",
      finishLevel: "standard"
    },
    {
      id: "room-bathroom",
      roomType: "bathroom",
      areaM2: 5,
      intensity: "full",
      finishLevel: "standard"
    }
  ];

  test("Kitchen + bathroom full intensity returns plausible positive totals", () => {
    const result = estimateRooms(fullRooms, londonFair, defaultCostLibrary);

    expect(result.totalLow).toBeCloseTo(9687.5, 6);
    expect(result.totalTypical).toBeCloseTo(19375, 6);
    expect(result.totalHigh).toBeCloseTo(38750, 6);
    expect(result.totalLow).toBeGreaterThan(0);
    expect(result.totalTypical).toBeGreaterThan(result.totalLow);
    expect(result.totalHigh).toBeGreaterThan(result.totalTypical);
  });

  test("Light intensity rooms are exactly 60% of full intensity totals", () => {
    const lightRooms = fullRooms.map((room) => ({ ...room, intensity: "light" as const }));

    const fullResult = estimateRooms(fullRooms, londonFair, defaultCostLibrary);
    const lightResult = estimateRooms(lightRooms, londonFair, defaultCostLibrary);

    expect(lightResult.totalLow).toBeCloseTo(fullResult.totalLow * 0.6, 10);
    expect(lightResult.totalTypical).toBeCloseTo(fullResult.totalTypical * 0.6, 10);
    expect(lightResult.totalHigh).toBeCloseTo(fullResult.totalHigh * 0.6, 10);
  });

  test("Empty rooms array throws 'At least one room is required'", () => {
    expect(() => estimateRooms([], londonFair, defaultCostLibrary)).toThrow(
      "At least one room is required"
    );
  });

  test("Room with areaM2 = 0 throws 'Area must be greater than zero'", () => {
    const invalidRooms: RoomInput[] = [
      {
        id: "room-kitchen",
        roomType: "kitchen",
        areaM2: 0,
        intensity: "full",
        finishLevel: "standard"
      }
    ];

    expect(() => estimateRooms(invalidRooms, londonFair, defaultCostLibrary)).toThrow(
      "Area must be greater than zero"
    );
  });

  test("Three-room total equals sum of individual room costs", () => {
    const rooms: RoomInput[] = [
      {
        id: "room-1",
        roomType: "kitchen",
        areaM2: 10,
        intensity: "full",
        finishLevel: "standard"
      },
      {
        id: "room-2",
        roomType: "living",
        areaM2: 18,
        intensity: "light",
        finishLevel: "premium"
      },
      {
        id: "room-3",
        roomType: "utility",
        areaM2: 6,
        intensity: "full",
        finishLevel: "budget"
      }
    ];

    const combined = estimateRooms(rooms, londonFair, defaultCostLibrary);
    const summed = rooms
      .map((room) => estimateRooms([room], londonFair, defaultCostLibrary))
      .reduce(
        (acc, result) => ({
          low: acc.low + result.totalLow,
          typical: acc.typical + result.totalTypical,
          high: acc.high + result.totalHigh
        }),
        { low: 0, typical: 0, high: 0 }
      );

    expect(combined.totalLow).toBeCloseTo(summed.low, 10);
    expect(combined.totalTypical).toBeCloseTo(summed.typical, 10);
    expect(combined.totalHigh).toBeCloseTo(summed.high, 10);
  });

  test("Kitchen 10m² in Midlands/fair/full/standard gives typical ≈ £6,000", () => {
    const rooms: RoomInput[] = [
      {
        id: "room-kitchen",
        roomType: "kitchen",
        areaM2: 10,
        intensity: "full",
        finishLevel: "standard"
      }
    ];

    const result = estimateRooms(rooms, midlandsFair, defaultCostLibrary);

    expect(result.totalTypical).toBeCloseTo(6000, 6);
  });

  test("Kitchen room allocates spend across multiple categories", () => {
    const rooms: RoomInput[] = [
      {
        id: "room-kitchen",
        roomType: "kitchen",
        areaM2: 10,
        intensity: "full",
        finishLevel: "standard"
      }
    ];

    const result = estimateRooms(rooms, midlandsFair, defaultCostLibrary);
    const populatedCategories = result.categories.filter((category) => category.typical > 0);

    expect(populatedCategories.length).toBeGreaterThanOrEqual(5);
  });

  test("Room with areaM2 = 501 throws max area error", () => {
    const rooms: RoomInput[] = [
      {
        id: "room-large",
        roomType: "kitchen",
        areaM2: 501,
        intensity: "full",
        finishLevel: "standard"
      }
    ];

    expect(() => estimateRooms(rooms, midlandsFair, defaultCostLibrary)).toThrow(
      "Room area cannot exceed 500m²"
    );
  });
});
