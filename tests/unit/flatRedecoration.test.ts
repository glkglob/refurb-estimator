import { defaultCostLibrary } from "@/lib/costLibrary";
import { estimateProject, estimateRooms } from "@/lib/estimator";
import { PropertyType } from "@/lib/propertyType";
import type { EstimateInput, RoomInput } from "@/lib/types";

/**
 * Estimate: redecorate a 65 m² flat with 2 bathrooms.
 *
 * Assumptions
 * - Region: London
 * - Condition: fair (existing liveable flat)
 * - Finish: standard
 * - Intensity: light (cosmetic redecoration, not a full strip-out)
 *
 * Room layout (totals 65 m²):
 *   2 × bathroom  4 m²  =  8 m²
 *   1 × kitchen   8 m²  =  8 m²
 *   1 × living   18 m²  = 18 m²
 *   2 × bedroom  12 m²  = 24 m²
 *   1 × hallway   7 m²  =  7 m²
 *                         ------
 *                          65 m²
 */

const BASE_INPUT = {
  region: "london" as const,
  condition: "fair" as const,
};

const ROOMS: RoomInput[] = [
  { id: "bath-1", roomType: "bathroom", areaM2: 4, intensity: "light", finishLevel: "standard" },
  { id: "bath-2", roomType: "bathroom", areaM2: 4, intensity: "light", finishLevel: "standard" },
  { id: "kitchen", roomType: "kitchen", areaM2: 8, intensity: "light", finishLevel: "standard" },
  { id: "living", roomType: "living", areaM2: 18, intensity: "light", finishLevel: "standard" },
  { id: "bed-1", roomType: "bedroom", areaM2: 12, intensity: "light", finishLevel: "standard" },
  { id: "bed-2", roomType: "bedroom", areaM2: 12, intensity: "light", finishLevel: "standard" },
  { id: "hallway", roomType: "hallway", areaM2: 7, intensity: "light", finishLevel: "standard" },
];

describe("Flat 65m² redecoration – 2 bathrooms", () => {
  test("room areas sum to 65 m²", () => {
    const totalArea = ROOMS.reduce((sum, r) => sum + r.areaM2, 0);
    expect(totalArea).toBe(65);
  });

  test("room-level estimate returns positive low / typical / high", () => {
    const result = estimateRooms(ROOMS, BASE_INPUT, defaultCostLibrary);
    expect(result.totalLow).toBeGreaterThan(0);
    expect(result.totalTypical).toBeGreaterThan(result.totalLow);
    expect(result.totalHigh).toBeGreaterThan(result.totalTypical);
  });

  test("categories sum equals totalTypical within £1", () => {
    const result = estimateRooms(ROOMS, BASE_INPUT, defaultCostLibrary);
    const catSum = result.categories.reduce((s, c) => s + c.typical, 0);
    expect(Math.abs(catSum - result.totalTypical)).toBeLessThanOrEqual(1);
  });

  test("two bathrooms contribute roughly double a single bathroom", () => {
    const twoBaths = estimateRooms(
      ROOMS.filter((r) => r.roomType === "bathroom"),
      BASE_INPUT,
      defaultCostLibrary,
    );
    const oneBath = estimateRooms(
      [ROOMS.find((r) => r.roomType === "bathroom")!],
      BASE_INPUT,
      defaultCostLibrary,
    );
    expect(twoBaths.totalTypical).toBeCloseTo(oneBath.totalTypical * 2, 6);
  });

  test("whole-flat project estimate is consistent with room-level order of magnitude", () => {
    const projectInput: EstimateInput = {
      region: "london",
      projectType: "refurb",
      propertyType: PropertyType.FLAT_APARTMENT,
      totalAreaM2: 65,
      condition: "fair",
      finishLevel: "standard",
    };
    const projectResult = estimateProject(projectInput, defaultCostLibrary);
    const roomResult = estimateRooms(ROOMS, BASE_INPUT, defaultCostLibrary);

    // Room-level light redecoration should be cheaper than a full project estimate
    expect(roomResult.totalTypical).toBeLessThan(projectResult.totalTypical);
    expect(roomResult.totalTypical).toBeGreaterThan(0);
  });

  test("snapshot: print estimate breakdown", () => {
    const result = estimateRooms(ROOMS, BASE_INPUT, defaultCostLibrary);
    const fmt = (v: number) =>
      new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

    const summary = {
      totalLow: fmt(result.totalLow),
      totalTypical: fmt(result.totalTypical),
      totalHigh: fmt(result.totalHigh),
      costPerM2: {
        low: fmt(result.costPerM2.low),
        typical: fmt(result.costPerM2.typical),
        high: fmt(result.costPerM2.high),
      },
      categories: result.categories
        .filter((c) => c.typical > 0)
        .map((c) => ({
          category: c.category,
          low: fmt(c.low),
          typical: fmt(c.typical),
          high: fmt(c.high),
        })),
    };

    // Log for visibility when running with --verbose
    console.log(JSON.stringify(summary, null, 2));

    // Basic sanity: formatted total should contain £
    expect(summary.totalTypical).toContain("£");
  });
});
