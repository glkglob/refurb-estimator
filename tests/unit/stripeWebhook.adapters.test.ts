import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updates: Array<{
  column: string;
  value: string;
  payload: Record<string, unknown>;
}> = [];

const stripeClientMock = {
  webhooks: {
    constructEvent: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
};

vi.mock("@/lib/plans", () => ({
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
  },
}));

vi.mock("@/lib/stripe", () => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  getStripeClient: () => stripeClientMock,
  getPlanFromPriceId: (priceId: string) => {
    if (priceId === "price_pro_monthly" || priceId === "price_pro_annual") {
      return "pro";
    }

    return null;
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async (column: string, value: string) => {
          updates.push({ column, value, payload });
          return { error: null };
        },
      }),
    }),
  }),
}));

async function loadStripeWebhookService() {
  vi.resetModules();
  return import("@/services/stripeWebhook");
}

describe("services/stripeWebhook spec adapter", () => {
  beforeEach(() => {
    updates.length = 0;
    stripeClientMock.webhooks.constructEvent.mockReset();
    stripeClientMock.subscriptions.retrieve.mockReset();
    stripeClientMock.webhooks.constructEvent.mockImplementation(
      (payload: string, signature: string, webhookSecret: string) => {
        if (signature !== "valid-signature" || webhookSecret !== "whsec_test") {
          throw new Error("signature verification failed");
        }

        return JSON.parse(payload) as unknown;
      },
    );
    stripeClientMock.subscriptions.retrieve.mockResolvedValue({
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
  });

  afterEach(() => {
    updates.length = 0;
  });

  it("returns updated for a valid checkout completion payload buffer", async () => {
    const { handleStripeWebhook } = await loadStripeWebhookService();

    const result = await handleStripeWebhook(
      Buffer.from(
        JSON.stringify({
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
        }),
        "utf8",
      ),
      "valid-signature",
    );

    expect(result).toEqual({ status: "updated" });
    expect(stripeClientMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      column: "id",
      value: "user_123",
    });
  });

  it("rejects invalid signatures", async () => {
    const { handleStripeWebhook } = await loadStripeWebhookService();

    await expect(
      handleStripeWebhook(
        Buffer.from(
          JSON.stringify({
            id: "evt_checkout_2",
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
          }),
          "utf8",
        ),
        "invalid-signature",
      ),
    ).rejects.toThrow("Invalid webhook signature");
  });

  it("accepts subscription lifecycle events from a buffer payload", async () => {
    const { handleStripeWebhook } = await loadStripeWebhookService();

    const result = await handleStripeWebhook(
      Buffer.from(
        JSON.stringify({
          id: "evt_subscription_1",
          type: "customer.subscription.updated",
          data: {
            object: {
              customer: "cus_123",
              items: {
                data: [
                  {
                    current_period_end: 1735689600,
                    price: { id: "price_pro_monthly" },
                  },
                ],
              },
            },
          },
        }),
        "utf8",
      ),
      "valid-signature",
    );

    expect(result).toEqual({ status: "updated" });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      column: "stripe_customer_id",
      value: "cus_123",
    });
  });
});
