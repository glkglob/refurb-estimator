import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const geminiKeyConfigured = isConfigured(process.env.GEMINI_API_KEY);

  const configured = {
    GEMINI_API_KEY: geminiKeyConfigured,
    GEMINI_MODEL: isConfigured(process.env.GEMINI_MODEL),
    GEMINI_VISION_MODEL: isConfigured(process.env.GEMINI_VISION_MODEL),
    GEMINI_DESIGN_MODEL: isConfigured(process.env.GEMINI_DESIGN_MODEL),
  };

  const ok = geminiKeyConfigured;

  return NextResponse.json(
    {
      ok,
      message: ok
        ? "AI environment variables are configured."
        : "Missing GEMINI_API_KEY — all AI features are unavailable.",
      configured,
    },
    { status: ok ? 200 : 503 }
  );
}
