import { createServerSupabaseClient } from "@/lib/supabase/server";
import { insertTelemetryEvent } from "@/lib/supabase/telemetry-db";
import { POST } from "./route";

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn()
}));

jest.mock("@/lib/supabase/telemetry-db", () => ({
  insertTelemetryEvent: jest.fn()
}));

const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);
const mockedInsertTelemetryEvent = jest.mocked(insertTelemetryEvent);

type MockSupabaseAuthOptions = {
  userId?: string | null;
};

function mockSupabaseClient(options: MockSupabaseAuthOptions = {}) {
  const getUser = jest.fn().mockResolvedValue({
    data: {
      user: options.userId ? { id: options.userId } : null
    }
  });

  const client = {
    auth: { getUser }
  } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>;

  mockedCreateServerSupabaseClient.mockResolvedValue(client);
  return { client, getUser };
}

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/v1/telemetry", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("returns 400 when payload is invalid", async () => {
    const response = await POST(createRequest({ metadata: { route: "assistant-ui" } }));
    const payload = (await response.json()) as {
      error: string;
      details: string[];
    };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid telemetry payload");
    expect(payload.details.length).toBeGreaterThan(0);
    expect(mockedInsertTelemetryEvent).not.toHaveBeenCalled();
  });

  test("stores telemetry for anonymous user", async () => {
    const { client } = mockSupabaseClient();
    mockedInsertTelemetryEvent.mockResolvedValueOnce();

    const response = await POST(
      createRequest({
        eventName: "assistant.ui.outcome",
        properties: { route: "assistant-ui", outcome: "applied" }
      })
    );
    const payload = (await response.json()) as { success: boolean };

    expect(response.status).toBe(202);
    expect(payload.success).toBe(true);
    expect(mockedInsertTelemetryEvent).toHaveBeenCalledWith(
      {
        eventName: "assistant.ui.outcome",
        userId: null,
        properties: { route: "assistant-ui", outcome: "applied" }
      },
      client
    );
  });

  test("stores telemetry for authenticated user", async () => {
    const { client } = mockSupabaseClient({ userId: "user-123" });
    mockedInsertTelemetryEvent.mockResolvedValueOnce();

    const response = await POST(
      createRequest({
        eventName: "assistant.ui.outcome"
      })
    );

    expect(response.status).toBe(202);
    expect(mockedInsertTelemetryEvent).toHaveBeenCalledWith(
      {
        eventName: "assistant.ui.outcome",
        userId: "user-123",
        properties: {}
      },
      client
    );
  });

  test("returns 500 when telemetry insert fails", async () => {
    mockSupabaseClient();
    mockedInsertTelemetryEvent.mockRejectedValueOnce(new Error("db unavailable"));

    const response = await POST(
      createRequest({
        eventName: "assistant.ui.outcome",
        properties: { route: "assistant-ui" }
      })
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("db unavailable");
  });
});
