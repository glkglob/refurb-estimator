import { defaultCostLibrary } from "./costLibrary";
import { postcodeToRegion } from "./enhancedEstimator";
import type { Region } from "./types";

export type ExtensionType =
  | "single_storey_rear"
  | "double_storey_rear"
  | "side_return"
  | "wrap_around";

export type ExtensionFinishLevel = "basic" | "standard" | "premium";

export type ExtensionEstimatorInput = {
  extensionType: ExtensionType;
  floorAreaM2: number;
  finishLevel: ExtensionFinishLevel;
  postcodeDistrict: string;
  includeKitchen?: boolean;
  includeBifolds?: boolean;
  includeUnderfloorHeating?: boolean;
};

export type ExtensionEstimatorResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: { low: number; typical: number; high: number };
  region: Region;
  regionalMultiplier: number;
  timeline: string;
  planningNote: string;
  adjustments: Array<{ label: string; amount: number; reason: string }>;
  metadata: {
    extensionType: ExtensionType;
    finishLevel: ExtensionFinishLevel;
    floorAreaM2: number;
    postcodeDistrict: string;
    estimatedAt: string;
    includeKitchen: boolean;
    includeBifolds: boolean;
    includeUnderfloorHeating: boolean;
  };
};

// As per issue (2025/26 UK averages)
export const extensionBaseRates: Record<
  ExtensionType,
  Record<ExtensionFinishLevel, number>
> = {
  single_storey_rear: { basic: 1800, standard: 2200, premium: 3000 },
  double_storey_rear: { basic: 2200, standard: 2800, premium: 3800 },
  side_return: { basic: 2000, standard: 2500, premium: 3200 },
  wrap_around: { basic: 2400, standard: 3000, premium: 4000 },
};

type Tier = "low" | "typical" | "high";
type TierAmounts = Record<Tier, number>;

function multiplyTier(amounts: TierAmounts, multiplier: number): TierAmounts {
  return {
    low: amounts.low * multiplier,
    typical: amounts.typical * multiplier,
    high: amounts.high * multiplier,
  };
}

function addTier(a: TierAmounts, b: TierAmounts): TierAmounts {
  return {
    low: a.low + b.low,
    typical: a.typical + b.typical,
    high: a.high + b.high,
  };
}

function emptyTier(): TierAmounts {
  return { low: 0, typical: 0, high: 0 };
}

/**
 * We don't have explicit low/high base rates per type in the issue, only a single base rate.
 * To keep consistent Low/Typical/High outputs (like other calculators), apply a modest spread:
 * - low: 90% of base build cost
 * - typical: 100%
 * - high: 115%
 *
 * Add-ons use explicit low/typical/high where possible.
 */
function baseRateToTierAmounts(baseRatePerM2: number): TierAmounts {
  return {
    low: baseRatePerM2 * 0.9,
    typical: baseRatePerM2,
    high: baseRatePerM2 * 1.15,
  };
}

function normalizePostcodeDistrict(value: string): string {
  return value.trim().toUpperCase();
}

const PLANNING_NOTES: Record<ExtensionType, string> = {
  single_storey_rear:
    "Single storey rear extensions up to 4m (detached) or 3m (other houses) often fall under Permitted Development, subject to limits and prior approval in some cases.",
  double_storey_rear:
    "Double storey extensions frequently require planning permission, especially near boundaries or in conservation areas.",
  side_return:
    "Side return extensions may be Permitted Development if within limits, but planning constraints can apply for terraces, corner plots, and conservation areas.",
  wrap_around:
    "Wrap-around (L-shape) extensions commonly require planning permission due to increased massing and boundary impacts.",
};

const TIMELINES: Record<ExtensionType, string> = {
  single_storey_rear: "Typically 12–16 weeks on site",
  double_storey_rear: "Typically 16–24 weeks on site",
  side_return: "Typically 12–18 weeks on site",
  wrap_around: "Typically 18–26 weeks on site",
};

const KITCHEN_COSTS: Record<ExtensionFinishLevel, TierAmounts> = {
  basic: { low: 8000, typical: 12000, high: 15000 },
  standard: { low: 12000, typical: 18000, high: 22000 },
  premium: { low: 18000, typical: 25000, high: 35000 },
};

const BIFOLDS_COSTS: TierAmounts = { low: 3500, typical: 4500, high: 6000 };

const UFH_COST_PER_M2 = 65;

function validateInput(input: ExtensionEstimatorInput) {
  if (!Number.isFinite(input.floorAreaM2) || input.floorAreaM2 <= 0 || input.floorAreaM2 > 500) {
    throw new Error("Floor area must be greater than zero and no more than 500m²");
  }

  const postcodeDistrict = normalizePostcodeDistrict(input.postcodeDistrict);
  if (!postcodeDistrict) {
    throw new Error("Postcode district is required");
  }
}

export function calculateExtensionEstimate(
  input: ExtensionEstimatorInput
): ExtensionEstimatorResult {
  validateInput(input);

  const postcodeDistrict = normalizePostcodeDistrict(input.postcodeDistrict);

  const region = postcodeToRegion(postcodeDistrict);
  const regionalMultiplier = defaultCostLibrary.regionalMultipliers[region];

  const baseRatePerM2 =
    extensionBaseRates[input.extensionType][input.finishLevel];

  // Base build cost: floorArea * baseRate (tiered via spreads) * regional multiplier
  const baseRateTier = baseRateToTierAmounts(baseRatePerM2);
  const baseBuild = multiplyTier(
    baseRateTier,
    input.floorAreaM2 * regionalMultiplier
  );

  const adjustments: ExtensionEstimatorResult["adjustments"] = [];
  let addOns = emptyTier();

  const includeKitchen = Boolean(input.includeKitchen);
  const includeBifolds = Boolean(input.includeBifolds);
  const includeUnderfloorHeating = Boolean(input.includeUnderfloorHeating);

  if (includeKitchen) {
    const kitchen = multiplyTier(
      KITCHEN_COSTS[input.finishLevel],
      regionalMultiplier
    );
    addOns = addTier(addOns, kitchen);
    adjustments.push({
      label: "New kitchen",
      amount: Math.round(kitchen.typical),
      reason: "Allowance for units, worktops, and installation.",
    });
  }

  if (includeBifolds) {
    const bifolds = multiplyTier(BIFOLDS_COSTS, regionalMultiplier);
    addOns = addTier(addOns, bifolds);
    adjustments.push({
      label: "Bifold / sliding doors",
      amount: Math.round(bifolds.typical),
      reason: "Allowance for supply and fit of large glazed opening.",
    });
  }

  if (includeUnderfloorHeating) {
    const ufh: TierAmounts = {
      low: input.floorAreaM2 * UFH_COST_PER_M2,
      typical: input.floorAreaM2 * UFH_COST_PER_M2,
      high: input.floorAreaM2 * UFH_COST_PER_M2,
    };
    const ufhRegional = multiplyTier(ufh, regionalMultiplier);
    addOns = addTier(addOns, ufhRegional);
    adjustments.push({
      label: "Underfloor heating",
      amount: Math.round(ufhRegional.typical),
      reason: `Allowance at £${UFH_COST_PER_M2}/m² for the extension footprint.`,
    });
  }

  const total = addTier(baseBuild, addOns);

  const roundedTotals: TierAmounts = {
    low: Math.round(total.low),
    typical: Math.round(total.typical),
    high: Math.round(total.high),
  };

  const costPerM2 = {
    low: Math.round(roundedTotals.low / input.floorAreaM2),
    typical: Math.round(roundedTotals.typical / input.floorAreaM2),
    high: Math.round(roundedTotals.high / input.floorAreaM2),
  };

  return {
    totalLow: roundedTotals.low,
    totalTypical: roundedTotals.typical,
    totalHigh: roundedTotals.high,
    costPerM2,
    region,
    regionalMultiplier,
    timeline: TIMELINES[input.extensionType],
    planningNote: PLANNING_NOTES[input.extensionType],
    adjustments,
    metadata: {
      extensionType: input.extensionType,
      finishLevel: input.finishLevel,
      floorAreaM2: input.floorAreaM2,
      postcodeDistrict,
      estimatedAt: new Date().toISOString(),
      includeKitchen,
      includeBifolds,
      includeUnderfloorHeating,
    },
  };
}
