import { NextResponse } from "next/server";
import type {
  AdditionalFeature,
  Condition,
  EstimateInput,
  FinishLevel,
  PropertyCategory,
  RenovationScope,
  Region
} from "@/lib/types";
import {
  calculateEnhancedEstimate,
  conditionToRenovationScope,
  getFallbackPostcodeDistrict,
  inferPropertyCategory
} from "@/lib/enhancedEstimator";

const REGION_VALUES: Region[] = [
  "London",
  "SouthEast",
  "Midlands",
  "North",
  "Scotland",
  "Wales"
];
const CONDITION_VALUES: Condition[] = ["poor", "fair", "good"];
const FINISH_LEVEL_VALUES: FinishLevel[] = ["budget", "standard", "premium"];
const PROPERTY_CATEGORY_VALUES: PropertyCategory[] = [
  "flat",
  "terraced",
  "semi-detached",
  "detached",
  "bungalow",
  "hmo",
  "commercial"
];
const RENOVATION_SCOPE_VALUES: RenovationScope[] = [
  "cosmetic",
  "standard",
  "full",
  "structural"
];
const ADDITIONAL_FEATURE_VALUES: AdditionalFeature[] = [
  "loft_conversion",
  "extension_single_storey",
  "extension_double_storey",
  "basement_conversion",
  "new_roof",
  "full_rewire",
  "new_boiler",
  "underfloor_heating",
  "solar_panels",
  "new_windows_throughout",
  "garden_landscaping",
  "driveway"
];

type EstimateProjectRequestBody = {
  region?: unknown;
  propertyType?: unknown;
  totalAreaM2?: unknown;
  condition?: unknown;
  finishLevel?: unknown;
  postcodeDistrict?: unknown;
  propertyCategory?: unknown;
  renovationScope?: unknown;
  additionalFeatures?: unknown;
  yearBuilt?: unknown;
  listedBuilding?: unknown;
};

function isRegion(value: unknown): value is Region {
  return typeof value === "string" && REGION_VALUES.includes(value as Region);
}

function isCondition(value: unknown): value is Condition {
  return typeof value === "string" && CONDITION_VALUES.includes(value as Condition);
}

function isFinishLevel(value: unknown): value is FinishLevel {
  return (
    typeof value === "string" &&
    FINISH_LEVEL_VALUES.includes(value as FinishLevel)
  );
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function isPropertyCategory(value: unknown): value is PropertyCategory {
  return (
    typeof value === "string" &&
    PROPERTY_CATEGORY_VALUES.includes(value as PropertyCategory)
  );
}

function isRenovationScope(value: unknown): value is RenovationScope {
  return (
    typeof value === "string" &&
    RENOVATION_SCOPE_VALUES.includes(value as RenovationScope)
  );
}

function parseAdditionalFeatures(value: unknown): AdditionalFeature[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const features = value.filter(
    (item): item is AdditionalFeature =>
      typeof item === "string" &&
      ADDITIONAL_FEATURE_VALUES.includes(item as AdditionalFeature)
  );
  return features.length === value.length ? features : null;
}

function parseYearBuilt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
}

function parseListedBuilding(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: EstimateProjectRequestBody;

  try {
    body = (await request.json()) as EstimateProjectRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRegion(body.region)) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  if (!isCondition(body.condition)) {
    return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  }

  if (!isFinishLevel(body.finishLevel)) {
    return NextResponse.json({ error: "Invalid finishLevel" }, { status: 400 });
  }

  const propertyType =
    typeof body.propertyType === "string" ? body.propertyType.trim() : "";
  if (!propertyType) {
    return NextResponse.json(
      { error: "Property type is required" },
      { status: 400 }
    );
  }

  const totalAreaM2 = parsePositiveNumber(body.totalAreaM2);
  if (!totalAreaM2) {
    return NextResponse.json(
      { error: "Area must be greater than zero" },
      { status: 400 }
    );
  }

  const estimateInput: EstimateInput = {
    region: body.region,
    projectType: "refurb",
    propertyType,
    totalAreaM2,
    condition: body.condition,
    finishLevel: body.finishLevel
  };

  const postcodeDistrict =
    typeof body.postcodeDistrict === "string" && body.postcodeDistrict.trim().length > 0
      ? body.postcodeDistrict.trim().toUpperCase()
      : getFallbackPostcodeDistrict(body.region);

  const propertyCategory = isPropertyCategory(body.propertyCategory)
    ? body.propertyCategory
    : inferPropertyCategory(propertyType);

  const renovationScope = isRenovationScope(body.renovationScope)
    ? body.renovationScope
    : conditionToRenovationScope(body.condition);

  const additionalFeatures = parseAdditionalFeatures(body.additionalFeatures);
  if (Array.isArray(body.additionalFeatures) && additionalFeatures === null) {
    return NextResponse.json(
      { error: "Invalid additionalFeatures" },
      { status: 400 }
    );
  }

  const yearBuilt = parseYearBuilt(body.yearBuilt);
  const listedBuilding = parseListedBuilding(body.listedBuilding);

  try {
    const estimateResult = calculateEnhancedEstimate({
      propertyCategory,
      postcodeDistrict,
      totalAreaM2,
      renovationScope,
      qualityTier: body.finishLevel,
      additionalFeatures: additionalFeatures ?? [],
      yearBuilt,
      listedBuilding
    });

    return NextResponse.json(
      {
        estimateInput,
        estimateResult
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to estimate project";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
