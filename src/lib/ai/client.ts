import {
  createCompletionWithOpenAI,
  generateImageWithOpenAI
} from "@/lib/ai/adapter";

/** Default model used by pricing and design routes. */
export const PRICING_MODEL =
  process.env.OPENAI_PRICING_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-4o-mini";

/** Model used by the design-agent route. */
export const DESIGN_MODEL =
  process.env.OPENAI_DESIGN_MODEL ??
  process.env.OPENAI_MODEL ??
  PRICING_MODEL;

/** Model used by the photo-estimate route (vision-capable). */
export const VISION_MODEL =
  process.env.OPENAI_VISION_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-4o-mini";

/** Model used by the assistant/chat route. */
export const ASSISTANT_MODEL =
  process.env.OPENAI_ASSISTANT_MODEL ??
  process.env.OPENAI_MODEL ??
  "gpt-4o-mini";

/** Model used by AI design image generation endpoints. */
export const IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";

/** Model used by embeddings. */
export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export type MessageRole = "system" | "user" | "assistant";

export type TextContentPart = { type: "text"; text: string };
export type ImageUrlContentPart = {
  type: "image_url";
  image_url: { url: string };
};
export type ContentPart = TextContentPart | ImageUrlContentPart;

export type ChatMessage = {
  role: MessageRole;
  content: string | ContentPart[];
};

export type CompletionRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: false;
  response_format?: { type: "json_object" | "text" };
};

export type CompletionChoice = {
  message: { content: string | null };
  finish_reason?: string;
};

export type CompletionResponse = {
  choices: CompletionChoice[];
};

export type ImageGenerationRequest = {
  model: string;
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
  n?: number;
};

export type AiImageResponse = {
  urls: string[];
  b64Json: string[];
};

export type AiClientLike = {
  chat: {
    completions: {
      create: (request: CompletionRequest) => Promise<CompletionResponse>;
    };
  };
  images: {
    generate: (request: ImageGenerationRequest) => Promise<AiImageResponse>;
  };
};

export const aiClient: AiClientLike = {
  chat: {
    completions: {
      create: (request: CompletionRequest): Promise<CompletionResponse> =>
        createCompletionWithOpenAI(request)
    }
  },
  images: {
    generate: (request: ImageGenerationRequest): Promise<AiImageResponse> =>
      generateImageWithOpenAI(request)
  }
};
