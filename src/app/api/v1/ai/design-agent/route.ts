import { z } from "zod";
import { NextResponse } from "next/server";
import { generateTextWithHuggingFace } from "@/lib/huggingface";
import { validateJsonRequest } from "@/lib/validate";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const designAgentRequestSchema = z.object({
  photos: z.array(z.string().trim().min(1)).min(1).max(5),
  roomType: z.enum([
    "Living Room",
    "Kitchen",
    "Bathroom",
    "Bedroom",
    "Hallway",
    "Other"
  ]),
  style: z.enum([
    "Modern",
    "Contemporary",
    "Traditional",
    "Industrial",
    "Scandinavian",
    "Maximalist"
  ]),
  budget: z.enum(["Under £5k", "£5k-£15k", "£15k-£30k", "£30k-£50k", "£50k+"]),
  requirements: z.string().trim().max(4000).default("")
});

const colourPaletteItemSchema = z.object({
  name: z.string().trim().min(1),
  hex: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
  usage: z.string().trim().min(1)
});

const materialRecommendationSchema = z.object({
  item: z.string().trim().min(1),
  description: z.string().trim().min(1),
  supplier: z.string().trim().min(1),
  estimatedCost: z.number().nonnegative()
});

const designAgentResponseSchema = z.object({
  currentAssessment: z.string().trim().min(1),
  designConcept: z.string().trim().min(1),
  colourPalette: z.array(colourPaletteItemSchema).min(3).max(8),
  materialRecommendations: z.array(materialRecommendationSchema).min(3).max(20),
  roomTransformation: z.string().trim().min(1),
  estimatedCost: z.object({
    low: z.number().nonnegative(),
    typical: z.number().nonnegative(),
    high: z.number().nonnegative()
  }),
  nextSteps: z.array(z.string().trim().min(1)).min(3).max(10)
});

type DesignAgentRequest = z.infer<typeof designAgentRequestSchema>;
type DesignAgentResponse = z.infer<typeof designAgentResponseSchema>;

const SYSTEM_PROMPT = `You are an expert interior designer and property renovation specialist. Analyse the provided photos and create detailed design recommendations. Describe the transformed space vividly including colours, materials, fixtures, furniture layout. Provide a mood board description and specific product recommendations with approximate costs. Focus on UK market products and suppliers.

Rules:
- Return only valid JSON, no markdown.
- Be explicit, practical, and renovation-ready.
- estimatedCost values must be GBP numbers (no currency symbols), with low <= typical <= high.
- Include supplier names commonly available in the UK where possible.
- Use realistic product/material costs for 2024-2025 UK pricing.
- Keep nextSteps actionable and sequential.`;

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
    throw new Error("AI design response did not contain valid JSON");
  }
}

function normalizeHex(value: string): string {
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return withHash.toUpperCase();
}

function normalizeDesignResponse(payload: DesignAgentResponse): DesignAgentResponse {
  const low = Math.round(
    Math.min(payload.estimatedCost.low, payload.estimatedCost.typical, payload.estimatedCost.high)
  );
  const high = Math.round(
    Math.max(payload.estimatedCost.low, payload.estimatedCost.typical, payload.estimatedCost.high)
  );
  const typical = Math.round(Math.min(high, Math.max(low, payload.estimatedCost.typical)));

  return {
    ...payload,
    colourPalette: payload.colourPalette.map((item) => ({
      ...item,
      hex: normalizeHex(item.hex)
    })),
    materialRecommendations: payload.materialRecommendations.map((item) => ({
      ...item,
      estimatedCost: Math.round(item.estimatedCost)
    })),
    estimatedCost: {
      low,
      typical,
      high
    },
    nextSteps: payload.nextSteps.map((step) => step.trim()).filter(Boolean)
  };
}

function buildUserPrompt(input: DesignAgentRequest): string {
  return [
    "Create a detailed design concept from these room photos and project constraints.",
    `Room type: ${input.roomType}`,
    `Style preference: ${input.style}`,
    `Budget range: ${input.budget}`,
    `Specific requirements: ${input.requirements || "None provided"}`,
    `Photos provided: ${input.photos.length}`,
    "Return JSON in the exact shape:",
    "{",
    '  "currentAssessment": "string",',
    '  "designConcept": "string",',
    '  "colourPalette": [{ "name": "string", "hex": "#AABBCC", "usage": "string" }],',
    '  "materialRecommendations": [{ "item": "string", "description": "string", "supplier": "string", "estimatedCost": number }],',
    '  "roomTransformation": "string",',
    '  "estimatedCost": { "low": number, "typical": number, "high": number },',
    '  "nextSteps": ["string"]',
    "}"
  ].join("\n");
}

function summarizePhotosForTextModel(photos: string[]): string {
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

async function generateDesignWithHuggingFace(
  token: string,
  input: DesignAgentRequest
): Promise<string> {
  const model = process.env.HUGGINGFACE_DESIGN_MODEL ?? "mistralai/Mistral-7B-Instruct-v0.3";
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
    const parsed = await validateJsonRequest(request, designAgentRequestSchema, {
      errorMessage: "Invalid design-agent payload"
    });

    if (!parsed.success) {
      return parsed.response;
    }

    const huggingFaceToken =
      process.env.VISUALISATION_API_KEY ?? process.env.HUGGINGFACE_REFURB_DESIGN_KEY;

    if (!huggingFaceToken) {
      return NextResponse.json(
        { error: "VISUALISATION_API_KEY or HUGGINGFACE_REFURB_DESIGN_KEY is not configured" },
        { status: 500 }
      );
    }

    const input = parsed.data;
    const rawText = await generateDesignWithHuggingFace(huggingFaceToken, input);

    const json = parseJson(rawText);
    const validated = designAgentResponseSchema.parse(json);
    const normalized = normalizeDesignResponse(validated);

    return NextResponse.json(normalized, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Design response validation failed",
          details: error.issues.map((issue) => issue.message)
        },
        { status: 502 }
      );
    }

    const message = error instanceof Error ? error.message : "Design agent request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
