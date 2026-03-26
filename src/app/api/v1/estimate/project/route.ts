import { z } from "zod";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
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
import { PropertyType } from "@/lib/propertyType";
import { requireRole } from "@/lib/rbac";
import { AuthError, handleAuthError } from "@/lib/supabase/auth-helpers";
import { validateJsonRequest } from "@/lib/validate";

const ROUTE_TAG = "api/v1/estimate/project";

const REGION_VALUES: Region[] = [
  "London",
  "SouthEast",
  "EastOfEngland",
  "EastMidlands",
  "WestMidlands",
  "SouthWest",
  "NorthWest",
  "NorthEast",
  "YorkshireAndTheHumber",
  "Scotland",
  "Wales",
  "NorthernIreland"
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
  region: Region;
  propertyType: PropertyType;
  totalAreaM2: number;
  condition: Condition;
  finishLevel: FinishLevel;
  postcodeDistrict?: unknown;
  propertyCategory?: unknown;
  renovationScope?: unknown;
  additionalFeatures?: unknown;
  yearBuilt?: unknown;
  listedBuilding?: unknown;
};

const estimateProjectSchema = z.object({
  region: z.enum(REGION_VALUES),
  propertyType: z.nativeEnum(PropertyType),
  totalAreaM2: z.coerce.number().positive("Area must be greater than zero"),
  condition: z.enum(CONDITION_VALUES),
  finishLevel: z.enum(FINISH_LEVEL_VALUES),
  postcodeDistrict: z.unknown().optional(),
  propertyCategory: z.unknown().optional(),
  renovationScope: z.unknown().optional(),
  additionalFeatures: z.unknown().optional(),
  yearBuilt: z.unknown().optional(),
  listedBuilding: z.unknown().optional()
});

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
  const requestId = getRequestId(request);

  try {
    await requireRole(["TRADESPERSON", "ADMIN"]);

    const parsedBody = await validateJsonRequest(request, estimateProjectSchema, {
      errorMessage: "Invalid project estimate payload"
    });
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const body = parsedBody.data as EstimateProjectRequestBody;

    const propertyType = body.propertyType;

    const totalAreaM2 = body.totalAreaM2;

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
      return jsonError("Invalid additionalFeatures", requestId, 400);
    }

    const yearBuilt = parseYearBuilt(body.yearBuilt);
    const listedBuilding = parseListedBuilding(body.listedBuilding);

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

    return jsonSuccess(
      {
        estimateInput,
        estimateResult
      }, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message =
      error instanceof Error ? error.message : "Failed to estimate project";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 400);
  }
}
