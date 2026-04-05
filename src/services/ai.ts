/**
 * AI design-metadata generation service.
 *
 * Backed by Google Gemini via the shared getAI() singleton. The public API
 * accepts an optional dependency-injection client so unit tests can supply a
 * mock without touching environment variables.
 */
import { getAI } from "@/lib/gemini";
import { createHash } from "crypto";
import { z } from "zod";

const DEFAULT_AI_MODEL = "gemini-2.0-flash";
const DEFAULT_IMAGE_DIMENSION = 1024;

const aiResponseSchema = z.object({
  prompt: z.string().trim().min(20).max(4000),
  seed: z.number().int().nonnegative().max(2147483647).optional(),
  width: z.number().int().min(256).max(2048).optional(),
  height: z.number().int().min(256).max(2048).optional(),
});

export type DesignProjectType = "loft" | "new_build";

export type AIDesignUserMetadata = {
  userId: string;
  email: string;
  role: string;
};

export type GenerateDesignRequest = {
  imageUrl: string;
  region: string;
  projectType: DesignProjectType;
  promptHint?: string;
  width?: number;
  height?: number;
  user: AIDesignUserMetadata;
};

export type GenerateDesignResult = {
  prompt: string;
  seed: number;
  width: number;
  height: number;
  region: string;
  provider: "gemini";
  model: string;
  createdAt: string;
};

type CompletionRequest = {
  model: string;
  temperature: number;
  response_format: { type: "json_object" };
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>;
};

type CompletionChoice = {
  message?: {
    content?: string | null;
  };
};

type CompletionResponse = {
  choices: CompletionChoice[];
};

export type AiClientLike = {
  chat: {
    completions: {
      create: (request: CompletionRequest) => Promise<CompletionResponse>;
    };
  };
};

type GenerateDesignDependencies = {
  client?: AiClientLike;
  model?: string;
};

type ErrorWithStatus = {
  status?: unknown;
  message?: unknown;
};

/**
 * Represents an AI provider error with a mapped HTTP status code.
 */
export class AIDesignServiceError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AIDesignServiceError";
    this.statusCode = statusCode;
  }
}

/**
 * Build a Gemini-backed AiClientLike from the shared singleton.
 * Only called when no client is injected (i.e., in production).
 */
function createGeminiClient(): AiClientLike {
  const ai = getAI(); // throws if GEMINI_API_KEY is unset

  return {
    chat: {
      completions: {
        create: async (request: CompletionRequest): Promise<CompletionResponse> => {
          const prompt = request.messages.map((m) => m.content).join("\n\n");

          const response = await ai.models.generateContent({
            model: request.model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              temperature: request.temperature,
              maxOutputTokens: 1024,
            },
          });

          return {
            choices: [
              {
                message: { content: response.text ?? "" },
              },
            ],
          };
        },
      },
    },
  };
}

function hasStatus(error: unknown): error is ErrorWithStatus {
  return typeof error === "object" && error !== null && "status" in error;
}

function toStatusNumber(error: unknown): number | undefined {
  if (!hasStatus(error) || typeof error.status !== "number") {
    return undefined;
  }

  return error.status;
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("econn") ||
    message.includes("etimedout") ||
    message.includes("enotfound")
  );
}

function mapAiError(error: unknown): AIDesignServiceError {
  if (error instanceof AIDesignServiceError) {
    return error;
  }

  if (isNetworkError(error)) {
    return new AIDesignServiceError(
      "Network error while contacting AI generation service.",
      503
    );
  }

  const statusCode = toStatusNumber(error);
  if (statusCode === 429) {
    return new AIDesignServiceError(
      "AI service rate limit exceeded. Please retry shortly.",
      503
    );
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    return new AIDesignServiceError(
      "AI provider is currently unavailable.",
      503
    );
  }

  if (error instanceof Error) {
    return new AIDesignServiceError(error.message, 502);
  }

  return new AIDesignServiceError("AI design generation failed.", 502);
}

function createSeed(imageUrl: string, userId: string): number {
  const hash = createHash("sha256")
    .update(`${imageUrl}:${userId}`)
    .digest("hex")
    .slice(0, 8);

  return Number.parseInt(hash, 16);
}

function buildUserPrompt(request: GenerateDesignRequest): string {
  return [
    "Create a practical UK refurbishment design generation plan from the provided image.",
    `Image URL: ${request.imageUrl}`,
    `Project type: ${request.projectType}`,
    `Region: ${request.region}`,
    `User role: ${request.user.role}`,
    `User email: ${request.user.email}`,
    `Prompt hint: ${request.promptHint?.trim() || "none"}`,
    `Requested dimensions: ${request.width ?? DEFAULT_IMAGE_DIMENSION}x${request.height ?? DEFAULT_IMAGE_DIMENSION}`,
    "Return JSON only in this schema:",
    '{"prompt":"string","seed":12345,"width":1024,"height":1024}'
  ].join("\n");
}

/**
 * Generates structured design metadata from an uploaded image URL and user context.
 */
export async function generateDesign(
  request: GenerateDesignRequest,
  dependencies?: GenerateDesignDependencies
): Promise<GenerateDesignResult> {
  const model =
    dependencies?.model ??
    process.env.GEMINI_DESIGN_MODEL ??
    DEFAULT_AI_MODEL;

  let client: AiClientLike;
  if (dependencies?.client) {
    client = dependencies.client;
  } else {
    try {
      client = createGeminiClient();
    } catch (err) {
      // getAI() throws a plain Error when GEMINI_API_KEY is absent
      throw new AIDesignServiceError(
        err instanceof Error ? err.message : "GEMINI_API_KEY is not configured.",
        500
      );
    }
  }

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an AI design orchestration service. Return strict JSON only for downstream persistence."
        },
        {
          role: "user",
          content: buildUserPrompt(request)
        }
      ]
    });

    const content = response.choices[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new AIDesignServiceError("AI provider returned an empty response.", 502);
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(content);
    } catch {
      throw new AIDesignServiceError("AI provider returned invalid JSON.", 502);
    }

    const parsed = aiResponseSchema.safeParse(parsedContent);
    if (!parsed.success) {
      throw new AIDesignServiceError(
        "AI provider response did not match the expected design schema.",
        502
      );
    }

    return {
      prompt: parsed.data.prompt,
      seed: parsed.data.seed ?? createSeed(request.imageUrl, request.user.userId),
      width: parsed.data.width ?? request.width ?? DEFAULT_IMAGE_DIMENSION,
      height: parsed.data.height ?? request.height ?? DEFAULT_IMAGE_DIMENSION,
      region: request.region,
      provider: "gemini",
      model,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    throw mapAiError(error);
  }
}
