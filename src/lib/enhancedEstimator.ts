import { defaultCostLibrary } from "./costLibrary";
import type {
 AdditionalFeature,
 CategoryBreakdown,
 Condition,
 CostCategory,
 EnhancedEstimateInput,
 EnhancedEstimateResult,
 PropertyCategory,
 Region,
 RenovationScope
} from "./types";

type Tier = "low" | "typical" | "high";
type TierAmounts = Record<Tier, number>;

const TIERS: Tier[] = ["low", "typical", "high"];

const scopeBaseRates: Record<RenovationScope, TierAmounts> = {
 cosmetic: { low: 450, typical: 700, high: 1000 },
 standard: { low: 1200, typical: 1800, high: 2500 },
 full: { low: 1800, typical: 2600, high: 3500 },
 structural: { low: 2500, typical: 3500, high: 5000 }
};

const propertyComplexityMultipliers: Record<PropertyCategory, number> = {
 flat: 1.0,
 terraced: 1.0,
 "semi-detached": 1.02,
 detached: 1.05,
 bungalow: 1.03,
 hmo: 1.15,
 commercial: 1.2
};

const featureCosts: Record<
 AdditionalFeature,
 { label: string; low: number; typical: number; high: number }
> = {
 loft_conversion: { label: "Loft conversion", low: 25000, typical: 45000, high: 70000 },
 extension_single_storey: {
  label: "Single-storey extension",
  low: 35000,
  typical: 60000,
  high: 100000
 },
 extension_double_storey: {
  label: "Double-storey extension",
  low: 55000,
  typical: 90000,
  high: 150000
 },
 basement_conversion: {
  label: "Basement conversion",
  low: 40000,
  typical: 75000,
  high: 120000
 },
 new_roof: { label: "New roof", low: 5000, typical: 9000, high: 15000 },
 full_rewire: { label: "Full rewire", low: 3500, typical: 6000, high: 10000 },
 new_boiler: { label: "New boiler & heating", low: 2500, typical: 4500, high: 8000 },
 underfloor_heating: { label: "Underfloor heating", low: 3000, typical: 5500, high: 9000 },
 solar_panels: { label: "Solar panels", low: 5000, typical: 8000, high: 13000 },
 new_windows_throughout: {
  label: "New windows throughout",
  low: 4000,
  typical: 7500,
  high: 12000
 },
 garden_landscaping: {
  label: "Garden landscaping",
  low: 3000,
  typical: 8000,
  high: 20000
 },
 driveway: { label: "New driveway", low: 2000, typical: 5000, high: 12000 }
};

const featureCategoryMap: Record<AdditionalFeature, CostCategory> = {
 loft_conversion: "plastering",
 extension_single_storey: "plastering",
 extension_double_storey: "plastering",
 basement_conversion: "plumbing",
 new_roof: "contingency",
 full_rewire: "electrics",
 new_boiler: "heating",
 underfloor_heating: "heating",
 solar_panels: "electrics",
 new_windows_throughout: "windows",
 garden_landscaping: "decoration",
 driveway: "decoration"
};

const londonAreas = new Set(["E", "EC", "N", "NW", "SE", "SW", "W", "WC", "BR", "CR", "DA", "EN", "HA", "IG", "KT", "RM", "SM", "TW", "UB", "WD"]);
const southEastAreas = new Set(["BN", "CT", "GU", "ME", "MK", "OX", "PO", "RG", "RH", "SL", "SO", "TN"]);
const southWestAreas = new Set(["BA", "BH", "BS", "DT", "EX", "GL", "PL", "SN", "SP", "TA", "TQ", "TR"]);
const eastOfEnglandAreas = new Set(["AL", "CB", "CM", "CO", "HP", "IP", "LU", "NR", "SG", "SS"]);
const eastMidlandsAreas = new Set(["DE", "LE", "LN", "NG", "NN"]);
const westMidlandsAreas = new Set(["B", "CV", "DY", "HR", "ST", "TF", "WR", "WS", "WV"]);
const northWestAreas = new Set(["BB", "BD", "BL", "CA", "CH", "CW", "FY", "L", "LA", "M", "OL", "PR", "SK", "WA", "WN"]);
const northEastAreas = new Set(["DH", "DL", "NE", "SR", "TS"]);
const yorkshireAndTheHumberAreas = new Set(["DN", "HD", "HG", "HU", "HX", "LS", "S", "WF", "YO"]);
const scotlandAreas = new Set(["AB", "DD", "DG", "EH", "FK", "G", "HS", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "TD", "ZE"]);
const walesAreas = new Set(["CF", "LD", "LL", "NP", "SA", "SY"]);
const northernIrelandAreas = new Set(["BT"]);

const REGION_POSTCODE_FALLBACK: Record<Region, string> = {
  london: "SW1A",
  south_east: "GU1",
  south_west: "BS1",
  east_of_england: "CB1",
  east_midlands: "LE1",
  west_midlands: "B1",
  north_west: "M1",
  north_east: "NE1",
  yorkshire_and_humber: "LS1",
  scotland: "EH1",
  wales: "CF10",
  northern_ireland: "BT1"
};

function emptyTierAmounts(): TierAmounts {
  return { low: 0, typical: 0, high: 0 };
}

function extractPostcodeArea(postcodeDistrict: string): string {
  const normalized = postcodeDistrict.trim().toUpperCase().replace(/\s+/g, "");
  const match = normalized.match(/^[A-Z]{1,2}/);
  return match ? match[0] : "";
}

function getYearBuiltAdjustmentPercent(yearBuilt?: number): number {
  if (typeof yearBuilt !== "number") return 0;
  if (yearBuilt <= 1918) return 0.15;
  if (yearBuilt <= 1945) return 0.08;
  if (yearBuilt <= 1970) return 0.05;
  if (yearBuilt <= 1990) return 0.02;
  return 0;
}

function getContingencyPercent(scope: RenovationScope): number {
  if (scope === "full") return 10;
  if (scope === "structural") return 12;
  return 7;
}

function getFeesPercent(scope: RenovationScope): number {
  if (scope === "full" || scope === "structural") return 8;
  return 5;
}

function toRoundedCategoryBreakdown(
  totals: Record<CostCategory, TierAmounts>,
  roundedGrandTotals: TierAmounts
): CategoryBreakdown[] {
  const categoriesInOrder = Object.keys(defaultCostLibrary.categoryPercents) as CostCategory[];
  const balancingCategory: CostCategory = categoriesInOrder.includes("fees")
    ? "fees"
    : categoriesInOrder[categoriesInOrder.length - 1];
  const roundedByTier: Record<Tier, Record<CostCategory, number>> = {
    low: {} as Record<CostCategory, number>,
    typical: {} as Record<CostCategory, number>,
    high: {} as Record<CostCategory, number>
  };
  for (const tier of TIERS) {
    let runningSum = 0;
    for (const category of categoriesInOrder) {
      if (category === balancingCategory) continue;
      const roundedValue = Math.round(totals[category][tier]);
      roundedByTier[tier][category] = roundedValue;
      runningSum += roundedValue;
    }
    roundedByTier[tier][balancingCategory] = roundedGrandTotals[tier] - runningSum;
  }
  return categoriesInOrder.map((category) => ({
    category,
    low: roundedByTier.low[category],
    typical: roundedByTier.typical[category],
    high: roundedByTier.high[category]
  }));
}

export function postcodeToRegion(postcodeDistrict: string): Region {
  const area = extractPostcodeArea(postcodeDistrict);
  if (londonAreas.has(area)) return "london";
  if (southEastAreas.has(area)) return "south_east";
  if (southWestAreas.has(area)) return "south_west";
  if (eastOfEnglandAreas.has(area)) return "east_of_england";
  if (eastMidlandsAreas.has(area)) return "east_midlands";
  if (westMidlandsAreas.has(area)) return "west_midlands";
  if (northWestAreas.has(area)) return "north_west";
  if (northEastAreas.has(area)) return "north_east";
  if (yorkshireAndTheHumberAreas.has(area)) return "yorkshire_and_humber";
  if (scotlandAreas.has(area)) return "scotland";
  if (walesAreas.has(area)) return "wales";
  if (northernIrelandAreas.has(area)) return "northern_ireland";
  return "london";
}

export function getFallbackPostcodeDistrict(region: Region): string {
  return REGION_POSTCODE_FALLBACK[region];
}

export function conditionToRenovationScope(condition: Condition): RenovationScope {
  if (condition === "good") return "cosmetic";
  if (condition === "poor") return "full";
  return "standard";
}

export function inferPropertyCategory(propertyType: string): PropertyCategory {
  const normalized = propertyType.trim().toLowerCase();
  if (normalized.includes("hmo")) return "hmo";
  if (normalized.includes("commercial") || normalized.includes("office") || normalized.includes("shop")) return "commercial";
  if (normalized.includes("flat") || normalized.includes("apartment")) return "flat";
  if (normalized.includes("semi")) return "semi-detached";
  if (normalized.includes("detached")) return "detached";
  if (normalized.includes("terrace")) return "terraced";
  if (normalized.includes("bungalow")) return "bungalow";
  return "terraced";
}

export function calculateEnhancedEstimate(input: EnhancedEstimateInput): EnhancedEstimateResult {
  if (!Number.isFinite(input.totalAreaM2) || input.totalAreaM2 <= 0 || input.totalAreaM2 > 2000) {
    throw new Error("Area must be greater than zero and no more than 2000m²");
  }
  const postcodeDistrict = input.postcodeDistrict.trim().toUpperCase();
  if (!postcodeDistrict) throw new Error("Postcode district is required");
  if (typeof input.yearBuilt === "number") {
    const currentYear = new Date().getFullYear();
    if (!Number.isFinite(input.yearBuilt) || !Number.isInteger(input.yearBuilt) || input.yearBuilt < 1000 || input.yearBuilt > currentYear) {
      throw new Error(`Year built must be an integer between 1000 and ${currentYear}`);
    }
  }
  const region = postcodeToRegion(postcodeDistrict);
  const regionalMultiplier = defaultCostLibrary.regionalMultipliers[region];
  const qualityMultiplier = defaultCostLibrary.finishMultipliers[input.qualityTier];
  const propertyComplexityMultiplier = propertyComplexityMultipliers[input.propertyCategory];
  const scopeRates = scopeBaseRates[input.renovationScope];
  const yearBuiltPercent = getYearBuiltAdjustmentPercent(input.yearBuilt);
  const listedBuildingPercent = input.listedBuilding ? 0.25 : 0;
  const baseBeforeAdjustments = emptyTierAmounts();
  const baseRenovation = emptyTierAmounts();
  const featureTotals = emptyTierAmounts();
  const additionalFeatureCosts: EnhancedEstimateResult["additionalFeatureCosts"] = [];
  for (const tier of TIERS) {
    baseBeforeAdjustments[tier] = input.totalAreaM2 * scopeRates[tier] * regionalMultiplier * qualityMultiplier * propertyComplexityMultiplier;
    const withYearAdjustment = baseBeforeAdjustments[tier] * (1 + yearBuiltPercent);
    const listedBuildingAmount = withYearAdjustment * listedBuildingPercent;
    baseRenovation[tier] = withYearAdjustment + listedBuildingAmount;
  }
  const selectedFeatures = Array.from(new Set(input.additionalFeatures ?? [])).filter(
    (feature): feature is AdditionalFeature => feature in featureCosts
  );
  for (const feature of selectedFeatures) {
    const config = featureCosts[feature];
    const costs = { low: config.low * regionalMultiplier, typical: config.typical * regionalMultiplier, high: config.high * regionalMultiplier };
    additionalFeatureCosts.push({ feature, label: config.label, low: Math.round(costs.low), typical: Math.round(costs.typical), high: Math.round(costs.high) });
    for (const tier of TIERS) featureTotals[tier] += costs[tier];
  }
  const subtotal = emptyTierAmounts();
  for (const tier of TIERS) subtotal[tier] = baseRenovation[tier] + featureTotals[tier];
  const contingencyPercent = getContingencyPercent(input.renovationScope);
  const feesPercent = getFeesPercent(input.renovationScope);
  const totalRounded = emptyTierAmounts();
  for (const tier of TIERS) {
    const contingency = subtotal[tier] * (contingencyPercent / 100);
    const fees = subtotal[tier] * (feesPercent / 100);
    totalRounded[tier] = Math.round(subtotal[tier] + contingency + fees);
  }
  const categoryTotals = (Object.keys(defaultCostLibrary.categoryPercents) as CostCategory[]).reduce<Record<CostCategory, TierAmounts>>((acc, category) => {
    acc[category] = emptyTierAmounts();
    return acc;
  }, {} as Record<CostCategory, TierAmounts>);
  for (const tier of TIERS) {
    const nonFeatureTotal = Math.max(0, (totalRounded[tier] / (1 + (contingencyPercent + feesPercent) / 100)) - featureTotals[tier]);
    for (const [category, percent] of Object.entries(defaultCostLibrary.categoryPercents) as [CostCategory, number][]) {
      categoryTotals[category][tier] = nonFeatureTotal * percent;
    }
  }
  for (const feature of selectedFeatures) {
    const mappedCategory = featureCategoryMap[feature];
    const costs = featureCosts[feature];
    categoryTotals[mappedCategory].low += costs.low * regionalMultiplier;
    categoryTotals[mappedCategory].typical += costs.typical * regionalMultiplier;
    categoryTotals[mappedCategory].high += costs.high * regionalMultiplier;
  }
  const categories = toRoundedCategoryBreakdown(categoryTotals, totalRounded);
  const adjustments: EnhancedEstimateResult["adjustments"] = [];
  if (yearBuiltPercent > 0) {
    adjustments.push({
      label: `Property age adjustment (+${Math.round(yearBuiltPercent * 100)}%)`,
      amount: Math.round(baseBeforeAdjustments.typical * yearBuiltPercent),
      reason: "Older properties often require more specialist work."
    });
  }
  if (listedBuildingPercent > 0) {
    adjustments.push({
      label: "Listed building surcharge (+25%)",
      amount: Math.round(baseBeforeAdjustments.typical * (1 + yearBuiltPercent) * listedBuildingPercent),
      reason: "Listed status requires heritage materials."
    });
  }
  return {
    totalLow: totalRounded.low,
    totalTypical: totalRounded.typical,
    totalHigh: totalRounded.high,
    costPerM2: { low: totalRounded.low / input.totalAreaM2, typical: totalRounded.typical / input.totalAreaM2, high: totalRounded.high / input.totalAreaM2 },
    baseRenovation: { low: Math.round(baseRenovation.low), typical: Math.round(baseRenovation.typical), high: Math.round(baseRenovation.high) },
    additionalFeatureCosts, adjustments, categories, contingencyPercent, feesPercent, region,
    metadata: {
      postcodeDistrict, propertyCategory: input.propertyCategory, renovationScope: input.renovationScope,
      qualityTier: input.qualityTier, yearBuilt: input.yearBuilt, listedBuilding: Boolean(input.listedBuilding),
      estimatedAt: new Date().toISOString()
    }
  };
}
