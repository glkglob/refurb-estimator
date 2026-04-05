import type Stripe from "stripe";

import { PLANS, type Plan, type PlanPeriod } from "@/lib/plans";
import {
  STRIPE_WEBHOOK_SECRET,
  getPlanFromPriceId,
  getStripeClient,
} from "@/lib/stripe";
import {
  extractStripePaymentIntentId,
  extractStripePaymentStatus,
  getByStripeId,
  type PaymentIntentsSupabaseClient,
  updateStatus,
  upsertFromStripe,
} from "@/services/paymentIntents";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { stripeWebhookSchema, type StripeWebhookEvent } from "@/schemas/stripe";
import { validate } from "@/utils/validator";

export type ProfilePlanUpdate = {
  plan: Plan;
  plan_period: PlanPeriod | null;
  plan_expires_at: string | null;
  stripe_customer_id?: string;
};

type StripeReference = string | { id: string };

type SubscriptionItem = {
  current_period_end?: number | null;
  price?: {
    id?: string | null;
  } | null;
};

type SubscriptionLike = {
  customer?: StripeReference | null;
  items: {
    data: SubscriptionItem[];
  };
};

type CheckoutSessionLike = {
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  customer?: StripeReference | null;
  subscription?: StripeReference | null;
};

type MinimalStripeEvent = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

type CheckoutCompletedDomainEvent = {
  kind: "checkout.session.completed";
  eventId: string;
  userId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
};

type SubscriptionLifecycleDomainEvent = {
  kind:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted";
  eventId: string;
  customerId: string | null;
  priceIds: string[];
  currentPeriodEnd: string | null;
};

type IgnoredStripeDomainEvent = {
  kind: "ignored";
  eventId: string;
  eventType: string;
};

export type StripeWebhookDomainEvent =
  | CheckoutCompletedDomainEvent
  | SubscriptionLifecycleDomainEvent
  | IgnoredStripeDomainEvent;

type SupabaseError = {
  message: string;
};

type StripeWebhookProfilesClient = {
  from: (table: "profiles") => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: SupabaseError | null }>;
    };
  };
};

type ProfileUpdateTarget = {
  column: "id" | "stripe_customer_id";
  value: string;
};

export type StripeWebhookDependencies = {
  stripeClient?: Stripe;
  webhookSecret?: string | null;
  supabaseClient?: StripeWebhookProfilesClient;
  paymentIntentsClient?: PaymentIntentsSupabaseClient;
  onEventProcessed?: (event: StripeWebhookEvent) => void;
  onEventFailed?: (error: unknown, eventType?: string) => void;
};

export type StripeSignatureVerificationDependencies = Pick<
  StripeWebhookDependencies,
  "stripeClient" | "webhookSecret"
>;

function validateMinimalStripeEvent(
  event: StripeWebhookEvent | MinimalStripeEvent,
): MinimalStripeEvent {
  if (
    typeof event.id !== "string" ||
    event.id.trim().length === 0 ||
    typeof event.type !== "string" ||
    event.type.trim().length === 0 ||
    typeof event.data !== "object" ||
    event.data === null ||
    !("object" in event.data)
  ) {
    throw new Error("Invalid Stripe event payload");
  }

  return event;
}

function extractReferenceId(reference: StripeReference | null | undefined): string | null {
  if (typeof reference === "string") {
    const trimmed = reference.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (reference && typeof reference.id === "string") {
    const trimmed = reference.id.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  return null;
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

function getPlanSelectionFromPriceIds(
  priceIds: string[],
): { plan: Plan; period: PlanPeriod } | null {
  for (const priceId of priceIds) {
    const plan = getPlanFromPriceId(priceId);
    const period = getPlanPeriodFromPriceId(priceId);

    if (plan && period) {
      return { plan, period };
    }
  }

  return null;
}

function getSubscriptionPriceIds(subscription: SubscriptionLike): string[] {
  return subscription.items.data
    .map((item) => item.price?.id)
    .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function getSubscriptionCurrentPeriodEnd(subscription: SubscriptionLike): string | null {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return typeof periodEnd === "number" && Number.isFinite(periodEnd)
    ? toIsoFromUnix(periodEnd)
    : null;
}

function getProfileSupabaseClient(
  dependencies: Pick<StripeWebhookDependencies, "supabaseClient">,
): StripeWebhookProfilesClient {
  return (
    dependencies.supabaseClient ??
    (createAdminSupabaseClient() as unknown as StripeWebhookProfilesClient)
  );
}

function getCheckoutProfileTarget(
  domainEvent: CheckoutCompletedDomainEvent,
): ProfileUpdateTarget | null {
  if (domainEvent.userId) {
    return { column: "id", value: domainEvent.userId };
  }

  if (domainEvent.customerId) {
    return { column: "stripe_customer_id", value: domainEvent.customerId };
  }

  return null;
}

async function updateProfilePlan(
  target: ProfileUpdateTarget,
  update: ProfilePlanUpdate,
  supabaseClient: StripeWebhookProfilesClient,
): Promise<void> {
  const payload = { ...update, updated_at: new Date().toISOString() };
  const { error } = await supabaseClient
    .from("profiles")
    .update(payload)
    .eq(target.column, target.value);

  if (error) {
    const identifier = target.column === "id" ? "user ID" : "customer ID";
    throw new Error(`Failed to update profile by ${identifier}: ${error.message}`);
  }
}

async function resolveCheckoutPlan(
  subscriptionId: string | null,
  stripeClient: Stripe,
): Promise<{
  plan: Plan;
  period: PlanPeriod | null;
  expiresAt: string | null;
}> {
  if (!subscriptionId) {
    return {
      plan: "free",
      period: null,
      expiresAt: null,
    };
  }

  const subscription = (await stripeClient.subscriptions.retrieve(
    subscriptionId,
  )) as unknown as SubscriptionLike;
  const selection = getPlanSelectionFromPriceIds(getSubscriptionPriceIds(subscription));

  if (!selection) {
    return {
      plan: "free",
      period: null,
      expiresAt: null,
    };
  }

  return {
    plan: selection.plan,
    period: selection.period,
    expiresAt: getSubscriptionCurrentPeriodEnd(subscription),
  };
}

function buildSubscriptionUpdate(
  domainEvent: SubscriptionLifecycleDomainEvent,
): Omit<ProfilePlanUpdate, "stripe_customer_id"> | null {
  if (domainEvent.kind === "customer.subscription.deleted") {
    return {
      plan: "free",
      plan_period: null,
      plan_expires_at: null,
    };
  }

  const selection = getPlanSelectionFromPriceIds(domainEvent.priceIds);
  if (!selection) {
    return null;
  }

  return {
    plan: selection.plan,
    plan_period: selection.period,
    plan_expires_at: domainEvent.currentPeriodEnd,
  };
}

async function handleCheckoutSessionCompleted(
  domainEvent: CheckoutCompletedDomainEvent,
  stripeClient: Stripe,
  supabaseClient: StripeWebhookProfilesClient,
): Promise<void> {
  const target = getCheckoutProfileTarget(domainEvent);
  if (!target) {
    return;
  }

  const planSelection = await resolveCheckoutPlan(
    domainEvent.subscriptionId,
    stripeClient,
  );

  const update: ProfilePlanUpdate = {
    plan: planSelection.plan,
    plan_period: planSelection.period,
    plan_expires_at: planSelection.expiresAt,
    ...(domainEvent.customerId
      ? { stripe_customer_id: domainEvent.customerId }
      : {}),
  };

  await updateProfilePlan(target, update, supabaseClient);
}

async function handleSubscriptionLifecycleEvent(
  domainEvent: SubscriptionLifecycleDomainEvent,
  supabaseClient: StripeWebhookProfilesClient,
): Promise<void> {
  if (!domainEvent.customerId) {
    return;
  }

  const update = buildSubscriptionUpdate(domainEvent);
  if (!update) {
    return;
  }

  await updateProfilePlan(
    {
      column: "stripe_customer_id",
      value: domainEvent.customerId,
    },
    update,
    supabaseClient,
  );
}

export function verifyStripeSignature(
  payload: string,
  signature: string,
  dependencies: StripeSignatureVerificationDependencies = {},
): StripeWebhookEvent {
  const webhookSecret = dependencies.webhookSecret ?? STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  const stripeClient = dependencies.stripeClient ?? getStripeClient();

  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripeClient.webhooks.constructEvent(
      payload,
      signature,
      webhookSecret,
    );
  } catch {
    throw new Error("Invalid webhook signature");
  }

  return validate(stripeEvent, stripeWebhookSchema);
}

export function verifyAndValidateStripeWebhook(
  payload: string,
  signature: string,
  dependencies: StripeSignatureVerificationDependencies = {},
): StripeWebhookEvent {
  return verifyStripeSignature(payload, signature, dependencies);
}

export function mapStripeEventToDomain(
  event: StripeWebhookEvent | MinimalStripeEvent,
): StripeWebhookDomainEvent {
  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as CheckoutSessionLike;
      const userId =
        checkoutSession.client_reference_id?.trim() ||
        checkoutSession.metadata?.userId?.trim() ||
        null;

      return {
        kind: "checkout.session.completed",
        eventId: event.id,
        userId,
        customerId: extractReferenceId(checkoutSession.customer),
        subscriptionId: extractReferenceId(checkoutSession.subscription),
      };
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as SubscriptionLike;

      return {
        kind: event.type,
        eventId: event.id,
        customerId: extractReferenceId(subscription.customer),
        priceIds: getSubscriptionPriceIds(subscription),
        currentPeriodEnd: getSubscriptionCurrentPeriodEnd(subscription),
      };
    }
    default:
      return {
        kind: "ignored",
        eventId: event.id,
        eventType: event.type,
      };
  }
}

export async function processStripeWebhookEvent(
  event: StripeWebhookEvent | MinimalStripeEvent,
  dependencies: Omit<StripeWebhookDependencies, "webhookSecret"> = {},
): Promise<void> {
  const validatedEvent = validateMinimalStripeEvent(event);
  const profileSupabaseClient = getProfileSupabaseClient(dependencies);
  const paymentIntentId = extractStripePaymentIntentId(validatedEvent);
  const paymentIntentStatus = extractStripePaymentStatus(validatedEvent);

  if (paymentIntentId) {
    await upsertFromStripe(validatedEvent, {
      supabaseClient: dependencies.paymentIntentsClient,
    });
  }

  const paymentIntentRecord = paymentIntentId
    ? await getByStripeId(paymentIntentId, {
        supabaseClient: dependencies.paymentIntentsClient,
      })
    : null;

  if (paymentIntentRecord?.status === "succeeded") {
    return;
  }

  const domainEvent = mapStripeEventToDomain(validatedEvent);

  if (domainEvent.kind === "ignored") {
    if (paymentIntentId && paymentIntentStatus) {
      await updateStatus(paymentIntentId, paymentIntentStatus, {
        supabaseClient: dependencies.paymentIntentsClient,
      });
    }

    return;
  }

  if (domainEvent.kind === "checkout.session.completed") {
    const stripeClient = dependencies.stripeClient ?? getStripeClient();
    await handleCheckoutSessionCompleted(
      domainEvent,
      stripeClient,
      profileSupabaseClient,
    );
  } else {
    await handleSubscriptionLifecycleEvent(domainEvent, profileSupabaseClient);
  }

  if (paymentIntentId && paymentIntentStatus) {
    await updateStatus(paymentIntentId, paymentIntentStatus, {
      supabaseClient: dependencies.paymentIntentsClient,
    });
  }
}

export async function processStripeWebhookRequest(
  payload: string,
  signature: string,
  dependencies: StripeWebhookDependencies = {},
): Promise<void> {
  let eventType: string | undefined;

  try {
    const event = verifyStripeSignature(payload, signature, dependencies);
    eventType = event.type;
    await processStripeWebhookEvent(event, dependencies);
    dependencies.onEventProcessed?.(event);
  } catch (error) {
    dependencies.onEventFailed?.(error, eventType);
    throw error;
  }
}

export async function handleStripeWebhook(
  payload: Buffer,
  signature: string,
): Promise<{ status: "updated" | "ignored" }> {
  const payloadText = payload.toString("utf8");
  const event = verifyStripeSignature(payloadText, signature);
  const domainEvent = mapStripeEventToDomain(event);

  await processStripeWebhookEvent(event);

  return {
    status: domainEvent.kind === "ignored" ? "ignored" : "updated",
  };
}
