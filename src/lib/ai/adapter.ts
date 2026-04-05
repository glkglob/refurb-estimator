import type OpenAI from "openai";
import { getOpenAIApiKey, isOpenAIEnabled, openai } from "@/lib/openai";
import type {
  AiImageResponse,
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  ContentPart,
  ImageGenerationRequest
} from "@/lib/ai/client";

type OpenAIMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
};

function toOpenAIContentPart(part: ContentPart) {
  if (part.type === "text") {
    return { type: "text" as const, text: part.text };
  }

  return {
    type: "image_url" as const,
    image_url: { url: part.image_url.url }
  };
}

function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
  return messages.map((message) => {
    if (typeof message.content === "string") {
      return {
        role: message.role,
        content: message.content
      };
    }

    return {
      role: message.role,
      content: message.content.map(toOpenAIContentPart)
    };
  });
}

function extractTextContent(content: unknown): string | null {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const textParts = content
    .map((part) => {
      if (
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        (part as { type?: unknown }).type === "text" &&
        "text" in part &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }

      return "";
    })
    .filter((part) => part.length > 0);

  return textParts.length > 0 ? textParts.join("\n") : null;
}

function assertOpenAIEnabled(): void {
  if (!isOpenAIEnabled()) {
    throw new Error("OpenAI provider is disabled via USE_OPENAI feature flag.");
  }

  getOpenAIApiKey();
}

export async function createCompletionWithOpenAI(
  request: CompletionRequest,
  client: OpenAI = openai
): Promise<CompletionResponse> {
  assertOpenAIEnabled();

  const completion = await client.chat.completions.create({
    model: request.model,
    messages: toOpenAIMessages(request.messages) as never,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    stream: false,
    ...(request.response_format?.type === "json_object"
      ? { response_format: { type: "json_object" as const } }
      : {})
  });

  const choices = (completion.choices ?? []).map((choice) => {
    const content = extractTextContent(choice.message?.content ?? null);

    return {
      message: {
        content
      },
      finish_reason:
        typeof choice.finish_reason === "string"
          ? choice.finish_reason
          : undefined
    };
  });

  return {
    choices
  };
}

function normalizeImageCount(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(4, Math.round(value as number)));
}

export async function generateImageWithOpenAI(
  request: ImageGenerationRequest,
  client: OpenAI = openai
): Promise<AiImageResponse> {
  assertOpenAIEnabled();

  const response = await client.images.generate({
    model: request.model,
    prompt: request.prompt,
    size: request.size,
    n: normalizeImageCount(request.n)
  } as never);

  const data = Array.isArray(response.data) ? response.data : [];
  return {
    urls: data
      .map((item) => item.url)
      .filter((url): url is string => typeof url === "string" && url.length > 0),
    b64Json: data
      .map((item) => item.b64_json)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  };
}
