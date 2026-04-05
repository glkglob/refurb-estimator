import type Stripe from "stripe";

import type { PaymentIntentRow } from "@/types/database";
import {
  getByStripeId,
  type PaymentIntentsSupabaseClient,
  updateStatus,
  upsertFromStripe,
} from "@/services/paymentIntents";

function createPaymentIntentRow(
  overrides: Partial<PaymentIntentRow> = {},
): PaymentIntentRow {
  return {
    id: overrides.id ?? "row_1",
    stripe_payment_intent_id:
      overrides.stripe_payment_intent_id ?? "pi_test_123",
    stripe_customer_id: overrides.stripe_customer_id ?? "cus_test_123",
    stripe_checkout_session_id:
      overrides.stripe_checkout_session_id ?? null,
    user_id:
      overrides.user_id ?? "550e8400-e29b-41d4-a716-446655440000",
    amount: overrides.amount ?? 2500,
    currency: overrides.currency ?? "gbp",
    status: overrides.status ?? "processing",
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? new Date().toISOString(),
    updated_at: overrides.updated_at ?? new Date().toISOString(),
  };
}

function createSupabaseClientMock(
  initialRows: PaymentIntentRow[] = [],
): {
  client: PaymentIntentsSupabaseClient;
  rows: PaymentIntentRow[];
} {
  const rows = [...initialRows];

  const client: PaymentIntentsSupabaseClient = {
    from: () => ({
      select: () => ({
        eq: (_column: "stripe_payment_intent_id", value: string) => ({
          maybeSingle: async <T = PaymentIntentRow>() => ({
            data:
              (rows.find(
                (row) => row.stripe_payment_intent_id === value,
              ) as T | undefined) ?? null,
            error: null,
          }),
        }),
      }),
      upsert: (values, _options) => ({
        select: () => ({
          single: async <T = PaymentIntentRow>() => {
            const existingIndex = rows.findIndex(
              (row) =>
                row.stripe_payment_intent_id === values.stripe_payment_intent_id,
            );

            const nextRow: PaymentIntentRow =
              existingIndex >= 0
                ? {
                    ...rows[existingIndex],
                    ...values,
                  }
                : createPaymentIntentRow({
                    ...values,
                    id: `row_${rows.length + 1}`,
                  });

            if (existingIndex >= 0) {
              rows[existingIndex] = nextRow;
            } else {
              rows.push(nextRow);
            }

            return {
              data: nextRow as T,
              error: null,
            };
          },
        }),
      }),
      update: (values) => ({
        eq: (_column: "stripe_payment_intent_id", value: string) => ({
          select: () => ({
            single: async <T = PaymentIntentRow>() => {
              const existingIndex = rows.findIndex(
                (row) => row.stripe_payment_intent_id === value,
              );

              if (existingIndex < 0) {
                return {
                  data: null,
                  error: { message: "Row not found" },
                };
              }

              const nextRow: PaymentIntentRow = {
                ...rows[existingIndex],
                ...values,
              } as PaymentIntentRow;
              rows[existingIndex] = nextRow;

              return {
                data: nextRow as T,
                error: null,
              };
            },
          }),
        }),
      }),
    }),
  };

  return { client, rows };
}

describe("services/paymentIntents", () => {
  test("upserts a payment_intent event into payment_intents", async () => {
    const { client, rows } = createSupabaseClientMock();

    const result = await upsertFromStripe(
      {
        id: "evt_payment_intent_succeeded",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_live_123",
            customer: "cus_live_123",
            amount: 4999,
            currency: "GBP",
            status: "succeeded",
            metadata: {
              userId: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
      } as unknown as Stripe.Event,
      { supabaseClient: client },
    );

    expect(result).toEqual(
      expect.objectContaining({
        stripe_payment_intent_id: "pi_live_123",
        stripe_customer_id: "cus_live_123",
        amount: 4999,
        currency: "gbp",
        status: "succeeded",
        user_id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );
    expect(rows).toHaveLength(1);
  });

  test("uses the unique stripe id to avoid duplicate inserts across retries", async () => {
    const { client, rows } = createSupabaseClientMock();

    const event = {
      id: "evt_checkout_completed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          payment_intent: "pi_checkout_123",
          customer: "cus_checkout_123",
          client_reference_id: "550e8400-e29b-41d4-a716-446655440000",
          amount_total: 9999,
          currency: "gbp",
          status: "complete",
          metadata: {},
        },
      },
    } as unknown as Stripe.Event;

    await upsertFromStripe(event, { supabaseClient: client });
    await upsertFromStripe(event, { supabaseClient: client });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.stripe_checkout_session_id).toBe("cs_test_123");
    expect(rows[0]?.status).toBe("processing");
  });

  test("returns null for webhook events with no payment intent payload", async () => {
    const { client, rows } = createSupabaseClientMock();

    const result = await upsertFromStripe(
      {
        id: "evt_subscription_updated",
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_subscription_123",
            items: { data: [] },
          },
        },
      } as unknown as Stripe.Event,
      { supabaseClient: client },
    );

    expect(result).toBeNull();
    expect(rows).toHaveLength(0);
  });

  test("loads and updates rows by stripe_payment_intent_id", async () => {
    const existingRow = createPaymentIntentRow({
      stripe_payment_intent_id: "pi_existing_123",
      status: "processing",
    });
    const { client } = createSupabaseClientMock([existingRow]);

    const loaded = await getByStripeId("pi_existing_123", {
      supabaseClient: client,
    });
    const updated = await updateStatus("pi_existing_123", "succeeded", {
      supabaseClient: client,
    });

    expect(loaded?.stripe_payment_intent_id).toBe("pi_existing_123");
    expect(updated.status).toBe("succeeded");
  });

  test("does not overwrite a terminal payment_intent state", async () => {
    const existingRow = createPaymentIntentRow({
      stripe_payment_intent_id: "pi_terminal_123",
      status: "succeeded",
    });
    const { client, rows } = createSupabaseClientMock([existingRow]);

    const result = await upsertFromStripe(
      {
        id: "evt_payment_intent_processing",
        type: "payment_intent.processing",
        data: {
          object: {
            id: "pi_terminal_123",
            customer: "cus_terminal_123",
            amount: 4999,
            currency: "gbp",
            status: "processing",
            metadata: {},
          },
        },
      } as unknown as Stripe.Event,
      { supabaseClient: client },
    );

    expect(result?.status).toBe("succeeded");
    expect(rows[0]?.status).toBe("succeeded");
  });
});
