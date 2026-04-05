/**
 * Gemini AI client adapter.
 *
 * Exposes a `chat.completions.create` interface that mirrors the OpenAI SDK
 * shape so all existing routes work without modification. Backed exclusively
 * by @google/genai via the shared `getAI()` singleton in src/lib/gemini.ts.
 */
import { getAI } from "@/lib/gemini";
import type { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// Model constants
// ---------------------------------------------------------------------------

/** Default model used by pricing-agent and design-agent routes. */
export const PRICING_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

/** Model used by the photo-estimate route (multimodal vision). */
export const VISION_MODEL =
  process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash";

/** Model used by the assistant/chat route. */
export const ASSISTANT_MODEL =
  process.env.GEMINI_ASSISTANT_MODEL ?? "gemini-2.0-flash";

// ---------------------------------------------------------------------------
// OpenAI-compatible message/response types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildGeminiPrompt(messages: ChatMessage[]): {
  prompt: string;
  inlineImages: Array<{ mimeType: string; data: string }>;
} {
  const parts: string[] = [];
  const inlineImages: Array<{ mimeType: string; data: string }> = [];

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      parts.push(msg.content);
    } else {
      for (const part of msg.content) {
        if (part.type === "text") {
          parts.push(part.text);
        } else if (part.type === "image_url") {
          const url = part.image_url.url;
          const dataMatch = url.match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
          if (dataMatch) {
            inlineImages.push({
              mimeType: dataMatch[1],
              data: dataMatch[2],
            });
          } else {
            parts.push(`[Image URL: ${url}]`);
          }
        }
      }
    }
  }

  return { prompt: parts.join("\n\n"), inlineImages };
}

async function geminiCreate(
  ai: GoogleGenAI,
  request: CompletionRequest
): Promise<CompletionResponse> {
  const { prompt, inlineImages } = buildGeminiPrompt(request.messages);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contents: any[] = [];

  if (inlineImages.length > 0) {
    const imageParts = inlineImages.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.data },
    }));
    contents.push({ role: "user", parts: [{ text: prompt }, ...imageParts] });
  } else {
    contents.push({ role: "user", parts: [{ text: prompt }] });
  }

  const response = await ai.models.generateContent({
    model: request.model,
    contents,
    config: {
      temperature: request.temperature ?? 0.2,
      maxOutputTokens: request.max_tokens ?? 4096,
    },
  });

  const text = response.text ?? "";

  return {
    choices: [
      {
        message: { content: text },
        finish_reason: "stop",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Exported client — duck-typed to OpenAI SDK shape used across routes
// ---------------------------------------------------------------------------

export type AiClientLike = {
  chat: {
    completions: {
      create: (request: CompletionRequest) => Promise<CompletionResponse>;
    };
  };
};

export const aiClient: AiClientLike = {
  chat: {
    completions: {
      create: (request: CompletionRequest): Promise<CompletionResponse> => {
        const ai = getAI();
        return geminiCreate(ai, request);
      },
    },
  },
};
