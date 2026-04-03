import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

export function getAI(): GoogleGenAI {
  if (client) return client;

  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "[gemini] GEMINI_API_KEY is not set. " +
      "Add it to .env.local (dev) and project env vars (Vercel) for production."
    );
  }

  client = new GoogleGenAI({ apiKey });
  return client;
}
