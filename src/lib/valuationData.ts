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
  light: { min: 0.05, max: 0.1 }, // cosmetic / decoration
  medium: { min: 0.1, max: 0.15 }, // kitchen + bathroom
  heavy: { min: 0.15, max: 0.25 }, // full structural refurb
  extension: { min: 0.2, max: 0.35 }, // rear/side extension
  loft: { min: 0.15, max: 0.3 }, // loft conversion
};

/**
 * Regional multipliers applied on top of upliftFactors.
 * Example: London tends to have higher absolute uplift potential due to higher baseline values.
 * Keep these conservative. v1 is indicative only.
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

  /**
   * Optional: postcode used to derive UKRegion in v1.
   * If not provided or unrecognized, defaults to UKRegion "unknown" (multiplier 1.0).
   */
  postcode?: string;

  /**
   * Optional override: if you already know the region (e.g., captured elsewhere),
   * you can supply it directly and skip postcode parsing.
   */
  region?: UKRegion;
}

export interface CalculateUpliftResult {
  upliftMin: number;
  upliftMax: number;
  newValueMin: number;
  newValueMax: number;
  roiMin: number;
  roiMax: number;

  /**
   * Helpful for UI/debugging so you can show the region used.
   */
  regionUsed: UKRegion;

  /**
   * Effective factors after region adjustment.
   */
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

function assertFinitePositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a finite number greater than 0`);
  }
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite number greater than or equal to 0`);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Very lightweight postcode parsing:
 * - Normalizes whitespace and casing.
 * - Uses outward code "area" letters to pick a region.
 *
 * This is NOT perfect and is meant only to support a coarse v1 region adjustment.
 */
export function getRegionFromPostcode(postcode?: string): UKRegion {
  if (!postcode) return "unknown";

  const normalized = postcode.trim().toUpperCase().replace(/\s+/g, "");
  if (normalized.length < 2) return "unknown";

  // Extract postcode "area" (leading 1-2 letters)
  // Examples: "SW1A1AA" -> "SW", "M11AE" -> "M", "EH12NG" -> "EH"
  const match = normalized.match(/^([A-Z]{1,2}\d[A-Z\d]?)/);
  if (!*
