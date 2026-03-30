import { NextResponse } from "next/server";

import { requireRole } from "@/lib/rbac";
import { getStripeClient } from "@/lib/stripe";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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

    const supabase = await createServerSupabaseClient();
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle<{ stripe_customer_id: string | null }>();

    if (profileError) {
      return jsonError(`Failed to load profile: ${profileError.message}`, 500);
    }

    const customerId = profileData?.stripe_customer_id;
    if (!customerId) {
      return jsonError("No Stripe customer found for this account", 400);
    }

    const stripe = getStripeClient();
    const origin = getOrigin(request);

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create portal session";
    return jsonError(message, 500);
  }
}
