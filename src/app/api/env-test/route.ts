import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PricingKeySource = "COST_ESTIMATION_API_KEY" | "HUGGINGFACE_REFURB_PRICING_KEY";
type DesignKeySource = "VISUALISATION_API_KEY" | "HUGGINGFACE_REFURB_DESIGN_KEY";

function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function resolvePricingKeySource(): PricingKeySource | null {
  if (isConfigured(process.env.COST_ESTIMATION_API_KEY)) {
    return "COST_ESTIMATION_API_KEY";
  }
  if (isConfigured(process.env.HUGGINGFACE_REFURB_PRICING_KEY)) {
    return "HUGGINGFACE_REFURB_PRICING_KEY";
  }
  return null;
}

function resolveDesignKeySource(): DesignKeySource | null {
  if (isConfigured(process.env.VISUALISATION_API_KEY)) {
    return "VISUALISATION_API_KEY";
  }
  if (isConfigured(process.env.HUGGINGFACE_REFURB_DESIGN_KEY)) {
    return "HUGGINGFACE_REFURB_DESIGN_KEY";
  }
  return null;
}

export async function GET() {
  const configured = {
    COST_ESTIMATION_API_KEY: isConfigured(process.env.COST_ESTIMATION_API_KEY),
    HUGGINGFACE_REFURB_PRICING_KEY: isConfigured(process.env.HUGGINGFACE_REFURB_PRICING_KEY),
    VISUALISATION_API_KEY: isConfigured(process.env.VISUALISATION_API_KEY),
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
