import { NextResponse } from "next/server";
import OpenAI from "openai";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { estimateProject } from "@/lib/estimator";
import type {
  Condition,
  EstimateInput,
  FinishLevel,
  Region
} from "@/lib/types";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const DEFAULT_REGION: Region = "Midlands";
const DEFAULT_CONDITION: Condition = "fair";
const DEFAULT_FINISH_LEVEL: FinishLevel = "standard";

const SYSTEM_PROMPT = `You are a UK property refurbishment expert. Analyse the provided property photo and return a JSON object with these exact fields:
{
  "propertyType": "string — one of: terraced house, semi-detached house, detached house, flat/apartment, bungalow, commercial unit",
  "totalAreaM2": number — estimated gross internal area in square metres based on what you see,
  "condition": "string — one of: poor, fair, good",
  "finishLevel": "string — one of: budget, standard, premium — estimate what finish level the refurb would target",
  "region": "string — one of: London, SouthEast, Midlands, North, Scotland, Wales — infer from any visible clues (architecture style, signage, etc.), or null if uncertain",
  "confidence": "string — one of: high, medium, low — your overall confidence in the analysis",
  "notes": "string — brief explanation of your reasoning (1-3 sentences)"
}
Rules:
- Return ONLY valid JSON, no markdown fences
- If the image is not a property photo, return: {"error": "not_a_property", "message": "Please upload a photo of a property"}
- totalAreaM2 must be a positive number between 15 and 2000
- Be conservative with area estimates — it is better to underestimate than overestimate`;

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
const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
type Confidence = (typeof CONFIDENCE_VALUES)[number];

type PhotoEstimateRequestBody = {
  image?: unknown;
  region?: unknown;
};

type AiAnalysisResponse = {
  propertyType?: unknown;
  totalAreaM2?: unknown;
  condition?: unknown;
  finishLevel?: unknown;
  region?: unknown;
  confidence?: unknown;
  notes?: unknown;
  error?: unknown;
  message?: unknown;
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

function isConfidence(value: unknown): value is Confidence {
  return (
    typeof value === "string" &&
    CONFIDENCE_VALUES.includes(value as Confidence)
  );
}

function getBase64ByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const sanitized = base64.replace(/\s/g, "");
  const paddingLength = sanitized.endsWith("==")
    ? 2
    : sanitized.endsWith("=")
      ? 1
      : 0;
  return Math.floor((sanitized.length * 3) / 4) - paddingLength;
}

function clampArea(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 15;
  }
  return Math.max(15, Math.min(2000, parsed));
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Server is missing OPENAI_API_KEY configuration" },
        { status: 500 }
      );
    }

    const openai = new OpenAI();

    const body = (await request.json()) as PhotoEstimateRequestBody;
    const image = typeof body.image === "string" ? body.image.trim() : "";

    if (!image) {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    const imageSizeBytes = getBase64ByteSize(image);
    if (imageSizeBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image is too large. Maximum size is 20MB" },
        { status: 400 }
      );
    }

    const overrideRegion = isRegion(body.region) ? body.region : undefined;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      max_tokens: 1000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [{ type: "image_url", image_url: { url: image } }]
        }
      ]
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI response was empty");
    }

    const parsed = JSON.parse(content) as AiAnalysisResponse;

    if (parsed.error === "not_a_property") {
      return NextResponse.json(
        {
          error: "not_a_property",
          message: asNonEmptyString(
            parsed.message,
            "Please upload a photo of a property"
          )
        },
        { status: 400 }
      );
    }

    const condition = isCondition(parsed.condition)
      ? parsed.condition
      : DEFAULT_CONDITION;
    const finishLevel = isFinishLevel(parsed.finishLevel)
      ? parsed.finishLevel
      : DEFAULT_FINISH_LEVEL;
    const detectedRegion = isRegion(parsed.region) ? parsed.region : undefined;
    const region = overrideRegion ?? detectedRegion ?? DEFAULT_REGION;
    const totalAreaM2 = clampArea(parsed.totalAreaM2);
    const propertyType = asNonEmptyString(parsed.propertyType, "flat/apartment");
    const confidence: Confidence = isConfidence(parsed.confidence)
      ? parsed.confidence
      : "low";
    const notes = asNonEmptyString(
      parsed.notes,
      "Analysis generated from visible external property features."
    );

    const estimateInput: EstimateInput = {
      region,
      projectType: "refurb",
      propertyType,
      totalAreaM2,
      condition,
      finishLevel
    };

    const estimateResult = estimateProject(estimateInput, defaultCostLibrary);

    return NextResponse.json({
      aiAnalysis: {
        propertyType,
        totalAreaM2,
        condition,
        finishLevel,
        region,
        confidence,
        notes
      },
      estimateInput,
      estimateResult
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to process photo estimate";

    return NextResponse.json(
      { error: "Failed to generate photo estimate", message },
      { status: 500 }
    );
  }
}
