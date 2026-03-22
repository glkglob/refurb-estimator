import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateJsonRequest } from "@/lib/validate";
import { getServerEnv } from "@/lib/env";

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
  return JSON.parse(stripCodeFences(text));
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

function toGeminiPhotoParts(photos: string[]): Part[] {
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
        text: `Reference room photo URL ${index + 1}: ${trimmed}`
      });
    }
  }

  return photoParts;
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

export async function POST(request: Request) {
  try {
    const parsed = await validateJsonRequest(request, designAgentRequestSchema, {
      errorMessage: "Invalid design-agent payload"
    });

    if (!parsed.success) {
      return parsed.response;
    }

    const serverEnv = getServerEnv();
    const apiKey = serverEnv.GEMINI_DESIGN_API_KEY ?? serverEnv.GEMINI_API_KEY;

    const input = parsed.data;
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: "gemini-1.5-pro",
      systemInstruction: SYSTEM_PROMPT
    });

    const result = await model.generateContent({
      generationConfig: {
        temperature: 0.3,
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
      throw new Error("Gemini returned an empty design response");
    }

    const json = parseJson(rawText);
    const validated = designAgentResponseSchema.parse(json);
    const normalized = normalizeDesignResponse(validated);

    return NextResponse.json(normalized, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Gemini design response validation failed",
          details: error.issues.map((issue) => issue.message)
        },
        { status: 502 }
      );
    }

    const message = error instanceof Error ? error.message : "Design agent request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
