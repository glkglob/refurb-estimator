/**
 * AI design-metadata generation service.
 *
 * Backed by the shared AI client adapter. The public API accepts an optional
 * dependency-injection client so unit tests can supply a mock without touching
 * environment variables.
 */
import { aiClient as sharedAiClient } from "@/lib/ai/client";
import { createHash } from "crypto";
import { z } from "zod";

const DEFAULT_AI_MODEL = "gpt-4.1-mini";
const DEFAULT_IMAGE_MODEL = "gpt-image-1";
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
  provider: "openai";
  model: string;
  generatedImageUrl?: string;
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
  images?: {
    generate?: (request: {
      model: string;
      prompt: string;
      size?: "1024x1024" | "1024x1536" | "1536x1024";
      n?: number;
    }) => Promise<{
      urls: string[];
      b64Json: string[];
    }>;
  };
};

type GenerateDesignDependencies = {
  client?: AiClientLike;
  model?: string;
  imageModel?: string;
};

type ErrorWithStatus = {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
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

function hasStatus(error: unknown): error is ErrorWithStatus {
  return (
    typeof error === "object" &&
    error !== null &&
    ("status" in error || "statusCode" in error)
  );
}

function toStatusNumber(error: unknown): number | undefined {
  if (!hasStatus(error)) {
    return undefined;
  }

  if (typeof error.status === "number") {
    return error.status;
  }

  if (typeof error.statusCode === "number") {
    return error.statusCode;
  }

  return undefined;
}

function toCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }

  const code = (error as ErrorWithStatus).code;
  return typeof code === "string" ? code.toLowerCase() : undefined;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as ErrorWithStatus).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return "";
}

function isMissingApiKey(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
  return (
    message.includes("openai_api_key") ||
    (message.includes("api key") && message.includes("openai"))
  );
}

function isNetworkError(error: unknown): boolean {
  const message = toErrorMessage(error).toLowerCase();
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

  if (isMissingApiKey(error)) {
    return new AIDesignServiceError(
      "AI service is not configured. Set OPENAI_API_KEY.",
      500
    );
  }

  if (isNetworkError(error)) {
    return new AIDesignServiceError(
      "Network error while contacting AI generation service.",
      503
    );
  }

  const statusCode = toStatusNumber(error);
  const errorCode = toCode(error);

  if (
    statusCode === 404 ||
    toErrorMessage(error).toLowerCase().includes("model not found")
  ) {
    return new AIDesignServiceError(
      "Configured AI model was not found.",
      502
    );
  }

  if (statusCode === 429) {
    return new AIDesignServiceError(
      "AI service rate limit exceeded. Please retry shortly.",
      503
    );
  }

  if (
    errorCode === "invalid_argument" ||
    errorCode === "invalid_request_error" ||
    statusCode === 400
  ) {
    return new AIDesignServiceError(
      "AI provider rejected the request payload.",
      502
    );
  }

  if (statusCode === 401 || statusCode === 403) {
    return new AIDesignServiceError(
      "AI provider authentication failed. Check API key permissions.",
      502
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
    process.env.OPENAI_DESIGN_METADATA_MODEL ??
    process.env.OPENAI_DESIGN_MODEL ??
    process.env.OPENAI_MODEL ??
    DEFAULT_AI_MODEL;
  const imageModel =
    dependencies?.imageModel ??
    process.env.OPENAI_IMAGE_MODEL ??
    DEFAULT_IMAGE_MODEL;

  const client =
    dependencies?.client ?? (sharedAiClient as unknown as AiClientLike);

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

    const resolvedWidth = parsed.data.width ?? request.width ?? DEFAULT_IMAGE_DIMENSION;
    const resolvedHeight = parsed.data.height ?? request.height ?? DEFAULT_IMAGE_DIMENSION;

    let generatedImageUrl: string | undefined;
    if (client.images?.generate) {
      const size: "1024x1024" | "1024x1536" | "1536x1024" =
        resolvedWidth === resolvedHeight
          ? "1024x1024"
          : resolvedWidth > resolvedHeight
            ? "1536x1024"
            : "1024x1536";

      const imageResult = await client.images.generate({
        model: imageModel,
        prompt: parsed.data.prompt,
        size,
        n: 1
      });

      const firstGeneratedUrl = imageResult.urls[0];
      if (typeof firstGeneratedUrl === "string" && firstGeneratedUrl.length > 0) {
        generatedImageUrl = firstGeneratedUrl;
      }
    }

    return {
      prompt: parsed.data.prompt,
      seed: parsed.data.seed ?? createSeed(request.imageUrl, request.user.userId),
      width: resolvedWidth,
      height: resolvedHeight,
      region: request.region,
      provider: "openai",
      model,
      generatedImageUrl,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    throw mapAiError(error);
  }
}
