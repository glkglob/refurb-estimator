/** @jest-environment node */

import Stripe from "stripe";

const runContainerSmoke = process.env.RUN_CONTAINER_SMOKE === "1";
const describeIfContainer = runContainerSmoke ? describe : describe.skip;

type ProfileUpdateCall = {
  payload: Record<string, unknown>;
  column: string;
  value: string;
};

type SupabaseClientMock = {
  from: (table: "profiles") => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function createSupabaseClientMock(): {
  client: SupabaseClientMock;
  updates: ProfileUpdateCall[];
} {
  const updates: ProfileUpdateCall[] = [];

  const client: SupabaseClientMock = {
    from: () => ({
      update: (payload: Record<string, unknown>) => ({
        eq: async (column: string, value: string) => {
          updates.push({ payload, column, value });
          return { error: null };
        },
      }),
    }),
  };

  return { client, updates };
}

function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "sk_test_smoke";
  const host = process.env.STRIPE_MOCK_HOST ?? "127.0.0.1";
  const port = Number(process.env.STRIPE_MOCK_PORT ?? "12111");

  return new Stripe(secretKey, {
    host,
    port,
    protocol: "http",
  });
}

describeIfContainer("Stripe webhook container smoke", () => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_smoke";

  test("validates a signed subscription event and updates profile fields", async () => {
    const stripeClient = createStripeClient();
    const product = await stripeClient.products.create({
      name: `Smoke Product ${Date.now()}`,
    });
    const monthlyPrice = await stripeClient.prices.create({
      product: product.id,
      currency: "gbp",
      unit_amount: 1999,
      recurring: {
        interval: "month",
      },
    });
    const customer = await stripeClient.customers.create({
      email: `smoke+${Date.now()}@example.com`,
    });

    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = monthlyPrice.id;
    process.env.STRIPE_PRO_ANNUAL_PRICE_ID = "";
    process.env.STRIPE_AGENCY_MONTHLY_PRICE_ID = "";
    process.env.STRIPE_AGENCY_ANNUAL_PRICE_ID = "";

    jest.resetModules();

    const { processStripeWebhookRequest } = await import(
      "@/services/stripeWebhook"
    );

    const { client, updates } = createSupabaseClientMock();
    const onProcessed = jest.fn();

    const payloadObject = {
      id: "evt_smoke_subscription_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: customer.id,
          items: {
            data: [
              {
                current_period_end: 1_767_225_600,
                price: {
                  id: monthlyPrice.id,
                },
              },
            ],
          },
        },
      },
    };

    const payload = JSON.stringify(payloadObject);
    const signature = stripeClient.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });

    await processStripeWebhookRequest(payload, signature, {
      webhookSecret,
      stripeClient,
      supabaseClient: client,
      onEventProcessed: onProcessed,
    });

    expect(updates).toHaveLength(1);
    expect(updates[0]?.column).toBe("stripe_customer_id");
    expect(updates[0]?.value).toBe(customer.id);
    expect(updates[0]?.payload).toEqual(
      expect.objectContaining({
        plan: "pro",
        plan_period: "monthly",
        plan_expires_at: new Date(1_767_225_600 * 1000).toISOString(),
      }),
    );
    expect(onProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "evt_smoke_subscription_updated",
        type: "customer.subscription.updated",
      }),
    );
  });

  test("rejects invalid webhook signatures", async () => {
    const stripeClient = createStripeClient();
    const { client } = createSupabaseClientMock();

    await expect(
      (async () => {
        jest.resetModules();

        const { processStripeWebhookRequest } = await import(
          "@/services/stripeWebhook"
        );

        const payload = JSON.stringify({
          id: "evt_smoke_invalid_signature",
          type: "customer.subscription.deleted",
          data: {
            object: {
              customer: "cus_smoke_invalid",
              items: {
                data: [],
              },
            },
          },
        });

        await processStripeWebhookRequest(payload, "invalid-signature", {
          webhookSecret,
          stripeClient,
          supabaseClient: client,
        });
      })(),
    ).rejects.toThrow("Invalid webhook signature");
  });
});
