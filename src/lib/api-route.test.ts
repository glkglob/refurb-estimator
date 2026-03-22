import { getRequestId, jsonSuccess, jsonError, logError } from "./api-route";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", {
    headers: new Headers(headers)
  });
}

describe("getRequestId", () => {
  test("returns x-request-id header when present", () => {
    const request = makeRequest({ "x-request-id": "abc-123" });
    expect(getRequestId(request)).toBe("abc-123");
  });

  test("generates a UUID when x-request-id header is absent", () => {
    const request = makeRequest();
    const id = getRequestId(request);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test("generates unique IDs for different requests", () => {
    const id1 = getRequestId(makeRequest());
    const id2 = getRequestId(makeRequest());
    expect(id1).not.toBe(id2);
  });
});

describe("jsonSuccess", () => {
  test("returns JSON body with correct status", async () => {
    const response = jsonSuccess({ ok: true }, "req-1");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true });
  });

  test("includes x-request-id header", () => {
    const response = jsonSuccess({ ok: true }, "req-1");
    expect(response.headers.get("x-request-id")).toBe("req-1");
  });

  test("supports custom status codes", async () => {
    const response = jsonSuccess({ created: true }, "req-2", 201);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ created: true });
  });
});

describe("jsonError", () => {
  test("returns error JSON with status 500 by default", async () => {
    const response = jsonError("Something went wrong", "req-3");
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ error: "Something went wrong" });
  });

  test("includes x-request-id header", () => {
    const response = jsonError("fail", "req-4");
    expect(response.headers.get("x-request-id")).toBe("req-4");
  });

  test("supports custom status codes", async () => {
    const response = jsonError("Not found", "req-5", 404);
    expect(response.status).toBe(404);
  });

  test("merges extra fields into response body", async () => {
    const response = jsonError("Validation failed", "req-6", 400, {
      details: ["field is required"]
    });
    const body = await response.json();
    expect(body).toEqual({
      error: "Validation failed",
      details: ["field is required"]
    });
  });
});

describe("logError", () => {
  let consoleSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test("logs structured JSON with route and requestId", () => {
    logError("test-route", "req-7", new Error("boom"));
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.level).toBe("error");
    expect(logged.route).toBe("test-route");
    expect(logged.requestId).toBe("req-7");
    expect(logged.message).toBe("boom");
    expect(logged.stack).toBeDefined();
  });

  test("handles non-Error values", () => {
    logError("test-route", "req-8", "string error");
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.message).toBe("string error");
    expect(logged.stack).toBeUndefined();
  });

  test("includes extra context", () => {
    logError("test-route", "req-9", new Error("fail"), { userId: "u-1" });
    const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(logged.userId).toBe("u-1");
  });
});
