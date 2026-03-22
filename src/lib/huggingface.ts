type HuggingFaceTextGenerationResponse =
  | Array<{ generated_text?: string }>
  | { generated_text?: string; error?: string; estimated_time?: number };

export type HuggingFaceGenerationOptions = {
  token: string;
  model: string;
  prompt: string;
  maxNewTokens?: number;
  temperature?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractGeneratedText(payload: HuggingFaceTextGenerationResponse): string | null {
  if (Array.isArray(payload)) {
    const first = payload[0];
    if (first?.generated_text && typeof first.generated_text === "string") {
      return first.generated_text;
    }
    return null;
  }

  if (payload.generated_text && typeof payload.generated_text === "string") {
    return payload.generated_text;
  }

  return null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.error !== "string" || payload.error.trim().length === 0) {
    return null;
  }

  if (typeof payload.estimated_time === "number") {
    return `${payload.error.trim()} (estimated wait: ${Math.ceil(payload.estimated_time)}s)`;
  }

  return payload.error.trim();
}

export async function generateTextWithHuggingFace(
  options: HuggingFaceGenerationOptions
): Promise<string> {
  const response = await fetch(
    `https://api-inference.huggingface.co/models/${encodeURIComponent(options.model)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: options.prompt,
        parameters: {
          max_new_tokens: options.maxNewTokens ?? 1400,
          temperature: options.temperature ?? 0.2,
          return_full_text: false
        }
      })
    }
  );

  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!response.ok) {
    const apiError = extractErrorMessage(payload);
    throw new Error(
      apiError ?? `Hugging Face inference failed with status ${response.status}`
    );
  }

  const output = extractGeneratedText(payload as HuggingFaceTextGenerationResponse);
  if (!output || output.trim().length === 0) {
    throw new Error("Hugging Face returned an empty text response");
  }

  return output;
}
