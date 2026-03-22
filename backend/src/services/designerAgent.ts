import { randomUUID } from "node:crypto";

import OpenAI from "openai";
import { z } from "zod";

import type {
  DesignerAgentInput,
  DesignerAgentResponse,
  DesignerMaterialsItem,
  DesignerStyleVariant
} from "../../../shared/designerTypes";

const backendEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_DESIGNER_MODEL: z.string().min(1).default("gpt-4.1")
});

function getBackendEnv() {
  const result = backendEnvSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_DESIGNER_MODEL: process.env.OPENAI_DESIGNER_MODEL
  });

  if (!result.success) {
    const messages = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Missing or invalid environment variables:\n${messages}`);
  }

  return result.data;
}

const materialsItemSchema = z.object({
  category: z.enum(["walls", "floor", "ceiling", "lighting", "furniture", "joinery", "other"]),
  description: z.string().trim().min(1),
  cost_band: z.enum(["low", "medium", "high"])
});

const styleVariantSchema = z.object({
  style_key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1),
  render_image_url: z.string().trim().min(1),
  materials_spec: z.array(materialsItemSchema).min(3).max(16)
});

const designerAgentResponseSchema = z.object({
  room_id: z.string().trim().min(1),
  room_type: z.string().trim().min(1),
  approx_room_area_m2: z.number().positive().max(10_000),
  room_summary: z.string().trim().min(1),
  condition: z.enum(["good", "fair", "poor"]),
  issues: z.array(z.string().trim().min(1)).max(20),
  style_variants: z.array(styleVariantSchema).min(3).max(4)
});

const DESIGNER_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "room_id",
    "room_type",
    "approx_room_area_m2",
    "room_summary",
    "condition",
    "issues",
    "style_variants"
  ],
  properties: {
    room_id: { type: "string", minLength: 1 },
    room_type: { type: "string", minLength: 1 },
    approx_room_area_m2: { type: "number", minimum: 1, maximum: 10000 },
    room_summary: { type: "string", minLength: 1 },
    condition: { type: "string", enum: ["good", "fair", "poor"] },
    issues: {
      type: "array",
      items: { type: "string", minLength: 1 },
      maxItems: 20
    },
    style_variants: {
      type: "array",
      minItems: 3,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["style_key", "label", "description", "render_image_url", "materials_spec"],
        properties: {
          style_key: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          description: { type: "string", minLength: 1 },
          render_image_url: { type: "string", minLength: 1 },
          materials_spec: {
            type: "array",
            minItems: 3,
            maxItems: 16,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["category", "description", "cost_band"],
              properties: {
                category: {
                  type: "string",
                  enum: ["walls", "floor", "ceiling", "lighting", "furniture", "joinery", "other"]
                },
                description: { type: "string", minLength: 1 },
                cost_band: { type: "string", enum: ["low", "medium", "high"] }
              }
            }
          }
        }
      }
    }
  }
} as const;

const SYSTEM_PROMPT = `You are a chartered architect and interior designer for UK residential refurbishments.
You must analyse room photos and produce practical design options suitable for renovation planning.

Rules:
- Return JSON only. No markdown and no commentary.
- Output must follow the schema exactly.
- Provide 3 or 4 style variants that are materially different.
- Each style variant must include a realistic materials_spec that can be used to estimate refurbishment costs.
- Keep room_summary concise (max 2 short sentences).
- issues should be specific, objective room concerns from visible condition.
- If unsure about any detail, make conservative assumptions and state likely constraints in issues.
- render_image_url may reuse one of the provided image URLs when no generated render is available.
- Use UK spelling and practical renovation language.`;

function buildUserPrompt(input: DesignerAgentInput): string {
  return [
    "Analyse this room and return a deterministic JSON design brief.",
    `property_size_m2: ${input.propertySizeM2}`,
    `room_type: ${input.roomType}`,
    `target_spec: ${input.targetSpec}`,
    `preferred_style_tags: ${input.preferredStyles || "none"}`
  ].join("\n");
}

function sanitizeMaterialsSpec(items: DesignerMaterialsItem[]): DesignerMaterialsItem[] {
  return items.map((item) => ({
    category: item.category,
    description: item.description.trim(),
    cost_band: item.cost_band
  }));
}

function fallbackRenderUrl(input: DesignerAgentInput, variantIndex: number): string {
  const sourceUrl = input.imageUrls[variantIndex % input.imageUrls.length];
  if (sourceUrl) {
    return sourceUrl;
  }

  return `https://cdn.example.com/designer-renders/${randomUUID()}.jpg`;
}

function normalizeVariants(
  variants: DesignerStyleVariant[],
  input: DesignerAgentInput
): DesignerStyleVariant[] {
  return variants.map((variant, index) => ({
    style_key: variant.style_key.trim(),
    label: variant.label.trim(),
    description: variant.description.trim(),
    render_image_url: variant.render_image_url.trim() || fallbackRenderUrl(input, index),
    materials_spec: sanitizeMaterialsSpec(variant.materials_spec)
  }));
}

function normalizeResponse(
  response: DesignerAgentResponse,
  input: DesignerAgentInput
): DesignerAgentResponse {
  return {
    room_id: response.room_id.trim() || randomUUID(),
    room_type: response.room_type.trim() || input.roomType,
    approx_room_area_m2:
      Number.isFinite(response.approx_room_area_m2) && response.approx_room_area_m2 > 0
        ? response.approx_room_area_m2
        : input.propertySizeM2,
    room_summary: response.room_summary.trim(),
    condition: response.condition,
    issues: response.issues.map((issue) => issue.trim()).filter((issue) => issue.length > 0),
    style_variants: normalizeVariants(response.style_variants, input)
  };
}

export async function callDesignerAgent(input: DesignerAgentInput): Promise<DesignerAgentResponse> {
  const env = getBackendEnv();

  if (input.imageUrls.length === 0) {
    throw new Error("At least one image URL is required");
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const model = env.OPENAI_DESIGNER_MODEL;

  const userContent: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    { type: "text", text: buildUserPrompt(input) },
    ...input.imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } }))
  ];

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0,
    max_tokens: 1800,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "designer_agent_response",
        strict: true,
        schema: DESIGNER_RESPONSE_JSON_SCHEMA
      }
    },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent }
    ]
  });

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error("Designer agent returned an empty response");
  }

  const parsedResponse: unknown = JSON.parse(rawContent);
  const validatedResponse = designerAgentResponseSchema.parse(parsedResponse);
  return normalizeResponse(validatedResponse, input);
}
