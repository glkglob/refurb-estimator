import { estimateInputSchema, type EstimateInput } from "@/schemas/estimate";
import { validate } from "@/utils/validator";

export const BASE_COST_PER_M2 = 1200;

export const REGION_MULTIPLIERS = {
  london: 1.25,
  south_east: 1.15,
  midlands: 1.0,
  north: 0.9,
} as const;

const DEFAULT_REGION_MULTIPLIER = REGION_MULTIPLIERS.midlands;

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type EstimateResult = {
  totalCost: number;
  formatted: string;
  breakdown: {
    base: number;
    multiplier: number;
  };
};

export type EstimateSpecResult = {
  total: number;
  formatted: string;
};

type KnownRegion = keyof typeof REGION_MULTIPLIERS;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normaliseRegion(region: string): string {
  return region.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function isKnownRegion(region: string): region is KnownRegion {
  return region in REGION_MULTIPLIERS;
}

function getRegionMultiplier(region: string): number {
  const normalised = normaliseRegion(region);

  if (isKnownRegion(normalised)) {
    return REGION_MULTIPLIERS[normalised];
  }

  return DEFAULT_REGION_MULTIPLIER;
}

export function applyRegionMultipliers(region: string): number;
export function applyRegionMultipliers(baseCost: number, region: string): number;
export function applyRegionMultipliers(
  baseCostOrRegion: number | string,
  region?: string,
): number {
  if (typeof baseCostOrRegion === "string") {
    return getRegionMultiplier(baseCostOrRegion);
  }

  if (!Number.isFinite(baseCostOrRegion) || baseCostOrRegion < 0) {
    throw new Error("baseCost must be a non-negative finite number");
  }

  if (typeof region !== "string") {
    throw new Error("region is required");
  }

  const multiplier = getRegionMultiplier(region);
  return roundCurrency(baseCostOrRegion * multiplier);
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const validatedInput = validate(input, estimateInputSchema);
  const base = roundCurrency(validatedInput.area * BASE_COST_PER_M2);
  const multiplier = getRegionMultiplier(validatedInput.region);
  const totalCost = applyRegionMultipliers(base, validatedInput.region);

  return {
    totalCost,
    formatted: gbpFormatter.format(totalCost),
    breakdown: {
      base,
      multiplier,
    },
  };
}

export function calculateEstimateSpec(input: EstimateInput): EstimateSpecResult {
  const result = calculateEstimate(input);

  return {
    total: result.totalCost,
    formatted: result.formatted,
  };
}

export function applyRegionMultiplier(region: string): number {
  return applyRegionMultipliers(region);
}
