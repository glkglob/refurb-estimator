import OpenAI from "openai";

function normalizeBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }

  return fallback;
}

export function isOpenAIEnabled(): boolean {
  return normalizeBoolean(process.env.USE_OPENAI, true);
}

export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "[openai] OPENAI_API_KEY is not set. " +
      "Add it to .env.local (dev) and project env vars (staging/production)."
    );
  }

  return key;
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing-openai-api-key",
  dangerouslyAllowBrowser: process.env.NODE_ENV === "test"
});
