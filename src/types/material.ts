/**
 * Supported internal material identifiers.
 */
export const MATERIAL_IDS = [
  "laminate_flooring",
  "engineered_wood",
  "paint",
  "kitchen_units",
  "bathroom_suite"
] as const;

export type MaterialId = (typeof MATERIAL_IDS)[number];

/**
 * Pricing bands used across estimators.
 */
export const MATERIAL_PRICE_BANDS = ["low", "mid", "high"] as const;

export type MaterialPriceBand = (typeof MATERIAL_PRICE_BANDS)[number];

export type MaterialPriceBands = Record<MaterialPriceBand, number>;

export type MaterialUnit = "m2" | "project";

/**
 * Internal material definition with GBP pricing bands.
 */
export type Material = {
  id: MaterialId;
  name: string;
  unit: MaterialUnit;
  price: MaterialPriceBands;
};
