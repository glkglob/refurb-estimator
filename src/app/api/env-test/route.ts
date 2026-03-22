import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PricingKeySource = "HUGGINGFACE_PRICING_API_KEY";
type DesignKeySource = "HUGGINGFACE_REFURB_DESIGN_KEY";

function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function resolvePricingKeySource(): PricingKeySource | null {
  if (isConfigured(process.env.HUGGINGFACE_PRICING_API_KEY)) {
    return "HUGGINGFACE_PRICING_API_KEY";
  }
  return null;
}

function resolveDesignKeySource(): DesignKeySource | null {
  if (isConfigured(process.env.HUGGINGFACE_REFURB_DESIGN_KEY)) {
    return "HUGGINGFACE_REFURB_DESIGN_KEY";
  }
  return null;
}

export async function GET() {
  const configured = {
    HUGGINGFACE_PRICING_API_KEY: isConfigured(process.env.HUGGINGFACE_PRICING_API_KEY),
    HUGGINGFACE_REFURB_DESIGN_KEY: isConfigured(process.env.HUGGINGFACE_REFURB_DESIGN_KEY),
    OPENAI_API_KEY: isConfigured(process.env.OPENAI_API_KEY)
  };

  const resolved = {
    pricingAgent: resolvePricingKeySource(),
    designAgent: resolveDesignKeySource()
  };

  const ok = Boolean(resolved.pricingAgent && resolved.designAgent);

  return NextResponse.json(
    {
      ok,
      message: ok
        ? "AI environment variables are configured."
        : "Missing Hugging Face API key configuration for one or more agents.",
      configured,
      resolved
    },
    { status: ok ? 200 : 503 }
  );
}
