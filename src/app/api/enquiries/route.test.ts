import { createServerSupabaseClient } from "@/lib/supabase/server";
import { POST } from "./route";

jest.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: jest.fn()
}));

const mockedCreateServerSupabaseClient = jest.mocked(createServerSupabaseClient);

type MockSupabaseOptions = {
  userId?: string | null;
  insertErrorMessage?: string;
};

function mockSupabaseClient(options: MockSupabaseOptions = {}) {
  const insert = jest.fn().mockResolvedValue({
    error: options.insertErrorMessage ? { message: options.insertErrorMessage } : null
  });

  const from = jest.fn().mockReturnValue({ insert });

  const getUser = jest.fn().mockResolvedValue({
    data: {
      user: options.userId ? { id: options.userId } : null
    }
  });

  mockedCreateServerSupabaseClient.mockResolvedValue({
    auth: { getUser },
    from
  } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

  return { insert, from, getUser };
}

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/enquiries", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("POST /api/enquiries", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test("returns 400 when payload is invalid", async () => {
    const response = await POST(createRequest({ name: "Alex" }));
    const payload = (await response.json()) as {
      error: string;
      details: string[];
    };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid enquiry payload");
    expect(payload.details.length).toBeGreaterThan(0);
  });

  test("inserts enquiry and returns 201 for valid payload", async () => {
    const { from, insert } = mockSupabaseClient({ userId: "user-123" });

    const response = await POST(
      createRequest({
        name: "Alex Builder",
        email: "ALEX@EXAMPLE.COM",
        postcode: "sw1a 1aa",
        projectType: "Extension",
        budgetRange: "£50,000 - £100,000",
        estimateTotal: 85000,
        message: "Rear extension with open-plan kitchen."
      })
    );

    const payload = (await response.json()) as { success: boolean };

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(from).toHaveBeenCalledWith("contractor_enquiries");
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-123",
      name: "Alex Builder",
      email: "alex@example.com",
      postcode: "SW1A 1AA",
      project_type: "Extension",
      budget_range: "£50,000 - £100,000",
      estimate_total: 85000,
      message: "Rear extension with open-plan kitchen."
    });
  });

  test("returns 500 when supabase insert fails", async () => {
    mockSupabaseClient({ insertErrorMessage: "database unavailable" });

    const response = await POST(
      createRequest({
        name: "Alex Builder",
        email: "alex@example.com",
        postcode: "SW1A 1AA",
        projectType: "Extension",
        budgetRange: "£50,000 - £100,000",
        estimateTotal: null,
        message: ""
      })
    );

    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("Failed to submit enquiry");
  });
});
