import { NextResponse } from "next/server";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { estimateProject } from "@/lib/estimator";
import type {
  Condition,
  EstimateInput,
  FinishLevel,
  Region
} from "@/lib/types";

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

type EstimateProjectRequestBody = {
  region?: unknown;
  propertyType?: unknown;
  totalAreaM2?: unknown;
  condition?: unknown;
  finishLevel?: unknown;
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

  try {
    const estimateResult = estimateProject(estimateInput, defaultCostLibrary);

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
