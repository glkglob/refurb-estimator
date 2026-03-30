import "server-only";

import { aiClient } from "@/lib/ai/client";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export { EMBEDDING_DIMENSIONS };

function ensureEmbeddingsConfigured(): void {
  if (process.env.AI_PROVIDER === "lmstudio") {
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.trim();
  if (input.length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  ensureEmbeddingsConfigured();

  const response = await aiClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input,
  });

  const vector = response.data[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("OpenAI returned an empty embedding");
  }
  if (
    vector.length !== EMBEDDING_DIMENSIONS ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("OpenAI returned an invalid embedding");
  }

  return vector;
}
