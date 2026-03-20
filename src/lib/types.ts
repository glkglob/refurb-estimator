export type Region =
  | "London"
  | "SouthEast"
  | "Midlands"
  | "North"
  | "Scotland"
  | "Wales";

export type FinishLevel = "budget" | "standard" | "premium";

export type Condition = "poor" | "fair" | "good";

export type ProjectType = "refurb";

export type RenovationScope = "cosmetic" | "standard" | "full" | "structural";

export type PropertyCategory =
  | "flat"
  | "terraced"
  | "semi-detached"
  | "detached"
  | "bungalow"
  | "hmo"
  | "commercial";

export type AdditionalFeature =
  | "loft_conversion"
  | "extension_single_storey"
  | "extension_double_storey"
  | "basement_conversion"
  | "new_roof"
  | "full_rewire"
  | "new_boiler"
  | "underfloor_heating"
  | "solar_panels"
  | "new_windows_throughout"
  | "garden_landscaping"
  | "driveway";

export type RoomType =
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "living"
  | "hallway"
  | "utility";

export type CostCategory =
  | "kitchen"
  | "bathroom"
  | "electrics"
  | "plumbing"
  | "heating"
  | "windows"
  | "doors"
  | "plastering"
  | "decoration"
  | "flooring"
  | "contingency"
  | "fees";

export type EstimateInput = {
  region: Region;
  projectType: ProjectType;
  propertyType: string;
  totalAreaM2: number;
  condition: Condition;
  finishLevel: FinishLevel;
  rooms?: RoomInput[];
};

export type RoomInput = {
  id: string;
  roomType: RoomType;
  areaM2: number;
  intensity: "light" | "full";
  finishLevel: FinishLevel;
};

export type CategoryBreakdown = {
  category: CostCategory;
  low: number;
  typical: number;
  high: number;
};

export type RoomCategoryAllocation = Partial<Record<CostCategory, number>>;

export type EstimateResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: {
    low: number;
    typical: number;
    high: number;
  };
  categories: CategoryBreakdown[];
};

export type EnhancedEstimateInput = {
  propertyCategory: PropertyCategory;
  postcodeDistrict: string;
  totalAreaM2: number;
  renovationScope: RenovationScope;
  qualityTier: FinishLevel;
  additionalFeatures?: AdditionalFeature[];
  yearBuilt?: number;
  listedBuilding?: boolean;
};

export type EnhancedEstimateResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: {
    low: number;
    typical: number;
    high: number;
  };
  baseRenovation: {
    low: number;
    typical: number;
    high: number;
  };
  additionalFeatureCosts: Array<{
    feature: AdditionalFeature;
    label: string;
    low: number;
    typical: number;
    high: number;
  }>;
  adjustments: Array<{
    label: string;
    amount: number;
    reason: string;
  }>;
  categories: CategoryBreakdown[];
  contingencyPercent: number;
  feesPercent: number;
  region: Region;
  metadata: {
    postcodeDistrict: string;
    propertyCategory: PropertyCategory;
    renovationScope: RenovationScope;
    qualityTier: FinishLevel;
    yearBuilt?: number;
    listedBuilding: boolean;
    estimatedAt: string;
  };
};

export type Scenario = {
  id: string;
  name: string;
  input: EstimateInput;
  result: EstimateResult;
  createdAt: string;
  updatedAt: string;
  purchasePrice?: number;
  gdv?: number;
};

export type BudgetActuals = {
  scenarioId: string;
  actuals: Partial<Record<CostCategory, number>>;
  updatedAt: string;
};

export type CostLibrary = {
  baseRefurbPerM2: {
    low: number;
    typical: number;
    high: number;
  };
  regionalMultipliers: Record<Region, number>;
  conditionMultipliers: Record<Condition, number>;
  finishMultipliers: Record<FinishLevel, number>;
  categoryPercents: Record<CostCategory, number>;
  roomBaseRanges: Record<
    RoomType,
    {
      low: number;
      typical: number;
      high: number;
    }
  >;
  roomCategoryAllocations: Record<RoomType, RoomCategoryAllocation>;
};
