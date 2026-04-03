import "server-only";

import { getAI } from "@/lib/gemini";

/**
 * Gemini text-embedding-004 produces 768-dimensional vectors.
 * Update EMBEDDING_DIMENSIONS if you switch to a different model.
 */
const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIMENSIONS = 768;

/**
 * Generate a Gemini text embedding for the given input string.
 *
 * @throws If GEMINI_API_KEY is not set or the model returns an empty/invalid vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const input = text.trim();
  if (input.length === 0) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const ai = getAI(); // throws if GEMINI_API_KEY is unset

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: input,
  });

  const vector = response.embedding?.values;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error("Gemini returned an empty embedding");
  }
  if (vector.some((value) => !Number.isFinite(value))) {
    throw new Error("Gemini returned an invalid embedding");
  }

  return vector;
}
