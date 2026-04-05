import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET() {
  const openAiKeyConfigured = isConfigured(process.env.OPENAI_API_KEY);

  const configured = {
    OPENAI_API_KEY: openAiKeyConfigured,
    USE_OPENAI: isConfigured(process.env.USE_OPENAI),
    OPENAI_MODEL: isConfigured(process.env.OPENAI_MODEL),
    OPENAI_VISION_MODEL: isConfigured(process.env.OPENAI_VISION_MODEL),
    OPENAI_DESIGN_MODEL: isConfigured(process.env.OPENAI_DESIGN_MODEL),
    OPENAI_ASSISTANT_MODEL: isConfigured(process.env.OPENAI_ASSISTANT_MODEL)
  };

  const ok = openAiKeyConfigured;

  return NextResponse.json(
    {
      ok,
      message: ok
        ? "AI environment variables are configured."
        : "Missing OPENAI_API_KEY — all AI features are unavailable.",
      configured,
    },
    { status: ok ? 200 : 503 }
  );
}
