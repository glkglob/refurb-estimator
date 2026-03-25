import { z } from "zod";
import { defaultCostLibrary, getRegionalMultiplier } from "./costLibrary";
import { postcodeToRegion } from "./enhancedEstimator";
import type {
  LoftConversionType,
  LoftFinishLevel,
  Region,
} from "./types";

const LOFT_TYPES: LoftConversionType[] = ["rooflight", "dormer", "hip_to_gable", "mansard"];
const FINISH_LEVELS: LoftFinishLevel[] = ["basic", "standard", "premium"];

export const loftBaseRates: Record<LoftConversionType, Record<LoftFinishLevel, number>> = {
  rooflight: {
    basic: 850,
    standard: 950,
    premium: 1100,
  },
  dormer: {
    basic: 1500,
    standard: 1700,
    premium: 1950,
  },
  hip_to_gable: {
    basic: 1800,
    standard: 2000,
    premium: 2300,
  },
  mansard: {
    basic: 1950,
    standard: 2200,
    premium: 2500,
  },
};

const addOnAmounts = {
  ensuite: { low: 5000, typical: 8500, high: 12000 },
  juliet: { low: 3000, typical: 4000, high: 5000 },
} as const;

const categoryPercents = {
  structure: 0.28,
  insulation: 0.15,
  stairs: 0.1,
  glazing: 0.12,
  finishes: 0.2,
  contingency: 0.1,
  fees: 0.05,
} as const;

const planningNotes: Record<LoftConversionType, { note: string; timeline: string }> = {
  rooflight: {
    note: "Usually falls under permitted development if roofline isn’t raised; confirm with your council.",
    timeline: "3–5 weeks",
  },
  dormer: {
    note: "Often permitted development when set back from the eaves; conservation areas may need approval.",
    timeline: "6–8 weeks",
  },
  hip_to_gable: {
    note: "Frequently needs planning where roof profile changes; check party wall and ridge height rules.",
    timeline: "7–10 weeks",
  },
  mansard: {
    note: "Typically requires full planning permission; stricter rules in conservation areas.",
    timeline: "10–14 weeks",
  },
};

const loftEstimateInputSchema = z.object({
  postcodeDistrict: z.string().trim().min(1, "Postcode is required"),
  totalAreaM2: z.number().positive().max(200),
  conversionType: z.enum(LOFT_TYPES),
  finishLevel: z.enum(FINISH_LEVELS),
  addOns: z
    .object({
      ensuite: z.boolean().optional(),
      juliet: z.boolean().optional(),
    })
    .optional(),
});

type TierAmounts = { low: number; typical: number; high: number };

export type LoftEstimateResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: TierAmounts;
  categories: Array<{ category: string; low: number; typical: number; high: number }>;
  adjustments: Array<{ label: string; amount: number; reason: string }>;
  contingencyPercent: number;
  feesPercent: number;
  region: Region;
  timeline: string;
  planningNote: string;
  metadata: {
    conversionType: LoftConversionType;
    finishLevel: LoftFinishLevel;
    totalAreaM2: number;
    postcodeDistrict: string;
    estimatedAt: string;
    addOns: { ensuite: boolean; juliet: boolean };
  };
};

function spreadBase(rate: number): TierAmounts {
  return {
    typical: rate,
    low: Math.round(rate * 0.9),
    high: Math.round(rate * 1.15),
  };
}

function applyAddOnsToTotals(base: TierAmounts, addOns: { ensuite: boolean; juliet: boolean }): TierAmounts {
  const result = { ...base };
  if (addOns.ensuite) {
    result.low += addOnAmounts.ensuite.low;
    result.typical += addOnAmounts.ensuite.typical;
    result.high += addOnAmounts.ensuite.high;
  }
  if (addOns.juliet) {
    result.low += addOnAmounts.juliet.low;
    result.typical += addOnAmounts.juliet.typical;
    result.high += addOnAmounts.juliet.high;
  }
  return result;
}

function multiplyTierAmounts(amounts: TierAmounts, multiplier: number): TierAmounts {
  return {
    low: Math.round(amounts.low * multiplier),
    typical: Math.round(amounts.typical * multiplier),
    high: Math.round(amounts.high * multiplier),
  };
}

function buildCategories(total: TierAmounts): Record<string, TierAmounts> {
  const categoriesWithoutFees = Object.entries(categoryPercents).filter(([key]) => key !== "fees");
  const balanceCategory = "fees";
  return (["low", "typical", "high"] as const).flatMap((tier) => {
    let running = 0;
    const items: Array<{ category: string; low: number; typical: number; high: number }> = [];
    for (const [category, percent] of categoriesWithoutFees) {
      const value = Math.round(total[tier] * percent);
      running += value;
      items.push({
        category,
        low: tier === "low" ? value : 0,
        typical: tier === "typical" ? value : 0,
        high: tier === "high" ? value : 0,
      });
    }
    const feeValue = total[tier] - running;
    items.push({
      category: balanceCategory,
      low: tier === "low" ? feeValue : 0,
      typical: tier === "typical" ? feeValue : 0,
      high: tier === "high" ? feeValue : 0,
    });
    return items;
  }).reduce<Record<string, { low: number; typical: number; high: number }>>((acc, item) => {
    acc[item.category] ??= { low: 0, typical: 0, high: 0 };
    acc[item.category].low += item.low;
    acc[item.category].typical += item.typical;
    acc[item.category].high += item.high;
    return acc;
  }, {});
}

function categoriesArray(total: TierAmounts): LoftEstimateResult["categories"] {
  const map = buildCategories(total);
  return Object.entries(map).map(([category, amounts]) => ({
    category,
    ...amounts,
  }));
}

export function calculateLoftEstimate(rawInput: LoftEstimateInput): LoftEstimateResult {
  const input = loftEstimateInputSchema.parse(rawInput);

  const region = postcodeToRegion(input.postcodeDistrict);
  const regionalMultiplier = getRegionalMultiplier(region, defaultCostLibrary);

  const baseRate = loftBaseRates[input.conversionType][input.finishLevel];
  const baseSpread = spreadBase(baseRate);

  const baseTotals = multiplyTierAmounts(baseSpread, input.totalAreaM2);

  const withAddOns = applyAddOnsToTotals(baseTotals, {
    ensuite: Boolean(input.addOns?.ensuite),
    juliet: Boolean(input.addOns?.juliet),
  });

  const areaTotals = multiplyTierAmounts(withAddOns, regionalMultiplier);

  const costPerM2: TierAmounts = {
    low: Math.round(areaTotals.low / input.totalAreaM2),
    typical: Math.round(areaTotals.typical / input.totalAreaM2),
    high: Math.round(areaTotals.high / input.totalAreaM2),
  };

  const adjustments: LoftEstimateResult["adjustments"] = [];
  if (input.addOns?.ensuite) {
    adjustments.push({
      label: "Ensuite",
      amount: Math.round(addOnAmounts.ensuite.typical * regionalMultiplier),
      reason: "Additional bathroom fit-out within loft.",
    });
  }
  if (input.addOns?.juliet) {
    adjustments.push({
      label: "Juliet balcony / dormer window",
      amount: Math.round(addOnAmounts.juliet.typical * regionalMultiplier),
      reason: "Glazing/opening upgrade for the loft space.",
    });
  }

  const { note, timeline } = planningNotes[input.conversionType];
  const estimatedAt = new Date().toISOString();

  return {
    totalLow: areaTotals.low,
    totalTypical: areaTotals.typical,
    totalHigh: areaTotals.high,
    costPerM2,
    categories: categoriesArray(areaTotals),
    adjustments,
    contingencyPercent: 10,
    feesPercent: 7,
    region,
    timeline,
    planningNote: note,
    metadata: {
      conversionType: input.conversionType,
      finishLevel: input.finishLevel,
      totalAreaM2: input.totalAreaM2,
      postcodeDistrict: input.postcodeDistrict,
      estimatedAt,
      addOns: {
        ensuite: Boolean(input.addOns?.ensuite),
        juliet: Boolean(input.addOns?.juliet),
      },
    },
  };
}

export type LoftEstimateInput = z.infer<typeof loftEstimateInputSchema>;
