import { InferenceClient } from "@huggingface/inference";
import { z } from "zod";
import { validateJsonRequest } from "@/lib/validate";
import { getServerEnv } from "@/lib/env";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";
import { parseJson } from "@/lib/ai/utils";

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
  const lines = [
    "Create a detailed design concept from these room photos and project constraints.",
    `Room type: ${input.roomType}`,
    `Style preference: ${input.style}`,
    `Budget range: ${input.budget}`,
    `Specific requirements: ${input.requirements || "None provided"}`,
    `Photos provided: ${input.photos.length}`
  ];
  for (const [index, photo] of input.photos.entries()) {
    const trimmed = photo.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      lines.push(`Reference room photo URL ${index + 1}: ${trimmed}`);
    }
  }
  lines.push(
    "Return JSON in the exact shape:",
    "{",
    ' "currentAssessment": "string",',
    ' "designConcept": "string",',
    ' "colourPalette": [{ "name": "string", "hex": "#AABBCC", "usage": "string" }],',
    ' "materialRecommendations": [{ "item": "string", "description": "string", "supplier": "string", "estimatedCost": number }],',
    ' "roomTransformation": "string",',
    ' "estimatedCost": { "low": number, "typical": number, "high": number },',
    ' "nextSteps": ["string"]',
    "}"
  );
  return lines.join("\n");
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const parsed = await validateJsonRequest(request, designAgentRequestSchema, {
      errorMessage: "Invalid design-agent payload"
    });
    if (!parsed.success) {
      return parsed.response;
    }
    const serverEnv = getServerEnv();
    const apiKey = serverEnv.HUGGINGFACE_REFURB_DESIGN_KEY;
    const input = parsed.data;
    const client = new InferenceClient(apiKey);
    const result = await client.chatCompletion({
      model: "meta-llama/Llama-3.3-70B-Instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) }
      ],
      temperature: 0.2
    });
    const rawText = result.choices[0]?.message?.content ?? "";
    if (!rawText) {
      throw new Error("HuggingFace returned an empty design response");
    }
    const json = parseJson(rawText);
    const validated = designAgentResponseSchema.parse(json);
    const normalized = normalizeDesignResponse(validated);
    return jsonSuccess(normalized, requestId);
  } catch (error: unknown) {
    logError("design-agent", requestId, error);
    if (error instanceof z.ZodError) {
      return jsonError(
        "HuggingFace design response validation failed",
        requestId,
        502,
        { details: error.issues.map((issue) => issue.message) }
      );
    }
    const message = error instanceof Error ? error.message : "Design agent request failed";
    return jsonError(message, requestId);
  }
}