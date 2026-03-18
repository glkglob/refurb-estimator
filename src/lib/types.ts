export type Region =
  | "London"
  | "SouthEast"
  | "Midlands"
  | "North"
  | "Scotland"
  | "Wales";

export type FinishLevel = "budget" | "standard" | "premium";

export type Condition = "poor" | "fair" | "good";

export type ProjectType = "refurb" | "extension" | "loft";

export type RoomType =
  | "kitchen"
  | "bathroom"
  | "bedroom"
  | "living"
  | "hallway"
  | "exterior";

export type EstimateCategory =
  | "kitchen"
  | "bathrooms"
  | "electrics"
  | "heating"
  | "plastering"
  | "windows"
  | "decoration"
  | "contingency"
  | "fees";

export type PropertyType =
  | "flat"
  | "terraced"
  | "semiDetached"
  | "detached"
  | "bungalow";

export type EstimateInput = {
  region: Region;
  projectType: ProjectType;
  propertyType: PropertyType;
  totalAreaM2: number;
  condition: Condition;
  finishLevel: FinishLevel;
  kitchens?: number;
  bathrooms?: number;
};

export type CategoryRange = {
  low: number;
  typical: number;
  high: number;
};

export type EstimateCategoryBreakdown = {
  category: EstimateCategory;
  range: CategoryRange;
};

export type EstimateResult = {
  overall: CategoryRange;
  costPerM2: CategoryRange;
  breakdown: EstimateCategoryBreakdown[];
};
