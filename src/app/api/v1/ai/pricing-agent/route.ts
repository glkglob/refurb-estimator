import { z } from "zod";
import { NextResponse } from "next/server";
import { generateTextWithHuggingFace } from "@/lib/huggingface";
import { validateJsonRequest } from "@/lib/validate";

const pricingAgentRequestSchema = z.object({
  propertyType: z.string().trim().min(2).max(120),
  location: z.string().trim().min(2).max(160),
  floorAreaM2: z.coerce.number().positive().max(10_000),
  condition: z.enum(["poor", "fair", "good"]),
  scope: z.string().trim().min(10).max(4000),
  photos: z.array(z.string().trim().min(1)).max(3).optional()
});

const pricingCategorySchema = z.object({
  name: z.string().trim().min(1),
  low: z.number().nonnegative(),
  typical: z.number().nonnegative(),
  high: z.number().nonnegative(),
  notes: z.string().trim().min(1)
});

const pricingAgentResponseSchema = z.object({
  summary: z.string().trim().min(1),
  categories: z.array(pricingCategorySchema).min(1).max(20),
  totalLow: z.number().nonnegative(),
  totalTypical: z.number().nonnegative(),
  totalHigh: z.number().nonnegative(),
  advice: z.string().trim().min(1)
});

type PricingAgentRequest = z.infer<typeof pricingAgentRequestSchema>;
type PricingAgentResponse = z.infer<typeof pricingAgentResponseSchema>;

const SYSTEM_PROMPT = `You are an expert UK property refurbishment pricing consultant with 20 years experience. You provide detailed, accurate cost estimates for UK properties based on current 2024-2025 market rates. Always provide Low/Typical/High ranges. Break costs down by trade category. Consider regional price variations across UK. Be specific and professional.

Rules:
- Return valid JSON only, no markdown.
- All money values are GBP numbers only (no currency symbols in values).
- Use realistic UK trade categories and include concise notes for each category.
- Ensure totals equal the category sums.
- low <= typical <= high for every category and for total values.
- Be conservative and transparent in advice about unknowns/risk.`;

function stripCodeFences(value: string): string {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function parseJson(text: string): unknown {
  const cleaned = stripCodeFences(text);
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("AI pricing response did not contain valid JSON");
  }
}

function clampTypical(low: number, typical: number, high: number): number {
  return Math.min(high, Math.max(low, typical));
}

function normalizePricingResponse(payload: PricingAgentResponse): PricingAgentResponse {
  const categories = payload.categories.map((category) => {
    const low = Math.round(Math.min(category.low, category.typical, category.high));
    const high = Math.round(Math.max(category.low, category.typical, category.high));
    const typical = Math.round(clampTypical(low, category.typical, high));

    return {
      ...category,
      low,
      typical,
      high
    };
  });

  const totalLow = categories.reduce((sum, category) => sum + category.low, 0);
  const totalTypical = categories.reduce((sum, category) => sum + category.typical, 0);
  const totalHigh = categories.reduce((sum, category) => sum + category.high, 0);

  return {
    summary: payload.summary.trim(),
    advice: payload.advice.trim(),
    categories,
    totalLow,
    totalTypical,
    totalHigh
  };
}

function summarizePhotosForTextModel(photos: string[] | undefined): string {
  if (!photos || photos.length === 0) {
    return "No photos provided.";
  }

  return photos
    .map((photo, index) => {
      const trimmed = photo.trim();
      if (trimmed.startsWith("data:image/")) {
        return `Photo ${index + 1}: inline image uploaded (binary omitted).`;
      }

      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return `Photo ${index + 1}: ${trimmed}`;
      }

      return `Photo ${index + 1}: unsupported image reference format.`;
    })
    .join("\n");
}

function buildUserPrompt(input: PricingAgentRequest): string {
  return [
    "Generate a UK refurbishment pricing estimate using the provided project inputs.",
    `Property type: ${input.propertyType}`,
    `Location/postcode: ${input.location}`,
    `Floor area (m²): ${input.floorAreaM2}`,
    `Current condition: ${input.condition}`,
    `Renovation scope: ${input.scope}`,
    `Photos provided: ${input.photos?.length ?? 0}`,
    "Return JSON in the exact shape:",
    "{",
    '  "summary": "string",',
    '  "categories": [{ "name": "string", "low": number, "typical": number, "high": number, "notes": "string" }],',
    '  "totalLow": number,',
    '  "totalTypical": number,',
    '  "totalHigh": number,',
    '  "advice": "string"',
    "}"
  ].join("\n");
}

async function generatePricingWithHuggingFace(
  token: string,
  input: PricingAgentRequest
): Promise<string> {
  const model = process.env.HUGGINGFACE_PRICING_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.3";
  const prompt = [
    SYSTEM_PROMPT,
    "",
    buildUserPrompt(input),
    "",
    "Photo references for context:",
    summarizePhotosForTextModel(input.photos),
    "",
    "Return JSON only."
  ].join("\n");

  return generateTextWithHuggingFace({
    token,
    model,
    prompt,
    temperature: 0.2,
    maxNewTokens: 1600
  });
}

export async function POST(request: Request) {
  try {
    const parsed = await validateJsonRequest(request, pricingAgentRequestSchema, {
      errorMessage: "Invalid pricing-agent payload"
    });

    if (!parsed.success) {
      return parsed.response;
    }

    const huggingFaceToken =
      process.env.COST_ESTIMATION_API_KEY ?? process.env.HUGGINGFACE_REFURB_PRICING_KEY;
    if (!huggingFaceToken) {
      return NextResponse.json(
        { error: "COST_ESTIMATION_API_KEY or HUGGINGFACE_REFURB_PRICING_KEY is not configured" },
        { status: 500 }
      );
    }

    const input = parsed.data;
    const rawText = await generatePricingWithHuggingFace(huggingFaceToken, input);

    const json = parseJson(rawText);
    const validated = pricingAgentResponseSchema.parse(json);
    const normalized = normalizePricingResponse(validated);

    return NextResponse.json(normalized, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Pricing response validation failed",
          details: error.issues.map((issue) => issue.message)
        },
        { status: 502 }
      );
    }

    const message = error instanceof Error ? error.message : "Pricing agent request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
