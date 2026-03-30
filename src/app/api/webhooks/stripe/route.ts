import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { PLANS, type Plan, type PlanPeriod } from "@/lib/plans";
import {
  STRIPE_WEBHOOK_SECRET,
  getPlanFromPriceId,
  getStripeClient,
} from "@/lib/stripe";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type ProfilePlanUpdate = {
  plan: Plan;
  plan_period: PlanPeriod | null;
  plan_expires_at: string | null;
  stripe_customer_id?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function toIsoFromUnix(unixTimestamp: number | null | undefined): string | null {
  if (!unixTimestamp || !Number.isFinite(unixTimestamp)) {
    return null;
  }

  return new Date(unixTimestamp * 1000).toISOString();
}

function getPlanPeriodFromPriceId(priceId: string): PlanPeriod | null {
  for (const plan of Object.keys(PLANS) as Plan[]) {
    if (PLANS[plan].stripePriceIds.monthly === priceId) {
      return "monthly";
    }

    if (PLANS[plan].stripePriceIds.annual === priceId) {
      return "annual";
    }
  }

  return null;
}

function getPlanSelectionFromSubscription(subscription: Stripe.Subscription): {
  plan: Plan;
  period: PlanPeriod;
} | null {
  for (const item of subscription.items.data) {
    const priceId = item.price?.id;
    if (!priceId) {
      continue;
    }

    const plan = getPlanFromPriceId(priceId);
    const period = getPlanPeriodFromPriceId(priceId);

    if (plan && period) {
      return { plan, period };
    }
  }

  return null;
}

function getSubscriptionCurrentPeriodEnd(
  subscription: Stripe.Subscription,
): number | null {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return typeof periodEnd === "number" && Number.isFinite(periodEnd) ? periodEnd : null;
}

async function updateProfilePlanByUserId(
  userId: string,
  update: ProfilePlanUpdate,
): Promise<void> {
  const supabaseAdmin = createAdminSupabaseClient();
  const payload = { ...update, updated_at: new Date().toISOString() };

  const { error } = await supabaseAdmin.from("profiles").update(payload).eq("id", userId);

  if (error) {
    throw new Error(`Failed to update profile by user ID: ${error.message}`);
  }
}

async function updateProfilePlanByCustomerId(
  customerId: string,
  update: Omit<ProfilePlanUpdate, "stripe_customer_id">,
): Promise<void> {
  const supabaseAdmin = createAdminSupabaseClient();
  const payload = { ...update, updated_at: new Date().toISOString() };

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(payload)
    .eq("stripe_customer_id", customerId);

  if (error) {
    throw new Error(`Failed to update profile by customer ID: ${error.message}`);
  }
}

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;

  if (!userId && !customerId) {
    return;
  }

  let plan: Plan = "free";
  let period: PlanPeriod | null = null;
  let expiresAt: string | null = null;

  if (subscriptionId) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const selection = getPlanSelectionFromSubscription(subscription);

    if (selection) {
      plan = selection.plan;
      period = selection.period;
      expiresAt = toIsoFromUnix(getSubscriptionCurrentPeriodEnd(subscription));
    }
  }

  const update: ProfilePlanUpdate = {
    plan,
    plan_period: period,
    plan_expires_at: expiresAt,
    ...(customerId ? { stripe_customer_id: customerId } : {}),
  };

  if (userId) {
    await updateProfilePlanByUserId(userId, update);
    return;
  }

  if (customerId) {
    await updateProfilePlanByCustomerId(customerId, {
      plan: update.plan,
      plan_period: update.plan_period,
      plan_expires_at: update.plan_expires_at,
    });
  }
}

async function handleSubscriptionChanged(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : null;

  if (!customerId) {
    return;
  }

  const selection = getPlanSelectionFromSubscription(subscription);

  if (!selection) {
    return;
  }

  await updateProfilePlanByCustomerId(customerId, {
    plan: selection.plan,
    plan_period: selection.period,
    plan_expires_at: toIsoFromUnix(getSubscriptionCurrentPeriodEnd(subscription)),
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : null;

  if (!customerId) {
    return;
  }

  await updateProfilePlanByCustomerId(customerId, {
    plan: "free",
    plan_period: null,
    plan_expires_at: null,
  });
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

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return jsonError("Invalid webhook signature", 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return jsonError(message, 500);
  }
}
