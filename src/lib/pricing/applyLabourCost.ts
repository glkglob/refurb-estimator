import type { EstimateResult, NewBuildResult } from "@/lib/types";

type LabourCostRange = {
  low: number;
  mid: number;
  high: number;
};

function resolveArea(totalTypical: number, typicalPerM2: number, fallbackArea?: number): number {
  if (typeof fallbackArea === "number" && Number.isFinite(fallbackArea) && fallbackArea > 0) {
    return fallbackArea;
  }

  if (typicalPerM2 > 0) {
    return totalTypical / typicalPerM2;
  }

  return 0;
}

function addLabourCostPerM2(
  totalLow: number,
  totalMid: number,
  totalHigh: number,
  areaM2: number,
  existing: { low: number; typical: number; high: number },
): { low: number; typical: number; high: number } {
  if (areaM2 <= 0) {
    return existing;
  }

  return {
    low: Math.round(totalLow / areaM2),
    typical: Math.round(totalMid / areaM2),
    high: Math.round(totalHigh / areaM2),
  };
}

export function applyLabourToEstimateResult(
  result: EstimateResult,
  labour: LabourCostRange,
  areaM2?: number,
): EstimateResult {
  const categories = [...result.categories];
  const feeIndex = categories.findIndex((category) => category.category === "fees");

  if (feeIndex >= 0) {
    const fees = categories[feeIndex];
    categories[feeIndex] = {
      ...fees,
      low: fees.low + labour.low,
      typical: fees.typical + labour.mid,
      high: fees.high + labour.high,
    };
  } else {
    categories.push({
      category: "fees",
      low: labour.low,
      typical: labour.mid,
      high: labour.high,
    });
  }

  const totalLow = result.totalLow + labour.low;
  const totalTypical = result.totalTypical + labour.mid;
  const totalHigh = result.totalHigh + labour.high;
  const inferredArea = resolveArea(result.totalTypical, result.costPerM2.typical, areaM2);

  return {
    ...result,
    totalLow,
    totalTypical,
    totalHigh,
    categories,
    costPerM2: addLabourCostPerM2(
      totalLow,
      totalTypical,
      totalHigh,
      inferredArea,
      result.costPerM2,
    ),
  };
}

export function applyLabourToNewBuildResult(
  result: NewBuildResult,
  labour: LabourCostRange,
  areaM2?: number,
): NewBuildResult {
  const categories = result.categories.map((category) => {
    if (category.category !== "professional_fees") {
      return category;
    }

    return {
      ...category,
      low: category.low + labour.low,
      typical: category.typical + labour.mid,
      high: category.high + labour.high,
    };
  });

  const totalLow = result.totalLow + labour.low;
  const totalTypical = result.totalTypical + labour.mid;
  const totalHigh = result.totalHigh + labour.high;
  const inferredArea = resolveArea(result.totalTypical, result.costPerM2.typical, areaM2);

  return {
    ...result,
    totalLow,
    totalTypical,
    totalHigh,
    categories,
    costPerM2: addLabourCostPerM2(
      totalLow,
      totalTypical,
      totalHigh,
      inferredArea,
      result.costPerM2,
    ),
    metadata: {
      ...result.metadata,
      costPerUnit:
        result.metadata.numberOfUnits && result.metadata.numberOfUnits > 0
          ? {
              low: Math.round(totalLow / result.metadata.numberOfUnits),
              typical: Math.round(totalTypical / result.metadata.numberOfUnits),
              high: Math.round(totalHigh / result.metadata.numberOfUnits),
            }
          : result.metadata.costPerUnit,
      costPerLettableRoom:
        result.metadata.numberOfLettableRooms && result.metadata.numberOfLettableRooms > 0
          ? {
              low: Math.round(totalLow / result.metadata.numberOfLettableRooms),
              typical: Math.round(totalTypical / result.metadata.numberOfLettableRooms),
              high: Math.round(totalHigh / result.metadata.numberOfLettableRooms),
            }
          : result.metadata.costPerLettableRoom,
    },
  };
}
