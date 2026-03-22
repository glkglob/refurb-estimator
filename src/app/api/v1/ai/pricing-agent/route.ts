import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateJsonRequest } from "@/lib/validate";
import { getServerEnv } from "@/lib/env";

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
  return JSON.parse(stripCodeFences(text));
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

function toGeminiPhotoParts(photos: string[] | undefined): Part[] {
  if (!photos || photos.length === 0) {
    return [];
  }

  const photoParts: Part[] = [];

  for (const [index, photo] of photos.entries()) {
    const trimmed = photo.trim();
    const dataUrlMatch = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (dataUrlMatch) {
      const mimeType = dataUrlMatch[1];
      const data = dataUrlMatch[2]?.replace(/\s/g, "");
      if (data) {
        photoParts.push({
          inlineData: {
            mimeType,
            data
          }
        });
      }
      continue;
    }

    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      photoParts.push({
        text: `Reference photo URL ${index + 1}: ${trimmed}`
      });
    }
  }

  return photoParts;
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

export async function POST(request: Request) {
  try {
    const parsed = await validateJsonRequest(request, pricingAgentRequestSchema, {
      errorMessage: "Invalid pricing-agent payload"
    });

    if (!parsed.success) {
      return parsed.response;
    }

    const serverEnv = getServerEnv();
    const apiKey = serverEnv.GEMINI_PRICING_API_KEY ?? serverEnv.GEMINI_API_KEY;

    const input = parsed.data;
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContent({
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildUserPrompt(input) }, ...toGeminiPhotoParts(input.photos)]
        }
      ]
    });

    const rawText = result.response.text();
    if (!rawText) {
      throw new Error("Gemini returned an empty pricing response");
    }

    const json = parseJson(rawText);
    const validated = pricingAgentResponseSchema.parse(json);
    const normalized = normalizePricingResponse(validated);

    return NextResponse.json(normalized, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Gemini pricing response validation failed",
          details: error.issues.map((issue) => issue.message)
        },
        { status: 502 }
      );
    }

    const message = error instanceof Error ? error.message : "Pricing agent request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
