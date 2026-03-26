import { z } from "zod";
import { PropertyType } from "./propertyType";
import type {
  Condition,
  CostCategory,
  EstimateInput,
  EstimateResult,
  FinishLevel,
  NewBuildCategory,
  NewBuildInput,
  NewBuildResult,
  NewBuildSpec,
  Region,
  RoomInput,
  RoomType,
} from "./types";

const regionSchema = z.enum([
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
  "NorthernIreland",
]) satisfies z.ZodType<Region>;

const finishLevelSchema = z.enum(["budget", "standard", "premium"]) satisfies z.ZodType<FinishLevel>;
const conditionSchema = z.enum(["poor", "fair", "good"]) satisfies z.ZodType<Condition>;
const roomTypeSchema = z.enum(["kitchen", "bathroom", "bedroom", "living", "hallway", "utility"]) satisfies z.ZodType<RoomType>;
const costCategorySchema = z.enum([
  "kitchen",
  "bathroom",
  "electrics",
  "plumbing",
  "heating",
  "windows",
  "doors",
  "plastering",
  "decoration",
  "flooring",
  "contingency",
  "fees",
]) satisfies z.ZodType<CostCategory>;

const roomInputSchema = z.object({
  id: z.string().min(1),
  roomType: roomTypeSchema,
  areaM2: z.number().nonnegative(),
  intensity: z.enum(["light", "full"]),
  finishLevel: finishLevelSchema,
}) satisfies z.ZodType<RoomInput>;

const estimateInputSchema = z.object({
  region: regionSchema,
  projectType: z.enum(["refurb", "new_build"]),
  propertyType: z.nativeEnum(PropertyType),
  totalAreaM2: z.number().positive(),
  condition: conditionSchema,
  finishLevel: finishLevelSchema,
  rooms: roomInputSchema.array().optional(),
}) satisfies z.ZodType<EstimateInput>;

const categoryBreakdownSchema = z.object({
  category: costCategorySchema,
  low: z.number(),
  typical: z.number(),
  high: z.number(),
});

const estimateResultSchema = z.object({
  totalLow: z.number(),
  totalTypical: z.number(),
  totalHigh: z.number(),
  costPerM2: z.object({
    low: z.number(),
    typical: z.number(),
    high: z.number(),
  }),
  categories: categoryBreakdownSchema.array(),
}) satisfies z.ZodType<EstimateResult>;

const newBuildCategorySchema = z.enum([
  "substructure",
  "superstructure",
  "external_envelope",
  "windows_and_doors",
  "internal_finishes",
  "kitchen",
  "bathrooms",
  "electrics",
  "plumbing_and_heating",
  "external_works",
  "preliminaries",
  "contingency",
  "professional_fees",
]) satisfies z.ZodType<NewBuildCategory>;

const newBuildPropertyTypeSchema = z.nativeEnum(PropertyType);

const newBuildSpecSchema = z.enum(["basic", "standard", "premium"]) satisfies z.ZodType<NewBuildSpec>;

const newBuildInputSchema = z.object({
  propertyType: newBuildPropertyTypeSchema,
  spec: newBuildSpecSchema,
  totalAreaM2: z.number().positive(),
  bedrooms: z.number().int().nonnegative(),
  storeys: z.number().int().nonnegative(),
  postcodeDistrict: z.string().min(1),
  garage: z.boolean().optional(),
  renewableEnergy: z.boolean().optional(),
  basementIncluded: z.boolean().optional(),
  numberOfUnits: z.number().int().positive().optional(),
  numberOfStoreys: z.number().int().positive().optional(),
  liftIncluded: z.boolean().optional(),
  commercialGroundFloor: z.boolean().optional(),
  numberOfLettableRooms: z.number().int().positive().optional(),
  enSuitePerRoom: z.boolean().optional(),
  communalKitchen: z.boolean().optional(),
  fireEscapeRequired: z.boolean().optional(),
  commercialType: z
    .enum(["office", "retail", "industrial", "leisure", "healthcare"])
    .optional(),
  fitOutLevel: z.enum(["shell_only", "cat_a", "cat_b"]).optional(),
  disabledAccess: z.boolean().optional(),
  extractionSystem: z.boolean().optional(),
  parkingSpaces: z.number().int().nonnegative().optional(),
}) satisfies z.ZodType<NewBuildInput>;

const newBuildCategoryBreakdownSchema = z.object({
  category: newBuildCategorySchema,
  low: z.number(),
  typical: z.number(),
  high: z.number(),
});

const newBuildResultSchema = z.object({
  totalLow: z.number(),
  totalTypical: z.number(),
  totalHigh: z.number(),
  costPerM2: z.object({ low: z.number(), typical: z.number(), high: z.number() }),
  categories: newBuildCategoryBreakdownSchema.array(),
  adjustments: z
    .object({
      label: z.string(),
      amount: z.number(),
      reason: z.string(),
    })
    .array(),
  contingencyPercent: z.number(),
  feesPercent: z.number(),
  region: regionSchema,
  metadata: z.object({
    propertyType: newBuildPropertyTypeSchema,
    spec: newBuildSpecSchema,
    bedrooms: z.number().int().nonnegative(),
    storeys: z.number().int().nonnegative(),
    postcodeDistrict: z.string(),
    estimatedAt: z.string(),
    numberOfUnits: z.number().int().positive().optional(),
    costPerUnit: z
      .object({ low: z.number(), typical: z.number(), high: z.number() })
      .optional(),
    numberOfLettableRooms: z.number().int().positive().optional(),
    costPerLettableRoom: z
      .object({ low: z.number(), typical: z.number(), high: z.number() })
      .optional(),
    commercialType: z
      .enum(["office", "retail", "industrial", "leisure", "healthcare"])
      .optional(),
    fitOutLevel: z.enum(["shell_only", "cat_a", "cat_b"]).optional(),
  }),
}) satisfies z.ZodType<NewBuildResult>;

const sharedEstimateSnapshotSchemaInternal = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("rooms"),
    input: estimateInputSchema,
    result: estimateResultSchema,
  }),
  z.object({
    kind: z.literal("new_build"),
    input: newBuildInputSchema,
    result: newBuildResultSchema,
  }),
]);

export type SharedEstimateSnapshot =
  | {
      kind: "rooms";
      input: EstimateInput;
      result: EstimateResult;
    }
  | {
      kind: "new_build";
      input: NewBuildInput;
      result: NewBuildResult;
    };

export const sharedEstimateSnapshotSchema = sharedEstimateSnapshotSchemaInternal;

export type CreateShareResponse = {
  token: string;
  expiresAt: string;
};

export type GetShareResponse = {
  estimateData: SharedEstimateSnapshot;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
};

type ErrorResponse = {
  error?: string;
};

export async function shareOrCopy(
  title: string,
  text: string,
  url?: string,
): Promise<void> {
  if (navigator.share) {
    await navigator.share({ title, text, url });
    return;
  }

  await navigator.clipboard.writeText(url ?? text);
}

export async function createSharedEstimate(
  estimateData: SharedEstimateSnapshot,
): Promise<CreateShareResponse> {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ estimateData }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorResponse | null;
    throw new Error(payload?.error ?? "Unable to create share link");
  }

  return (await response.json()) as CreateShareResponse;
}

export async function getSharedEstimate(token: string): Promise<GetShareResponse> {
  const response = await fetch(`/api/share?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ErrorResponse | null;
    const error = new Error(payload?.error ?? "Unable to fetch shared estimate") as Error & {
      status?: number;
    };
    error.status = response.status;
    throw error;
  }

  return (await response.json()) as GetShareResponse;
}

export function parseSharedEstimateSnapshot(
  value: unknown,
): SharedEstimateSnapshot | null {
  const parsed = sharedEstimateSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}
