import { POST } from "./route";
import { aiClient, PRICING_MODEL } from "@/lib/ai/client";

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

type MockedCreateFn = jest.MockedFunction<typeof aiClient.chat.completions.create>;
const mockedCreate = aiClient.chat.completions.create as MockedCreateFn;

describe("POST /api/v1/ai/design-agent", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedCreate.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/v1/ai/design-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        roomType: "Kitchen",
        style: "Modern",
        budget: "£15k-£30k"
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid design-agent payload");
  });

  test("uses shared AI model and normalizes successful responses", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              currentAssessment: "The room has good natural light but dated finishes.",
              designConcept: "Create a warm modern living room with textured layers.",
              colourPalette: [
                { name: "Warm White", hex: "#f4f1ea", usage: "Walls" },
                { name: "Charcoal", hex: "#2b2b2b", usage: "Accents" },
                { name: "Olive", hex: "#7a8450", usage: "Soft furnishings" }
              ],
              materialRecommendations: [
                {
                  item: "Engineered oak flooring",
                  description: "Durable plank flooring for living spaces",
                  supplier: "Flooring Superstore",
                  estimatedCost: 2299.49
                },
                {
                  item: "Matte wall paint",
                  description: "Low-sheen washable paint",
                  supplier: "Dulux",
                  estimatedCost: 180.11
                },
                {
                  item: "Feature pendant light",
                  description: "Black metal fixture for dining corner",
                  supplier: "John Lewis",
                  estimatedCost: 259.92
                }
              ],
              roomTransformation: "The updated layout improves flow and focal balance.",
              estimatedCost: { low: 18750.9, typical: 16220.2, high: 15010.4 },
              nextSteps: ["  Confirm electrician scope  ", "Order material samples", "Book decorator"]
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const request = new Request("http://localhost/api/v1/ai/design-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        photos: ["https://example.com/living-room.jpg"],
        roomType: "Living Room",
        style: "Contemporary",
        budget: "£15k-£30k",
        requirements: "Keep a reading corner and improve lighting."
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      estimatedCost: { low: number; typical: number; high: number };
      colourPalette: Array<{ name: string; hex: string; usage: string }>;
      materialRecommendations: Array<{ estimatedCost: number }>;
      nextSteps: string[];
    };

    expect(response.status).toBe(200);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: PRICING_MODEL
      })
    );
    expect(payload.estimatedCost).toEqual({
      low: 15010,
      typical: 16220,
      high: 18751
    });
    expect(payload.colourPalette[0]?.hex).toBe("#F4F1EA");
    expect(payload.materialRecommendations.map((item) => item.estimatedCost)).toEqual([
      2299,
      180,
      260
    ]);
    expect(payload.nextSteps).toEqual([
      "Confirm electrician scope",
      "Order material samples",
      "Book decorator"
    ]);
  });

  test("returns 502 when AI payload fails schema validation", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              designConcept: "Missing required fields"
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const request = new Request("http://localhost/api/v1/ai/design-agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        photos: ["https://example.com/bedroom.jpg"],
        roomType: "Bedroom",
        style: "Scandinavian",
        budget: "£5k-£15k",
        requirements: ""
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      error: string;
      details?: string[];
    };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("AI design response validation failed");
    expect(Array.isArray(payload.details)).toBe(true);
    expect(payload.details?.length).toBeGreaterThan(0);
  });
});
