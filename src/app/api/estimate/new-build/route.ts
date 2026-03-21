import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateNewBuild } from "@/lib/newBuildEstimator";
import type { NewBuildInput } from "@/lib/types";

const newBuildSchema = z
  .object({
    propertyType: z.enum([
      "flat",
      "terraced",
      "semi-detached",
      "detached",
      "bungalow",
      "hmo",
      "block_of_flats",
      "commercial"
    ]),
    spec: z.enum(["basic", "standard", "premium"]),
    totalAreaM2: z.number().positive().max(10000),
    bedrooms: z.number().int().min(1).max(20),
    storeys: z.number().int().min(1).max(20),
    postcodeDistrict: z.string().trim().min(1),
    garage: z.boolean().optional(),
    renewableEnergy: z.boolean().optional(),
    basementIncluded: z.boolean().optional(),
    numberOfUnits: z.number().int().min(2).optional(),
    numberOfStoreys: z.number().int().min(1).max(20).optional(),
    liftIncluded: z.boolean().optional(),
    commercialGroundFloor: z.boolean().optional(),
    numberOfLettableRooms: z.number().int().min(3).max(20).optional(),
    enSuitePerRoom: z.boolean().optional(),
    communalKitchen: z.boolean().optional(),
    fireEscapeRequired: z.boolean().optional(),
    commercialType: z.enum(["office", "retail", "warehouse", "restaurant"]).optional(),
    fitOutLevel: z.enum(["shell_only", "cat_a", "cat_b"]).optional(),
    disabledAccess: z.boolean().optional(),
    extractionSystem: z.boolean().optional(),
    parkingSpaces: z.number().int().min(0).max(500).optional()
  })
  .superRefine((data, ctx) => {
    if (data.propertyType === "block_of_flats") {
      if (!data.numberOfUnits || data.numberOfUnits < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Block of flats must include at least 2 units",
          path: ["numberOfUnits"]
        });
      }
      return;
    }

    if (data.storeys > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Storeys must be between 1 and 5 for houses",
        path: ["storeys"]
      });
    }
  });

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as NewBuildInput;
    const parsed = newBuildSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid request body";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const result = calculateNewBuild(parsed.data);
    return NextResponse.json({ input: parsed.data, result }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to calculate new build estimate";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
