import OpenAI from "openai";

const isLmStudio = process.env.AI_PROVIDER === "lmstudio";

export const aiClient = new OpenAI({
  baseURL: isLmStudio
    ? (process.env.LM_STUDIO_BASE_URL ?? "http://127.0.0.1:1234/v1")
    : "https://api.openai.com/v1",
  apiKey: isLmStudio ? "lm-studio" : (process.env.OPENAI_API_KEY ?? ""),
});

export const PRICING_MODEL = isLmStudio
  ? (process.env.LM_STUDIO_MODEL ?? "qwen/qwen3-4b")
  : "gpt-4o-mini";
