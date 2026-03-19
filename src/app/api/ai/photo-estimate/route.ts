import { NextResponse } from "next/server";
import OpenAI from "openai";
import { defaultCostLibrary } from "@/lib/costLibrary";
import { estimateProject } from "@/lib/estimator";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Condition,
  EstimateInput,
  FinishLevel,
  Region
} from "@/lib/types";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const DEFAULT_REGION: Region = "Midlands";
const DEFAULT_CONDITION: Condition = "fair";
const DEFAULT_FINISH_LEVEL: FinishLevel = "standard";
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

type RateLimitEntry = {
  count: number;
  resetTime: number;
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

const rateLimitStore = new Map<string, RateLimitEntry>();

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

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "unknown";
}

function cleanupExpiredRateLimits(now: number) {
  for (const [ip, entry] of rateLimitStore.entries()) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(ip);
    }
  }
}

function checkRateLimit(ip: string, now: number): {
  isAllowed: boolean;
  retryAfterSeconds?: number;
} {
  cleanupExpiredRateLimits(now);

  const current = rateLimitStore.get(ip);
  if (!current) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    return { isAllowed: true };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      isAllowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetTime - now) / 1000))
    };
  }

  current.count += 1;
  rateLimitStore.set(ip, current);
  return { isAllowed: true };
}

function isValidDataUrlImage(image: string): boolean {
  const match = image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i);
  if (!match) {
    return false;
  }
  return SUPPORTED_IMAGE_MIME_TYPES.has(match[1].toLowerCase());
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
    const now = Date.now();
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, now);

    if (!rateLimit.isAllowed) {
      const retryAfterSeconds = rateLimit.retryAfterSeconds ?? 60;
      return NextResponse.json(
        {
          error: "Too many requests. Please try again later.",
          retryAfter: retryAfterSeconds
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSeconds)
          }
        }
      );
    }

    const isSupabaseConfigured = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    if (isSupabaseConfigured) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return NextResponse.json(
          { error: "Sign in to use AI photo estimates." },
          { status: 401 }
        );
      }
    }

    let body: PhotoEstimateRequestBody;
    try {
      body = (await request.json()) as PhotoEstimateRequestBody;
    } catch {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

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

    if (!isValidDataUrlImage(image)) {
      return NextResponse.json(
        { error: "Invalid image format. Please upload a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Server is missing OPENAI_API_KEY configuration" },
        { status: 500 }
      );
    }

    const openai = new OpenAI();

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
