import { z } from "zod";
import { validateJsonRequest } from "@/lib/validate";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";
import { parseJson } from "@/lib/ai/utils";
import { aiClient, PRICING_MODEL } from "@/lib/ai/client";

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

function clampTypical(low: number, typical: number, high: number): number {
  return Math.min(high, Math.max(low, typical));
}

function normalizePricingResponse(payload: PricingAgentResponse): PricingAgentResponse {
  const categories = payload.categories.map((category) => {
    const low = Math.round(Math.min(category.low, category.typical, category.high));
    const high = Math.round(Math.max(category.low, category.typical, category.high));
    const typical = Math.round(clampTypical(low, category.typical, high));
    return { ...category, low, typical, high };
  });
  const totalLow = categories.reduce((sum, c) => sum + c.low, 0);
  const totalTypical = categories.reduce((sum, c) => sum + c.typical, 0);
  const totalHigh = categories.reduce((sum, c) => sum + c.high, 0);
  return { summary: payload.summary.trim(), advice: payload.advice.trim(), categories, totalLow, totalTypical, totalHigh };
}

function buildUserPrompt(input: PricingAgentRequest): string {
  const lines = [
    "Generate a UK refurbishment pricing estimate using the provided project inputs.",
    `Property type: ${input.propertyType}`,
    `Location/postcode: ${input.location}`,
    `Floor area (m²): ${input.floorAreaM2}`,
    `Current condition: ${input.condition}`,
    `Renovation scope: ${input.scope}`,
    `Photos provided: ${input.photos?.length ?? 0}`
  ];
  if (input.photos && input.photos.length > 0) {
    for (const [index, photo] of input.photos.entries()) {
      const trimmed = photo.trim();
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        lines.push(`Reference photo URL ${index + 1}: ${trimmed}`);
      }
    }
  }
  lines.push("Return JSON in the exact shape:", "{", '  "summary": "string",', '  "categories": [{ "name": "string", "low": number, "typical": number, "high": number, "notes": "string" }],', '  "totalLow": number,', '  "totalTypical": number,', '  "totalHigh": number,', '  "advice": "string"', "}");
  return lines.join("\n");
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const parsed = await validateJsonRequest(request, pricingAgentRequestSchema, {
      errorMessage: "Invalid pricing-agent payload"
    });
    if (!parsed.success) return parsed.response;

    const input = parsed.data;

    const result = await aiClient.chat.completions.create({
      model: PRICING_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) }
      ],
      temperature: 0.2,
      stream: false
    });

    const rawText = result.choices[0]?.message?.content ?? "";
    if (!rawText) throw new Error("AI returned an empty pricing response");

    const json = parseJson(rawText);
    const validated = pricingAgentResponseSchema.parse(json);
    const normalized = normalizePricingResponse(validated);
    return jsonSuccess(normalized, requestId);

  } catch (error: unknown) {
    logError("pricing-agent", requestId, error);
    if (error instanceof z.ZodError) {
      return jsonError("Pricing response validation failed", requestId, 502, { details: error.issues.map((i) => i.message) });
    }
    const message = error instanceof Error ? error.message : "Pricing agent request failed";
    return jsonError(message, requestId);
  }
}
