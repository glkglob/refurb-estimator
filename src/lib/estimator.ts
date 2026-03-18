import type {
  CategoryBreakdown,
  CostCategory,
  CostLibrary,
  EstimateInput,
  EstimateResult,
  RoomInput
} from "./types";
import {
  getConditionMultiplier,
  getFinishMultiplier,
  getRegionalMultiplier
} from "./costLibrary";

export function estimateProject(
  input: EstimateInput,
  costLibrary: CostLibrary
): EstimateResult {
  if (input.totalAreaM2 <= 0) {
    throw new Error("Area must be greater than zero");
  }

  const regionalMultiplier = getRegionalMultiplier(input.region, costLibrary);
  const conditionMultiplier = getConditionMultiplier(input.condition, costLibrary);
  const finishMultiplier = getFinishMultiplier(input.finishLevel, costLibrary);

  const rawTotalLow =
    input.totalAreaM2 *
    costLibrary.baseRefurbPerM2.low *
    regionalMultiplier *
    conditionMultiplier *
    finishMultiplier;

  const rawTotalTypical =
    input.totalAreaM2 *
    costLibrary.baseRefurbPerM2.typical *
    regionalMultiplier *
    conditionMultiplier *
    finishMultiplier;

  const rawTotalHigh =
    input.totalAreaM2 *
    costLibrary.baseRefurbPerM2.high *
    regionalMultiplier *
    conditionMultiplier *
    finishMultiplier;

  const totalLow = Math.round(rawTotalLow);
  const totalTypical = Math.round(rawTotalTypical);
  const totalHigh = Math.round(rawTotalHigh);

  const categoriesInOrder = Object.keys(costLibrary.categoryPercents) as CostCategory[];
  const balancingCategory = categoriesInOrder.includes("fees")
    ? "fees"
    : categoriesInOrder[categoriesInOrder.length - 1];

  function buildRoundedTierCategoryAmounts(
    rawTotal: number,
    roundedTotal: number
  ): Record<CostCategory, number> {
    const amounts = {} as Record<CostCategory, number>;
    let runningSum = 0;

    for (const category of categoriesInOrder) {
      if (category === balancingCategory) {
        continue;
      }

      const rawCategoryAmount = rawTotal * costLibrary.categoryPercents[category];
      const roundedCategoryAmount = Math.round(rawCategoryAmount);
      amounts[category] = roundedCategoryAmount;
      runningSum += roundedCategoryAmount;
    }

    amounts[balancingCategory] = roundedTotal - runningSum;
    return amounts;
  }

  const lowCategoryAmounts = buildRoundedTierCategoryAmounts(rawTotalLow, totalLow);
  const typicalCategoryAmounts = buildRoundedTierCategoryAmounts(rawTotalTypical, totalTypical);
  const highCategoryAmounts = buildRoundedTierCategoryAmounts(rawTotalHigh, totalHigh);

  const categories = categoriesInOrder.map(
    (category): CategoryBreakdown => ({
      category,
      low: lowCategoryAmounts[category],
      typical: typicalCategoryAmounts[category],
      high: highCategoryAmounts[category]
    })
  );

  return {
    totalLow,
    totalTypical,
    totalHigh,
    costPerM2: {
      low: totalLow / input.totalAreaM2,
      typical: totalTypical / input.totalAreaM2,
      high: totalHigh / input.totalAreaM2
    },
    categories
  };
}

const intensityMultipliers: Record<RoomInput["intensity"], number> = {
  light: 0.6,
  full: 1.0
};

export function estimateRooms(
  rooms: RoomInput[],
  baseInput: Pick<EstimateInput, "region" | "condition">,
  costLibrary: CostLibrary
): EstimateResult {
  if (rooms.length === 0) {
    throw new Error("At least one room is required");
  }

  for (const room of rooms) {
    if (!Number.isFinite(room.areaM2) || room.areaM2 <= 0) {
      throw new Error("Area must be greater than zero");
    }
    if (room.areaM2 > 500) {
      throw new Error("Room area cannot exceed 500m²");
    }
  }

  const categoriesInOrder = Object.keys(costLibrary.categoryPercents) as CostCategory[];
  const regionalMultiplier = getRegionalMultiplier(baseInput.region, costLibrary);
  const conditionMultiplier = getConditionMultiplier(baseInput.condition, costLibrary);

  const categoryTotals = categoriesInOrder.reduce<Record<CostCategory, CategoryBreakdown>>(
    (acc, category) => {
      acc[category] = {
        category,
        low: 0,
        typical: 0,
        high: 0
      };
      return acc;
    },
    {} as Record<CostCategory, CategoryBreakdown>
  );

  let totalLow = 0;
  let totalTypical = 0;
  let totalHigh = 0;
  let totalAreaM2 = 0;

  for (const room of rooms) {
    const baseRange = costLibrary.roomBaseRanges[room.roomType];
    const finishMultiplier = getFinishMultiplier(room.finishLevel, costLibrary);
    const intensityMultiplier = intensityMultipliers[room.intensity];
    const roomMultiplier =
      room.areaM2 * regionalMultiplier * conditionMultiplier * finishMultiplier * intensityMultiplier;

    const roomLow = baseRange.low * roomMultiplier;
    const roomTypical = baseRange.typical * roomMultiplier;
    const roomHigh = baseRange.high * roomMultiplier;

    totalLow += roomLow;
    totalTypical += roomTypical;
    totalHigh += roomHigh;
    totalAreaM2 += room.areaM2;

    const allocations = costLibrary.roomCategoryAllocations[room.roomType];
    let allocationSum = 0;

    for (const [category, share] of Object.entries(allocations) as [
      CostCategory,
      number
    ][]) {
      allocationSum += share;
      categoryTotals[category].low += roomLow * share;
      categoryTotals[category].typical += roomTypical * share;
      categoryTotals[category].high += roomHigh * share;
    }

    if (Math.abs(allocationSum - 1) > 1e-9) {
      throw new Error(`Room category allocation for ${room.roomType} must sum to 1.0`);
    }
  }

  return {
    totalLow,
    totalTypical,
    totalHigh,
    costPerM2: {
      low: totalLow / totalAreaM2,
      typical: totalTypical / totalAreaM2,
      high: totalHigh / totalAreaM2
    },
    categories: categoriesInOrder.map((category) => categoryTotals[category])
  };
}
