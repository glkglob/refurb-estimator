import "server-only";

import Stripe from "stripe";

import { PLANS, type Plan, type PlanPeriod } from "@/lib/plans";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? null;

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!STRIPE_SECRET_KEY || STRIPE_SECRET_KEY.trim().length === 0) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export function getPriceIdForPlan(plan: Plan, period: PlanPeriod): string | null {
  return PLANS[plan].stripePriceIds[period];
}

export function getPlanFromPriceId(priceId: string): Plan | null {
  const normalizedPriceId = priceId.trim();
  if (normalizedPriceId.length === 0) {
    return null;
  }

  for (const plan of Object.keys(PLANS) as Plan[]) {
    const { monthly, annual } = PLANS[plan].stripePriceIds;
    if (monthly === normalizedPriceId || annual === normalizedPriceId) {
      return plan;
    }
  }

  return null;
}
