import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRole } from "@/lib/rbac";
import { getPriceIdForPlan, getStripeClient } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const checkoutRequestSchema = z.object({
  plan: z.enum(["free", "pro", "agency"]),
  period: z.enum(["monthly", "annual"]),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getOrigin(request: Request): string {
  const headerOrigin = request.headers.get("origin");
  if (headerOrigin && headerOrigin.trim().length > 0) {
    return headerOrigin;
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const rawBody: unknown = await request.json();
    const parsedBody = checkoutRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return jsonError("Invalid checkout payload", 400);
    }

    const { plan, period } = parsedBody.data;
    const priceId = getPriceIdForPlan(plan, period);

    if (!priceId) {
      return jsonError("No Stripe price configured for selected plan/period", 400);
    }

    const supabase = await createServerSupabaseClient();
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<{ stripe_customer_id: string | null }>();

    if (profileError) {
      return jsonError(`Failed to load profile: ${profileError.message}`, 500);
    }

    const origin = getOrigin(request);
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: user.id,
      success_url: `${origin}/pricing?checkout=success`,
      cancel_url: `${origin}/pricing?checkout=cancelled`,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      metadata: {
        userId: user.id,
        plan,
        period,
      },
      ...(profileData?.stripe_customer_id
        ? { customer: profileData.stripe_customer_id }
        : user.email
          ? { customer_email: user.email }
          : {}),
    });

    if (!session.url) {
      return jsonError("Failed to create checkout session URL", 500);
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return jsonError(message, 500);
  }
}
