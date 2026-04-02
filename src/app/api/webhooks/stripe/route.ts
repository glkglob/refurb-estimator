import { NextResponse } from "next/server";

import { processStripeWebhookRequest } from "@/services/stripeWebhook";
import { STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";

export const runtime = "nodejs";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    return jsonError("STRIPE_WEBHOOK_SECRET is not configured", 500);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return jsonError("Missing stripe-signature header", 400);
  }

  const payload = await request.text();

  try {
    await processStripeWebhookRequest(payload, signature, {
      webhookSecret: STRIPE_WEBHOOK_SECRET,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid webhook signature") {
      return jsonError("Invalid webhook signature", 400);
    }

    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return jsonError(message, 500);
  }
}
