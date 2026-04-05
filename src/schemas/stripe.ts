import { z } from "zod";

const stripeReferenceSchema = z.union([
  z.string().min(1),
  z.object({ id: z.string().min(1) }).passthrough(),
]);

const subscriptionItemSchema = z
  .object({
    current_period_end: z.number().finite().nullable().optional(),
    price: z
      .object({
        id: z.string().min(1).nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const checkoutSessionObjectSchema = z
  .object({
    id: z.string().min(1).optional(),
    client_reference_id: z.string().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.string()).nullish(),
    customer: stripeReferenceSchema.nullish(),
    subscription: stripeReferenceSchema.nullish(),
    payment_intent: stripeReferenceSchema.nullish(),
    amount_total: z.number().int().nonnegative().optional(),
    currency: z.string().min(1).nullable().optional(),
    status: z.string().min(1).nullable().optional(),
  })
  .passthrough();

const subscriptionObjectSchema = z
  .object({
    customer: stripeReferenceSchema.nullish(),
    items: z
      .object({
        data: z.array(subscriptionItemSchema),
      })
      .passthrough(),
  })
  .passthrough();

export const checkoutSessionCompletedEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.literal("checkout.session.completed"),
    data: z.object({ object: checkoutSessionObjectSchema }).passthrough(),
  })
  .passthrough();

function createSubscriptionEventSchema(
  eventType:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted",
) {
  return z
    .object({
      id: z.string().min(1),
      type: z.literal(eventType),
      data: z.object({ object: subscriptionObjectSchema }).passthrough(),
    })
    .passthrough();
}

export const customerSubscriptionCreatedEventSchema = createSubscriptionEventSchema(
  "customer.subscription.created",
);
export const customerSubscriptionUpdatedEventSchema = createSubscriptionEventSchema(
  "customer.subscription.updated",
);
export const customerSubscriptionDeletedEventSchema = createSubscriptionEventSchema(
  "customer.subscription.deleted",
);

const paymentIntentObjectSchema = z
  .object({
    id: z.string().min(1),
    customer: stripeReferenceSchema.nullish(),
    amount: z.number().int().nonnegative().optional(),
    currency: z.string().min(1).nullable().optional(),
    status: z.string().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.string()).nullish(),
  })
  .passthrough();

function createPaymentIntentEventSchema(
  eventType:
    | "payment_intent.succeeded"
    | "payment_intent.payment_failed"
    | "payment_intent.processing"
    | "payment_intent.canceled"
    | "payment_intent.requires_action",
) {
  return z
    .object({
      id: z.string().min(1),
      type: z.literal(eventType),
      data: z.object({ object: paymentIntentObjectSchema }).passthrough(),
    })
    .passthrough();
}

export const paymentIntentSucceededEventSchema = createPaymentIntentEventSchema(
  "payment_intent.succeeded",
);
export const paymentIntentPaymentFailedEventSchema = createPaymentIntentEventSchema(
  "payment_intent.payment_failed",
);
export const paymentIntentProcessingEventSchema = createPaymentIntentEventSchema(
  "payment_intent.processing",
);
export const paymentIntentCanceledEventSchema = createPaymentIntentEventSchema(
  "payment_intent.canceled",
);
export const paymentIntentRequiresActionEventSchema = createPaymentIntentEventSchema(
  "payment_intent.requires_action",
);

export const stripeWebhookSchema = z.discriminatedUnion("type", [
  checkoutSessionCompletedEventSchema,
  customerSubscriptionCreatedEventSchema,
  customerSubscriptionUpdatedEventSchema,
  customerSubscriptionDeletedEventSchema,
  paymentIntentSucceededEventSchema,
  paymentIntentPaymentFailedEventSchema,
  paymentIntentProcessingEventSchema,
  paymentIntentCanceledEventSchema,
  paymentIntentRequiresActionEventSchema,
]);

export type StripeWebhookEvent = z.infer<typeof stripeWebhookSchema>;
