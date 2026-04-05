import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PaymentIntentRow, PaymentStatus } from "@/types/database";

type SupabaseError = {
  message: string;
};

type SingleRowResult<T> = Promise<{ data: T | null; error: SupabaseError | null }>;

type PaymentIntentWrite = {
  stripe_payment_intent_id: string;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  user_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
};

type PaymentIntentsTableClient = {
  select: (columns?: string) => {
    eq: (column: "stripe_payment_intent_id", value: string) => {
      maybeSingle: <T = PaymentIntentRow>() => SingleRowResult<T>;
    };
  };
  upsert: (
    values: PaymentIntentWrite,
    options: {
      onConflict: "stripe_payment_intent_id";
      ignoreDuplicates: boolean;
    },
  ) => {
    select: (columns?: string) => {
      single: <T = PaymentIntentRow>() => SingleRowResult<T>;
    };
  };
  update: (values: Partial<Pick<PaymentIntentWrite, "status" | "metadata">>) => {
    eq: (column: "stripe_payment_intent_id", value: string) => {
      select: (columns?: string) => {
        single: <T = PaymentIntentRow>() => SingleRowResult<T>;
      };
    };
  };
};

export interface PaymentIntentsSupabaseClient {
  from(table: "payment_intents"): PaymentIntentsTableClient;
}

export type PaymentIntentServiceDependencies = {
  supabaseClient?: PaymentIntentsSupabaseClient;
};

type StripeEventLike = {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
};

type PaymentIntentSeed = {
  stripePaymentIntentId: string;
  stripeCustomerId: string | null;
  stripeCheckoutSessionId: string | null;
  userId: string | null;
  amount: number | null;
  currency: string | null;
  status: PaymentStatus | null;
  metadata: Record<string, unknown>;
};

const paymentStatusSchema = z.enum([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "canceled",
  "succeeded",
]);

const uuidSchema = z.string().uuid();

function getSupabaseClient(
  dependencies: PaymentIntentServiceDependencies = {},
): PaymentIntentsSupabaseClient {
  return (
    dependencies.supabaseClient ??
    (createAdminSupabaseClient() as unknown as PaymentIntentsSupabaseClient)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractReferenceId(value: unknown): string | null {
  if (typeof value === "string") {
    return asNonEmptyString(value);
  }

  if (isRecord(value)) {
    return asNonEmptyString(value.id);
  }

  return null;
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  return null;
}

function parseUuid(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const parsed = uuidSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function normalizeCurrency(value: unknown): string | null {
  const currency = asNonEmptyString(value);
  return currency ? currency.toLowerCase() : null;
}

function getObjectMetadata(object: Record<string, unknown>): Record<string, unknown> {
  return isRecord(object.metadata) ? object.metadata : {};
}

function parsePaymentStatus(value: unknown): PaymentStatus | null {
  const parsed = paymentStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function isTerminalStatus(status: PaymentStatus): boolean {
  return status === "succeeded" || status === "canceled";
}

function mapEventTypeToStatus(eventType: string): PaymentStatus | null {
  switch (eventType) {
    case "payment_intent.succeeded":
      return "succeeded";
    case "payment_intent.payment_failed":
      return "requires_payment_method";
    case "payment_intent.processing":
      return "processing";
    case "payment_intent.canceled":
      return "canceled";
    case "payment_intent.requires_action":
      return "requires_action";
    case "checkout.session.completed":
      return "processing";
    default:
      return null;
  }
}

function extractPaymentIntentId(
  eventType: string,
  object: Record<string, unknown>,
): string | null {
  if (eventType.startsWith("payment_intent.")) {
    return asNonEmptyString(object.id);
  }

  return (
    extractReferenceId(object.payment_intent) ??
    asNonEmptyString(object.stripe_payment_intent_id)
  );
}

function extractStripeEventObject(event: StripeEventLike): Record<string, unknown> | null {
  if (!isRecord(event.data)) {
    return null;
  }

  const object = event.data.object;
  return isRecord(object) ? object : null;
}

export function extractStripePaymentIntentId(event: StripeEventLike): string | null {
  const object = extractStripeEventObject(event);
  if (!object) {
    return null;
  }

  return extractPaymentIntentId(event.type, object);
}

export function extractStripePaymentStatus(
  event: StripeEventLike,
): PaymentStatus | null {
  const object = extractStripeEventObject(event);
  const statusFromObject = object ? parsePaymentStatus(object.status) : null;

  return statusFromObject ?? mapEventTypeToStatus(event.type);
}

function extractPaymentIntentSeed(event: StripeEventLike): PaymentIntentSeed | null {
  const object = extractStripeEventObject(event);
  if (!object) {
    return null;
  }

  const stripePaymentIntentId = extractPaymentIntentId(event.type, object);
  if (!stripePaymentIntentId) {
    return null;
  }

  const metadata = getObjectMetadata(object);
  const userId =
    parseUuid(asNonEmptyString(metadata.userId)) ??
    parseUuid(asNonEmptyString(object.client_reference_id));

  return {
    stripePaymentIntentId,
    stripeCustomerId: extractReferenceId(object.customer),
    stripeCheckoutSessionId:
      event.type === "checkout.session.completed"
        ? asNonEmptyString(object.id)
        : asNonEmptyString(object.stripe_checkout_session_id),
    userId,
    amount: parseAmount(object.amount) ?? parseAmount(object.amount_total),
    currency: normalizeCurrency(object.currency),
    status: extractStripePaymentStatus(event),
    metadata: {
      ...metadata,
      stripe_event_id: event.id,
      stripe_event_type: event.type,
    },
  };
}

function mergeMetadata(
  existing: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...next };
}

function toPaymentIntentRow(row: PaymentIntentRow): PaymentIntentRow {
  const status = parsePaymentStatus(row.status);
  if (!status) {
    throw new Error(
      `Invalid payment_intents.status "${String(row.status)}" returned from database`,
    );
  }

  return {
    ...row,
    status,
    metadata: isRecord(row.metadata) ? row.metadata : {},
  };
}

async function refetchPaymentIntent(
  stripePaymentIntentId: string,
  supabaseClient: PaymentIntentsSupabaseClient,
): Promise<PaymentIntentRow> {
  const refreshed = await getByStripeId(stripePaymentIntentId, { supabaseClient });
  if (!refreshed) {
    throw new Error(
      `Failed to reload payment_intent ${stripePaymentIntentId} after write`,
    );
  }

  return refreshed;
}

export async function getByStripeId(
  stripePaymentIntentId: string,
  dependencies: PaymentIntentServiceDependencies = {},
): Promise<PaymentIntentRow | null> {
  const normalizedId = asNonEmptyString(stripePaymentIntentId);
  if (!normalizedId) {
    return null;
  }

  const supabaseClient = getSupabaseClient(dependencies);
  const { data, error } = await supabaseClient
    .from("payment_intents")
    .select("*")
    .eq("stripe_payment_intent_id", normalizedId)
    .maybeSingle<PaymentIntentRow>();

  if (error) {
    throw new Error(`Failed to load payment_intent ${normalizedId}: ${error.message}`);
  }

  return data ? toPaymentIntentRow(data) : null;
}

export async function upsertFromStripe(
  event: StripeEventLike,
  dependencies: PaymentIntentServiceDependencies = {},
): Promise<PaymentIntentRow | null> {
  const seed = extractPaymentIntentSeed(event);
  if (!seed) {
    return null;
  }

  const supabaseClient = getSupabaseClient(dependencies);
  const existing = await getByStripeId(seed.stripePaymentIntentId, { supabaseClient });

  if (existing && isTerminalStatus(existing.status)) {
    return existing;
  }

  const amount = seed.amount ?? existing?.amount ?? null;
  const status = seed.status ?? existing?.status ?? null;

  if (amount === null || status === null) {
    return existing;
  }

  const payload: PaymentIntentWrite = {
    stripe_payment_intent_id: seed.stripePaymentIntentId,
    stripe_customer_id: seed.stripeCustomerId ?? existing?.stripe_customer_id ?? null,
    stripe_checkout_session_id:
      seed.stripeCheckoutSessionId ?? existing?.stripe_checkout_session_id ?? null,
    user_id: seed.userId ?? existing?.user_id ?? null,
    amount,
    currency: seed.currency ?? existing?.currency ?? "gbp",
    status,
    metadata: mergeMetadata(existing?.metadata ?? {}, seed.metadata),
  };

  const { error } = await supabaseClient
    .from("payment_intents")
    .upsert(payload, {
      onConflict: "stripe_payment_intent_id",
      ignoreDuplicates: false,
    })
    .select()
    .single<PaymentIntentRow>();

  if (error) {
    throw new Error(
      `Failed to upsert payment_intent ${seed.stripePaymentIntentId}: ${error.message}`,
    );
  }

  return refetchPaymentIntent(seed.stripePaymentIntentId, supabaseClient);
}

export async function updateStatus(
  stripePaymentIntentId: string,
  status: PaymentStatus,
  dependencies: PaymentIntentServiceDependencies = {},
): Promise<PaymentIntentRow> {
  const normalizedId = asNonEmptyString(stripePaymentIntentId);
  const normalizedStatus = parsePaymentStatus(status);

  if (!normalizedId) {
    throw new Error("stripe_payment_intent_id is required");
  }

  if (!normalizedStatus) {
    throw new Error("status is required");
  }

  const supabaseClient = getSupabaseClient(dependencies);
  const existing = await getByStripeId(normalizedId, { supabaseClient });

  if (!existing) {
    throw new Error(`payment_intent ${normalizedId} was not found`);
  }

  if (isTerminalStatus(existing.status)) {
    return existing;
  }

  if (existing.status === normalizedStatus) {
    return existing;
  }

  const { error } = await supabaseClient
    .from("payment_intents")
    .update({ status: normalizedStatus })
    .eq("stripe_payment_intent_id", normalizedId)
    .select()
    .single<PaymentIntentRow>();

  if (error) {
    throw new Error(
      `Failed to update payment_intent ${normalizedId}: ${error.message}`,
    );
  }

  return refetchPaymentIntent(normalizedId, supabaseClient);
}
