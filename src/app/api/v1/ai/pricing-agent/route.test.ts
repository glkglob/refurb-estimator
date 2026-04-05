import { POST } from "./route";
import { aiClient, PRICING_MODEL } from "@/lib/ai/client";
import { requireRole } from "@/lib/rbac";
import { AuthError } from "@/lib/supabase/auth-helpers";

jest.mock("@/lib/ai/client", () => ({
  aiClient: {
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  },
  PRICING_MODEL: "gpt-4o-mini"
}));

jest.mock("@/lib/rbac", () => ({
  requireRole: jest.fn()
}));

type MockedCreateFn = jest.MockedFunction<typeof aiClient.chat.completions.create>;
const mockedCreate = aiClient.chat.completions.create as MockedCreateFn;
const mockedRequireRole = jest.mocked(requireRole);

describe("POST /api/v1/ai/pricing-agent", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedCreate.mockReset();
    mockedRequireRole.mockReset();
    mockedRequireRole.mockResolvedValue({
      id: "user-123",
      email: "user@example.com",
      role: "customer"
    });
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/v1/ai/pricing-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyType: "house",
        location: "SW1A 1AA"
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid pricing-agent payload");
  });

  test("returns 401 when user is not authenticated", async () => {
    mockedRequireRole.mockRejectedValueOnce(new AuthError("Not authenticated", 401));

    const request = new Request("http://localhost/api/v1/ai/pricing-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyType: "Terraced House",
        location: "SW1A 1AA",
        floorAreaM2: 85,
        condition: "fair",
        scope: "Refurb kitchen and bathroom."
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Not authenticated");
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  test("uses shared AI model and normalizes category and total ranges", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Kitchen and bathroom works dominate the budget.",
              categories: [
                {
                  name: "Kitchen",
                  low: 18250.4,
                  typical: 16499.5,
                  high: 15010.2,
                  notes: "Includes cabinetry, worktops, and appliances."
                },
                {
                  name: "Bathroom",
                  low: 8450.1,
                  typical: 9100.8,
                  high: 9799.6,
                  notes: "Includes sanitaryware, tiling, and labour."
                }
              ],
              totalLow: 1,
              totalTypical: 2,
              totalHigh: 3,
              advice: "Confirm electrical capacity before finalising the scope."
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const request = new Request("http://localhost/api/v1/ai/pricing-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyType: "Terraced House",
        location: "SW1A 1AA",
        floorAreaM2: 85,
        condition: "fair",
        scope: "Refurbish the kitchen and bathroom, replace finishes, and update electrics.",
        photos: ["https://example.com/kitchen.jpg"]
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      categories: Array<{ low: number; typical: number; high: number }>;
      totalLow: number;
      totalTypical: number;
      totalHigh: number;
    };

    expect(response.status).toBe(200);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: PRICING_MODEL
      })
    );
    expect(payload.categories.map(({ low, typical, high }) => ({ low, typical, high }))).toEqual([
      {
        low: 15010,
        typical: 16500,
        high: 18250
      },
      {
        low: 8450,
        typical: 9101,
        high: 9800
      }
    ]);
    expect(payload.totalLow).toBe(23460);
    expect(payload.totalTypical).toBe(25601);
    expect(payload.totalHigh).toBe(28050);
  });

  test("returns 502 when AI payload fails schema validation", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: "Missing required fields"
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const request = new Request("http://localhost/api/v1/ai/pricing-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyType: "Flat / Apartment",
        location: "M1 1AE",
        floorAreaM2: 55,
        condition: "good",
        scope: "Refresh all internal finishes and replace the kitchen."
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      error: string;
      details?: string[];
    };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Pricing response validation failed");
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details?.length).toBeGreaterThan(0);
  });
});
