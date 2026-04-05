import { postcodeToRegion } from "./enhancedEstimator";
import { assertFinitePositive, assertFiniteNonNegative, clamp } from "./math";
export type RefurbType = "light" | "medium" | "heavy" | "extension" | "loft";

/**
 * Coarse UK regions for v1 "regional uplift factors".
 * NOTE: This is deliberately simple and heuristic-based (no external API).
 */
export type UKRegion =
  | "london"
  | "south_east"
  | "south_west"
  | "east_of_england"
  | "west_midlands"
  | "east_midlands"
  | "north_west"
  | "north_east"
  | "yorkshire_and_humber"
  | "scotland"
  | "wales"
  | "northern_ireland"
  | "unknown";

/**
 * Base uplift factors by refurb type (national baseline).
 * These are then adjusted by regionMultipliers when a region/postcode is provided.
 */
export const upliftFactors: Record<RefurbType, { min: number; max: number }> = {
  light: { min: 0.05, max: 0.1 },
  medium: { min: 0.1, max: 0.15 },
  heavy: { min: 0.15, max: 0.25 },
  extension: { min: 0.2, max: 0.35 },
  loft: { min: 0.15, max: 0.3 },
};

/**
 * Regional multipliers applied on top of upliftFactors.
 */
export const regionMultipliers: Record<UKRegion, { min: number; max: number }> = {
  london: { min: 1.1, max: 1.25 },
  south_east: { min: 1.05, max: 1.15 },
  east_of_england: { min: 1.02, max: 1.1 },
  south_west: { min: 1.0, max: 1.08 },

  west_midlands: { min: 0.95, max: 1.03 },
  east_midlands: { min: 0.95, max: 1.03 },

  north_west: { min: 0.93, max: 1.02 },
  yorkshire_and_humber: { min: 0.92, max: 1.01 },
  north_east: { min: 0.9, max: 1.0 },

  scotland: { min: 0.92, max: 1.02 },
  wales: { min: 0.9, max: 1.0 },
  northern_ireland: { min: 0.9, max: 1.0 },

  unknown: { min: 1.0, max: 1.0 },
};

export interface CalculateUpliftInput {
  currentValue: number;
  refurbCost: number;
  refurbType: RefurbType;
  postcode?: string;
  region?: UKRegion;
}

export interface CalculateUpliftResult {
  upliftMin: number;
  upliftMax: number;
  newValueMin: number;
  newValueMax: number;
  roiMin: number;
  roiMax: number;
  regionUsed: UKRegion;
  effectiveFactorMin: number;
  effectiveFactorMax: number;
}

export type ValuationInput = {
  currentValue: number;
  refurbCost: number;
  expectedValue: number;
};

export type ValuationResult = {
  grossUplift: number;
  netUplift: number;
  roiPercent: number;
};

/**
 * Very lightweight postcode parsing:
 * - Normalizes whitespace and casing.
 * - Uses outward-code area letters to pick a region.
 *
 * This is intentionally coarse and only for v1 heuristics.
 */
export function getRegionFromPostcode(postcode?: string): UKRegion {
  if (!postcode || postcode.trim().length === 0) return "unknown";
  try {
    return postcodeToRegion(postcode) as UKRegion;
  } catch {
    return "unknown";
  }
}

function resolveRegion(region?: UKRegion, postcode?: string): UKRegion {
  return region ?? getRegionFromPostcode(postcode);
}

export function calculateUplift({
  currentValue,
  refurbCost,
  refurbType,
  postcode,
  region,
}: CalculateUpliftInput): CalculateUpliftResult {
  assertFinitePositive(currentValue, "currentValue");
  assertFiniteNonNegative(refurbCost, "refurbCost");

  const baseFactors = upliftFactors[refurbType];
  if (!baseFactors) {
    throw new Error(`Unsupported refurbType: ${refurbType}`);
  }

  const regionUsed = resolveRegion(region, postcode);
  const multipliers = regionMultipliers[regionUsed] ?? regionMultipliers.unknown;

  const effectiveFactorMin = clamp(baseFactors.min * multipliers.min, 0, 1);
  const effectiveFactorMax = clamp(baseFactors.max * multipliers.max, 0, 1);

  const upliftMin = currentValue * effectiveFactorMin;
  const upliftMax = currentValue * effectiveFactorMax;

  const newValueMin = currentValue + upliftMin;
  const newValueMax = currentValue + upliftMax;

  const roiMin = refurbCost === 0 ? 0 : upliftMin / refurbCost;
  const roiMax = refurbCost === 0 ? 0 : upliftMax / refurbCost;

  return {
    upliftMin,
    upliftMax,
    newValueMin,
    newValueMax,
    roiMin,
    roiMax,
    regionUsed,
    effectiveFactorMin,
    effectiveFactorMax,
  };
}

export function calculateValuation({
  currentValue,
  refurbCost,
  expectedValue,
}: ValuationInput): ValuationResult {
  assertFinitePositive(currentValue, "currentValue");
  assertFiniteNonNegative(refurbCost, "refurbCost");
  assertFinitePositive(expectedValue, "expectedValue");

  const grossUplift = expectedValue - currentValue;
  const netUplift = grossUplift - refurbCost;
  const roiPercent = refurbCost === 0 ? 0 : (netUplift / refurbCost) * 100;

  return {
    grossUplift,
    netUplift,
    roiPercent: Number(roiPercent.toFixed(1)),
  };
}
