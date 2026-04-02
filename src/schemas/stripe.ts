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
    client_reference_id: z.string().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.string()).nullish(),
    customer: stripeReferenceSchema.nullish(),
    subscription: stripeReferenceSchema.nullish(),
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

export const stripeWebhookSchema = z.discriminatedUnion("type", [
  checkoutSessionCompletedEventSchema,
  customerSubscriptionCreatedEventSchema,
  customerSubscriptionUpdatedEventSchema,
  customerSubscriptionDeletedEventSchema,
]);

export type StripeWebhookEvent = z.infer<typeof stripeWebhookSchema>;
