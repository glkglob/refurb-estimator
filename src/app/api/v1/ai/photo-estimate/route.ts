import { aiClient } from "@/lib/ai/client";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  Condition,
  EstimateInput,
  FinishLevel,
  Region
} from "@/lib/types";
import {
  calculateEnhancedEstimate,
  conditionToRenovationScope,
  getFallbackPostcodeDistrict,
  inferPropertyCategory
} from "@/lib/enhancedEstimator";
import { validateJsonRequest } from "@/lib/validate";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const DEFAULT_REGION: Region = "WestMidlands";
const DEFAULT_CONDITION: Condition = "fair";
const DEFAULT_FINISH_LEVEL: FinishLevel = "standard";
const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const IS_LM_STUDIO = process.env.AI_PROVIDER === "lmstudio";
const PHOTO_MODEL = IS_LM_STUDIO ? (process.env.LM_STUDIO_MODEL ?? "qwen/qwen3-4b") : "gpt-4o";

const SYSTEM_PROMPT = `You are a UK property refurbishment expert and chartered surveyor. Analyse the provided property photo and return a JSON object with these exact fields:

{
  "propertyType": "string — one of: terraced house, semi-detached house, detached house, flat/apartment, bungalow, commercial unit",
  "totalAreaM2": number — estimated gross internal area in square metres,
  "condition": "string — one of: poor, fair, good",
  "finishLevel": "string — one of: budget, standard, premium — estimate what finish level the refurb would target",
  "region": "string — one of: London, SouthEast, Midlands, North, Scotland, Wales — infer from any visible clues (architecture style, signage, street furniture, brickwork), or null if uncertain",
  "confidence": "string — one of: high, medium, low — your overall confidence in the analysis",
  "notes": "string — brief explanation of your reasoning (2-4 sentences)"
}

Area estimation guidelines — use these UK benchmarks:
- Terraced house (2-bed): 55-75 m², (3-bed): 75-95 m²
- Semi-detached house (3-bed): 80-100 m², (4-bed): 100-130 m²
- Detached house (3-bed): 100-140 m², (4-bed): 130-200 m²
- Flat/apartment (1-bed): 35-50 m², (2-bed): 50-75 m²
- Bungalow (2-bed): 60-80 m², (3-bed): 80-110 m²

Think step by step:
1. Identify the property type from architectural features
2. Count visible windows/floors to estimate number of bedrooms
3. Cross-reference bedroom count with the area benchmarks above
4. Adjust for any visible extensions, conversions, or unusual proportions
5. State your reasoning in the notes field

Condition assessment:
- poor: visible damp, damaged roof/guttering, cracked render, rotten windows, overgrown neglect
- fair: dated but structurally sound, needs cosmetic work and possibly new kitchen/bathroom
- good: well-maintained, mostly cosmetic refresh needed

Rules:
- Return ONLY valid JSON, no markdown fences
- If the image is not a property photo, return: {"error": "not_a_property", "message": "Please upload a photo of a property"}
- totalAreaM2 must be a positive number between 15 and 2000
- Be conservative — it is better to slightly underestimate area than overestimate
- Always explain in notes how you arrived at the area estimate
- You may also receive optional user hints (bedrooms, approximate area, postcode). Treat these as supporting context and combine with visual evidence from all provided photos.`;

const REGION_VALUES: Region[] = [
  "London",
  "SouthEast",
  "EastOfEngland",
  "EastMidlands",
  "WestMidlands",
  "SouthWest",
  "Northwest",
  "NorthEast",
  "YorkshireAndTheHumber",
  "Scotland",
  "Wales",
  "NorthernIreland"
];
const CONDITION_VALUES: Condition[] = ["poor", "fair", "good"];
const FINISH_LEVEL_VALUES: FinishLevel[] = ["budget", "standard", "premium"];
const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;
type Confidence = (typeof CONFIDENCE_VALUES)[number];

type PhotoEstimateRequestBody = {
  image?: unknown;
  region?: unknown;
  bedrooms?: unknown;
  approxAreaM2?: unknown;
  postcode?: unknown;
};

const photoEstimateBodySchema = z
  .object({
    image: z.union([z.string(), z.array(z.string())]).optional(),
    region: z.string().optional(),
    bedrooms: z.union([z.string(), z.number()]).optional(),
    approxAreaM2: z.union([z.string(), z.number()]).optional(),
    postcode: z.string().optional()
  })
  .passthrough();

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

function normalizeImagePayload(image: unknown): string[] {
  if (typeof image === "string") {
    const trimmed = image.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(image)) {
    return image
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
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

function normalizeBedrooms(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  const rounded = Math.round(parsed);
  if (rounded < 1 || rounded > 10) {
    return undefined;
  }
  return rounded;
}

function normalizeApproxArea(value: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  if (parsed < 15 || parsed > 2000) {
    return undefined;
  }
  return Math.round(parsed);
}

function normalizePostcode(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return normalized.slice(0, 8);
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const now = Date.now();
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, now);

    if (!rateLimit.isAllowed) {
      const retryAfterSeconds = rateLimit.retryAfterSeconds ?? 60;
      return jsonError(
        "Too many requests. Please try again later.",
        requestId,
        429,
        { retryAfter: retryAfterSeconds }
      );
    }

    const skipAuth = process.env.SKIP_AUTH === "true";
    if (!skipAuth) {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
        error: authError
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return jsonError("Sign in to use AI photo estimates.", requestId, 401);
      }
    }

    const parsedBody = await validateJsonRequest(request, photoEstimateBodySchema, {
      invalidJsonMessage: "Image is required",
      errorMessage: "Invalid photo estimate payload"
    });
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const body = parsedBody.data as PhotoEstimateRequestBody;

    const images = normalizeImagePayload(body.image);
    if (images.length === 0 && IS_LM_STUDIO === false) {
      return jsonError("Image is required", requestId, 400);
    }

    if (images.length > 3) {
      return jsonError("You can upload up to 3 images per estimate.", requestId, 400);
    }

    for (const image of images) {
      const imageSizeBytes = getBase64ByteSize(image);
      if (imageSizeBytes > MAX_IMAGE_BYTES) {
        return jsonError("Image is too large. Maximum size is 20MB", requestId, 400);
      }

      if (!isValidDataUrlImage(image)) {
        return jsonError(
          "Invalid image format. Please upload a JPEG, PNG, or WebP image.",
          requestId,
          400
        );
      }
    }


    const overrideRegion = isRegion(body.region) ? body.region : undefined;
    const bedroomsHint = normalizeBedrooms(body.bedrooms);
    const approxAreaHint = normalizeApproxArea(body.approxAreaM2);
    const postcodeHint = normalizePostcode(body.postcode);

    const hintLines = [
      `Region override: ${overrideRegion ?? "none"}`,
      `Bedrooms hint: ${bedroomsHint ?? "unknown"}`,
      `Approx area hint (m2): ${approxAreaHint ?? "unknown"}`,
      `Postcode hint: ${postcodeHint ?? "unknown"}`
    ];

    const userText = `Analyse all provided property photos together.\n${hintLines.join("\n")}`;
    const userContent: Array<
      { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
    > = IS_LM_STUDIO
      ? [{ type: "text", text: userText }]
      : [
          { type: "text", text: userText },
          ...(IS_LM_STUDIO ? [] : images.map((image) => ({ type: "image_url" as const, image_url: { url: image } })))
        ];

    const completion = await aiClient.chat.completions.create({
      model: PHOTO_MODEL,
      max_tokens: 1000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent }
      ]
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("OpenAI response was empty");
    }

    const parsed = JSON.parse(content) as AiAnalysisResponse;

    if (parsed.error === "not_a_property") {
      return jsonError(
        "not_a_property",
        requestId,
        400,
        {
          message: asNonEmptyString(
            parsed.message,
            "Please upload a photo of a property"
          )
        }
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

    const estimateResult = calculateEnhancedEstimate({
      propertyCategory: inferPropertyCategory(propertyType),
      postcodeDistrict: postcodeHint ?? getFallbackPostcodeDistrict(region),
      totalAreaM2,
      renovationScope: conditionToRenovationScope(condition),
      qualityTier: finishLevel,
      additionalFeatures: [],
      listedBuilding: false
    });

    return jsonSuccess({
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
    }, requestId);
  } catch (error) {
    logError("photo-estimate", requestId, error);

    const message =
      error instanceof Error ? error.message : "Failed to process photo estimate";
    return jsonError("Failed to generate photo estimate", requestId, 500, { message });
  }
}
