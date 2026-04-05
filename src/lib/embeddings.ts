import "server-only";

import { EMBEDDING_MODEL } from "@/lib/ai/client";
import { openai, getOpenAIApiKey } from "@/lib/openai";

/**
 * OpenAI text-embedding-3-small produces 1536-dimensional vectors.
 * Update EMBEDDING_DIMENSIONS if you switch to a different model.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Generate an OpenAI text embedding for the given input string.
 *
 * @throws If OPENAI_API_KEY is not set or the model returns an empty/invalid vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.trim();
  if (input.length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  getOpenAIApiKey();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input
  });

  const vector = response.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("OpenAI returned an empty embedding");
  }
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new Error("OpenAI returned an invalid embedding");
  }

  return vector;
}
