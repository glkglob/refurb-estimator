import { POST } from "./route";
import { aiClient } from "@/lib/ai/client";

jest.mock("@/lib/ai/client", () => ({
  aiClient: {
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }
}));

type MockedCreateFn = jest.MockedFunction<typeof aiClient.chat.completions.create>;
const mockedCreate = aiClient.chat.completions.create as MockedCreateFn;

describe("POST /api/v1/assistant/chat", () => {
  let consoleInfoSpy: jest.SpyInstance;

  beforeEach(() => {
    mockedCreate.mockReset();
    consoleInfoSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
  });

  test("returns 400 for invalid payload", async () => {
    const request = new Request("http://localhost/api/v1/assistant/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agent: "chat", mode: "rooms" })
    });

    const response = await POST(request);
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid assistant payload");
  });

  test("returns chat response parsed to schema", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply: "Kitchen and bathroom are your largest cost drivers.",
              suggestions: ["Collect two more contractor quotes."],
              actions: []
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const request = new Request("http://localhost/api/v1/assistant/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "chat",
        mode: "rooms",
        message: "Why is this expensive?",
        estimateInput: { rooms: [{ roomType: "Kitchen", areaM2: 20 }] },
        estimateResult: { totalTypical: 52000 }
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as { reply: string; actions: unknown[] };

    expect(response.status).toBe(200);
    expect(payload.reply).toContain("largest cost drivers");
    expect(payload.actions).toEqual([]);

    const completionPayload = mockedCreate.mock.calls[0]?.[0] as unknown as Record<
      string,
      unknown
    >;
    if (process.env.AI_PROVIDER === "lmstudio") {
      expect(completionPayload).not.toHaveProperty("response_format");
    } else {
      expect(completionPayload).toEqual(
        expect.objectContaining({
          response_format: { type: "json_object" }
        })
      );
    }
  });

  test("filters unsupported editor fields and enforces recalculate at the end", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply: "Adjusted financing assumptions.",
              actions: [
                {
                  type: "update_fields",
                  fields: {
                    bridgingRateMonthlyPercent: 0.9,
                    unsupportedField: true
                  }
                },
                { type: "add_room", room: { roomType: "Kitchen" } }
              ]
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const request = new Request("http://localhost/api/v1/assistant/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "editor",
        mode: "development",
        message: "Lower the finance cost assumptions."
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      actions: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(payload.actions).toEqual([
      {
        type: "update_fields",
        fields: {
          bridgingRateMonthlyPercent: 0.9
        }
      },
      {
        type: "recalculate"
      }
    ]);
  });

  test("sanitizes copilot suggestedActions using mode whitelist", async () => {
    mockedCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              reply: "Consider reducing overall spec before tendering.",
              nextSteps: ["Run one low-spec scenario."],
              suggestedActions: [
                {
                  type: "update_fields",
                  fields: {
                    spec: "standard",
                    notAllowed: 1
                  }
                }
              ]
            })
          }
        }
      ]
    } as Awaited<ReturnType<typeof aiClient.chat.completions.create>>);

    const request = new Request("http://localhost/api/v1/assistant/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agent: "copilot",
        mode: "new_build",
        message: "Give me a lower-cost scenario."
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      suggestedActions: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(payload.suggestedActions).toEqual([
      {
        type: "update_fields",
        fields: {
          spec: "standard"
        }
      },
      {
        type: "recalculate"
      }
    ]);
  });
});
