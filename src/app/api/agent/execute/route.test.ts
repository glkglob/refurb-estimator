import { POST } from "./route";

describe("POST /api/agent/execute", () => {
  test("returns 400 when message is missing", async () => {
    const request = new Request("http://localhost/api/agent/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      error: string;
      details: string[];
    };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid request body");
    expect(payload.details.some((detail) => detail.toLowerCase().includes("message"))).toBe(true);
  });

  test("returns 200 for valid payload", async () => {
    const request = new Request("http://localhost/api/agent/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "hello from test",
        state: { phase: "draft" }
      })
    });

    const response = await POST(request);
    const payload = (await response.json()) as {
      output: string;
      actions: unknown[];
      logs: unknown[];
    };

    expect(response.status).toBe(200);
    expect(payload.output).toBe("AI response to: hello from test");
    expect(payload.actions).toEqual([]);
    expect(payload.logs).toEqual([]);
  });
});
