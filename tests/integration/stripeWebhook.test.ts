import type Stripe from "stripe";

import type { PaymentIntentRow } from "@/types/database";
import {
  processStripeWebhookEvent,
  processStripeWebhookRequest,
} from "@/services/stripeWebhook";

jest.mock("@/lib/plans", () => ({
  PLANS: {
    free: {
      stripePriceIds: {
        monthly: null,
        annual: null,
      },
    },
    pro: {
      stripePriceIds: {
        monthly: "price_pro_monthly",
        annual: "price_pro_annual",
      },
    },
    agency: {
      stripePriceIds: {
        monthly: "price_agency_monthly",
        annual: "price_agency_annual",
      },
    },
  },
}));

jest.mock("@/lib/stripe", () => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  getStripeClient: jest.fn(),
  getPlanFromPriceId: (priceId: string) => {
    if (priceId === "price_pro_monthly" || priceId === "price_pro_annual") {
      return "pro";
    }

    if (priceId === "price_agency_monthly" || priceId === "price_agency_annual") {
      return "agency";
    }

    return null;
  },
}));

type ProfileUpdateCall = {
  payload: Record<string, unknown>;
  column: string;
  value: string;
};

type PaymentIntentUpsertCall = {
  payload: Record<string, unknown>;
};

type StripeClientMock = {
  webhooks: {
    constructEvent: jest.Mock;
  };
  subscriptions: {
    retrieve: jest.Mock;
  };
};

function createPaymentIntentRow(
  overrides: Partial<PaymentIntentRow> = {},
): PaymentIntentRow {
  return {
    id: overrides.id ?? "payment_intent_row_1",
    stripe_payment_intent_id:
      overrides.stripe_payment_intent_id ?? "pi_test_123",
    stripe_customer_id: overrides.stripe_customer_id ?? null,
    stripe_checkout_session_id:
      overrides.stripe_checkout_session_id ?? null,
    user_id: overrides.user_id ?? null,
    amount: overrides.amount ?? 1000,
    currency: overrides.currency ?? "gbp",
    status: overrides.status ?? "processing",
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function createSupabaseClientMock(
  initialPaymentIntents: PaymentIntentRow[] = [],
): {
  client: {
    from: jest.Mock;
  };
  updates: ProfileUpdateCall[];
  paymentIntentUpserts: PaymentIntentUpsertCall[];
  paymentIntentRows: PaymentIntentRow[];
} {
  const updates: ProfileUpdateCall[] = [];
  const paymentIntentUpserts: PaymentIntentUpsertCall[] = [];
  const paymentIntentRows = [...initialPaymentIntents];

  const client = {
    from: jest.fn((table: string) => {
      if (table === "payment_intents") {
        return {
          select: () => ({
            eq: (_column: string, value: string) => ({
              maybeSingle: async () => ({
                data:
                  paymentIntentRows.find(
                    (row) => row.stripe_payment_intent_id === value,
                  ) ?? null,
                error: null,
              }),
            }),
          }),
          upsert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: async () => {
                const stripePaymentIntentId =
                  typeof payload.stripe_payment_intent_id === "string"
                    ? payload.stripe_payment_intent_id
                    : null;

                if (!stripePaymentIntentId) {
                  return {
                    data: null,
                    error: { message: "Missing stripe_payment_intent_id" },
                  };
                }

                const existingIndex = paymentIntentRows.findIndex(
                  (row) => row.stripe_payment_intent_id === stripePaymentIntentId,
                );
                const nextRow =
                  existingIndex >= 0
                    ? {
                        ...paymentIntentRows[existingIndex],
                        ...payload,
                      }
                    : createPaymentIntentRow({
                        ...payload,
                        stripe_payment_intent_id: stripePaymentIntentId,
                      });

                if (existingIndex >= 0) {
                  paymentIntentRows[existingIndex] = nextRow;
                } else {
                  paymentIntentRows.push(nextRow);
                }

                paymentIntentUpserts.push({ payload });
                return { data: nextRow, error: null };
              },
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: (_column: string, value: string) => ({
              select: () => ({
                single: async () => {
                  const existingIndex = paymentIntentRows.findIndex(
                    (row) => row.stripe_payment_intent_id === value,
                  );

                  if (existingIndex < 0) {
                    return {
                      data: null,
                      error: { message: "Row not found" },
                    };
                  }

                  const nextRow = {
                    ...paymentIntentRows[existingIndex],
                    ...payload,
                  };
                  paymentIntentRows[existingIndex] = nextRow;

                  return { data: nextRow, error: null };
                },
              }),
            }),
          }),
        };
      }

      return {
        update: (payload: Record<string, unknown>) => ({
          eq: async (column: string, value: string) => {
            updates.push({ payload, column, value });
            return { error: null };
          },
        }),
      };
    }),
  };

  return { client, updates, paymentIntentUpserts, paymentIntentRows };
}

function createStripeClientMock(subscriptionResponse: unknown): StripeClientMock {
  return {
    webhooks: {
      constructEvent: jest.fn(
        (payload: string, signature: string, webhookSecret: string) => {
          if (signature !== "valid-signature" || webhookSecret !== "whsec_test") {
            throw new Error("signature verification failed");
          }

          return JSON.parse(payload) as unknown;
        },
      ),
    },
    subscriptions: {
      retrieve: jest.fn(async () => subscriptionResponse),
    },
  };
}

describe("services/stripeWebhook integration contract", () => {
  test("handles checkout.session.completed with signature verification and profile update", async () => {
    const onProcessed = jest.fn();
    const { client, updates } = createSupabaseClientMock();

    const stripeClient = createStripeClientMock({
      customer: "cus_123",
      items: {
        data: [
          {
            current_period_end: 1735689600,
            price: { id: "price_pro_monthly" },
          },
        ],
      },
    });

    const eventPayload = {
      id: "evt_checkout_1",
      type: "checkout.session.completed",
      data: {
        object: {
          client_reference_id: "user_123",
          customer: "cus_123",
          subscription: "sub_123",
          metadata: {
            userId: "user_123",
          },
        },
      },
    };

    await processStripeWebhookRequest(
      JSON.stringify(eventPayload),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
        onEventProcessed: onProcessed,
      },
    );

    expect(stripeClient.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    expect(updates).toHaveLength(1);
    expect(updates[0]?.column).toBe("id");
    expect(updates[0]?.value).toBe("user_123");
    expect(updates[0]?.payload).toEqual(
      expect.objectContaining({
        plan: "pro",
        plan_period: "monthly",
        plan_expires_at: new Date(1735689600 * 1000).toISOString(),
        stripe_customer_id: "cus_123",
      }),
    );
    expect(onProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "evt_checkout_1",
        type: "checkout.session.completed",
      }),
    );
  });

  test("upserts payment_intents for payment_intent events without profile side effects", async () => {
    const { client, updates, paymentIntentUpserts, paymentIntentRows } =
      createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: "cus_unused",
      items: {
        data: [],
      },
    });

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_payment_intent_1",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_live_123",
            customer: "cus_live_123",
            amount: 4999,
            currency: "gbp",
            status: "succeeded",
            metadata: {
              userId: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
        paymentIntentsClient: client,
      },
    );

    expect(updates).toHaveLength(0);
    expect(paymentIntentUpserts).toHaveLength(1);
    expect(paymentIntentUpserts[0]?.payload).toEqual(
      expect.objectContaining({
        stripe_payment_intent_id: "pi_live_123",
        stripe_customer_id: "cus_live_123",
        amount: 4999,
        currency: "gbp",
        status: "succeeded",
      }),
    );
    expect(paymentIntentRows[0]?.status).toBe("succeeded");
  });

  test("exits early when the payment_intent record is already succeeded", async () => {
    const { client, updates } = createSupabaseClientMock([
      createPaymentIntentRow({
        stripe_payment_intent_id: "pi_done_123",
        status: "succeeded",
      }),
    ]);
    const stripeClient = createStripeClientMock({
      customer: "cus_123",
      items: {
        data: [
          {
            current_period_end: 1735689600,
            price: { id: "price_pro_monthly" },
          },
        ],
      },
    });

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_already_succeeded",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_done_123",
            payment_intent: "pi_done_123",
            client_reference_id: "user_123",
            customer: "cus_123",
            subscription: "sub_123",
            amount_total: 4999,
            currency: "gbp",
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
        paymentIntentsClient: client,
      },
    );

    expect(stripeClient.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  test("returns an invalid signature error and triggers failure hook", async () => {
    const onFailed = jest.fn();
    const { client } = createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: "cus_unused",
      items: {
        data: [],
      },
    });

    await expect(
      processStripeWebhookRequest(
        JSON.stringify({
          id: "evt_invalid",
          type: "checkout.session.completed",
          data: {
            object: {
              client_reference_id: "user_x",
              customer: "cus_x",
              subscription: "sub_x",
              metadata: {
                userId: "user_x",
              },
            },
          },
        }),
        "bad-signature",
        {
          webhookSecret: "whsec_test",
          stripeClient: stripeClient as unknown as Stripe,
          supabaseClient: client,
          onEventFailed: onFailed,
        },
      ),
    ).rejects.toThrow("Invalid webhook signature");

    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed.mock.calls[0]?.[1]).toBeUndefined();
  });

  test("maps subscription lifecycle events to created/updated/deleted profile states", async () => {
    const { client, updates } = createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: "cus_unused",
      items: {
        data: [],
      },
    });

    const updatedPayload = {
      id: "evt_subscription_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_456",
          items: {
            data: [
              {
                current_period_end: 1738368000,
                price: { id: "price_agency_annual" },
              },
            ],
          },
        },
      },
    };

    const deletedPayload = {
      id: "evt_subscription_deleted",
      type: "customer.subscription.deleted",
      data: {
        object: {
          customer: "cus_456",
          items: {
            data: [
              {
                current_period_end: null,
                price: { id: null },
              },
            ],
          },
        },
      },
    };

    await processStripeWebhookRequest(
      JSON.stringify(updatedPayload),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    await processStripeWebhookRequest(
      JSON.stringify(deletedPayload),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    expect(updates).toHaveLength(2);
    expect(updates[0]?.column).toBe("stripe_customer_id");
    expect(updates[0]?.value).toBe("cus_456");
    expect(updates[0]?.payload).toEqual(
      expect.objectContaining({
        plan: "agency",
        plan_period: "annual",
        plan_expires_at: new Date(1738368000 * 1000).toISOString(),
      }),
    );

    expect(updates[1]?.payload).toEqual(
      expect.objectContaining({
        plan: "free",
        plan_period: null,
        plan_expires_at: null,
      }),
    );
  });

  test("rejects when webhook secret is missing", async () => {
    const { client } = createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: "cus_unused",
      items: {
        data: [],
      },
    });

    await expect(
      processStripeWebhookRequest(
        JSON.stringify({
          id: "evt_missing_secret",
          type: "checkout.session.completed",
          data: { object: {} },
        }),
        "valid-signature",
        {
          webhookSecret: "",
          stripeClient: stripeClient as unknown as Stripe,
          supabaseClient: client,
        },
      ),
    ).rejects.toThrow("STRIPE_WEBHOOK_SECRET is not configured");
  });

  test("handles checkout without user id by falling back to customer id updates", async () => {
    const { client, updates } = createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: { id: "cus_999" },
      items: {
        data: [
          {
            current_period_end: 1741046400,
            price: { id: "price_pro_annual" },
          },
        ],
      },
    });

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_customer_only",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: { id: "cus_999" },
            subscription: { id: "sub_999" },
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]?.column).toBe("stripe_customer_id");
    expect(updates[0]?.value).toBe("cus_999");
    expect(updates[0]?.payload).toEqual(
      expect.objectContaining({
        plan: "pro",
        plan_period: "annual",
      }),
    );
  });

  test("falls back to free plan when checkout subscription mapping is missing", async () => {
    const { client, updates } = createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: "cus_321",
      items: {
        data: [
          {
            current_period_end: null,
            price: { id: "price_unknown" },
          },
        ],
      },
    });

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_unknown_plan",
        type: "checkout.session.completed",
        data: {
          object: {
            client_reference_id: "user_321",
            customer: "cus_321",
            subscription: "sub_321",
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload).toEqual(
      expect.objectContaining({
        plan: "free",
        plan_period: null,
        plan_expires_at: null,
      }),
    );
  });

  test("returns without updates for events missing customer/user linkage", async () => {
    const { client, updates } = createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: "cus_unused",
      items: {
        data: [],
      },
    });

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_checkout_no_links",
        type: "checkout.session.completed",
        data: {
          object: {
            subscription: null,
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_subscription_updated_no_customer",
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: null,
            items: {
              data: [
                {
                  current_period_end: 1741046400,
                  price: { id: "price_pro_monthly" },
                },
              ],
            },
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_subscription_updated_unknown_price",
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_none",
            items: {
              data: [
                {
                  current_period_end: 1741046400,
                  price: { id: "price_unknown" },
                },
              ],
            },
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    await processStripeWebhookRequest(
      JSON.stringify({
        id: "evt_subscription_deleted_no_customer",
        type: "customer.subscription.deleted",
        data: {
          object: {
            customer: null,
            items: {
              data: [],
            },
          },
        },
      }),
      "valid-signature",
      {
        webhookSecret: "whsec_test",
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    expect(updates).toHaveLength(0);
  });

  test("bubbles profile update failures by user id and customer id", async () => {
    const errorClient = {
      from: jest.fn(() => ({
        update: () => ({
          eq: async () => ({ error: { message: "db failure" } }),
        }),
      })),
    };
    const stripeClient = createStripeClientMock({
      customer: "cus_err",
      items: {
        data: [
          {
            current_period_end: 1738368000,
            price: { id: "price_agency_annual" },
          },
        ],
      },
    });

    await expect(
      processStripeWebhookRequest(
        JSON.stringify({
          id: "evt_checkout_fail",
          type: "checkout.session.completed",
          data: {
            object: {
              client_reference_id: "user_err",
              customer: "cus_err",
              subscription: "sub_err",
            },
          },
        }),
        "valid-signature",
        {
          webhookSecret: "whsec_test",
          stripeClient: stripeClient as unknown as Stripe,
          supabaseClient: errorClient,
        },
      ),
    ).rejects.toThrow("Failed to update profile by user ID: db failure");

    await expect(
      processStripeWebhookRequest(
        JSON.stringify({
          id: "evt_subscription_fail",
          type: "customer.subscription.updated",
          data: {
            object: {
              customer: "cus_err",
              items: {
                data: [
                  {
                    current_period_end: 1738368000,
                    price: { id: "price_agency_annual" },
                  },
                ],
              },
            },
          },
        }),
        "valid-signature",
        {
          webhookSecret: "whsec_test",
          stripeClient: stripeClient as unknown as Stripe,
          supabaseClient: errorClient,
        },
      ),
    ).rejects.toThrow("Failed to update profile by customer ID: db failure");
  });

  test("ignores unsupported event types without side effects", async () => {
    const { client, updates } = createSupabaseClientMock();
    const stripeClient = createStripeClientMock({
      customer: "cus_unused",
      items: {
        data: [],
      },
    });

    await processStripeWebhookEvent(
      {
        id: "evt_unhandled",
        type: "invoice.created",
        data: { object: {} },
      } as unknown as Parameters<typeof processStripeWebhookEvent>[0],
      {
        stripeClient: stripeClient as unknown as Stripe,
        supabaseClient: client,
      },
    );

    expect(updates).toHaveLength(0);
  });
});
