export type Region =
  | "London"
  | "SouthEast"
  | "EastOfEngland"
  | "EastMidlands"
  | "WestMidlands"
  | "SouthWest"
  | "NorthWest"
  | "NorthEast"
  | "YorkshireAndTheHumber"
  | "Scotland"
  | "Wales"
  | "NorthernIreland";

export type FinishLevel = "budget" | "standard" | "premium";

export type Condition = "poor" | "fair" | "good";

// TODO: unused export
export type ProjectType = "refurb" | "new_build";

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

// TODO: unused export
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

export type NewBuildCategory =
  | "substructure"
  | "superstructure"
  | "external_envelope"
  | "windows_and_doors"
  | "internal_finishes"
  | "kitchen"
  | "bathrooms"
  | "electrics"
  | "plumbing_and_heating"
  | "external_works"
  | "preliminaries"
  | "contingency"
  | "professional_fees";

export type NewBuildPropertyType =
  | "flat"
  | "terraced"
  | "semi-detached"
  | "detached"
  | "bungalow"
  | "hmo"
  | "block_of_flats"
  | "commercial";

export type NewBuildSpec = "basic" | "standard" | "premium";

export type NewBuildInput = {
  propertyType: NewBuildPropertyType;
  spec: NewBuildSpec;
  totalAreaM2: number;
  bedrooms: number;
  storeys: number;
  postcodeDistrict: string;
  garage?: boolean;
  renewableEnergy?: boolean;
  basementIncluded?: boolean;
  numberOfUnits?: number;
  numberOfStoreys?: number;
  liftIncluded?: boolean;
  commercialGroundFloor?: boolean;
  numberOfLettableRooms?: number;
  enSuitePerRoom?: boolean;
  communalKitchen?: boolean;
  fireEscapeRequired?: boolean;
  commercialType?: "office" | "retail" | "warehouse" | "restaurant";
  fitOutLevel?: "shell_only" | "cat_a" | "cat_b";
  disabledAccess?: boolean;
  extractionSystem?: boolean;
  parkingSpaces?: number;
};

export type NewBuildCategoryBreakdown = {
  category: NewBuildCategory;
  low: number;
  typical: number;
  high: number;
};

export type NewBuildResult = {
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: { low: number; typical: number; high: number };
  categories: NewBuildCategoryBreakdown[];
  adjustments: Array<{
    label: string;
    amount: number;
    reason: string;
  }>;
  contingencyPercent: number;
  feesPercent: number;
  region: Region;
  metadata: {
    propertyType: NewBuildPropertyType;
    spec: NewBuildSpec;
    bedrooms: number;
    storeys: number;
    postcodeDistrict: string;
    estimatedAt: string;
    numberOfUnits?: number;
    costPerUnit?: { low: number; typical: number; high: number };
    numberOfLettableRooms?: number;
    costPerLettableRoom?: { low: number; typical: number; high: number };
    commercialType?: "office" | "retail" | "warehouse" | "restaurant";
    fitOutLevel?: "shell_only" | "cat_a" | "cat_b";
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
