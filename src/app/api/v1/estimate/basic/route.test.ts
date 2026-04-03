import { POST } from "./route";
import { calculateEstimate, type EstimateResult } from "@/services/estimate";
import { upsertEstimate } from "@/services/qdrant";

jest.mock("@/services/estimate", () => ({
  calculateEstimate: jest.fn(),
}));

jest.mock("@/services/qdrant", () => ({
  upsertEstimate: jest.fn(),
}));

const mockedCalculateEstimate = jest.mocked(calculateEstimate);
const mockedUpsertEstimate = jest.mocked(upsertEstimate);

function createJsonRequest(body: string): Request {
  return new Request("http://localhost/api/v1/estimate/basic", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /api/v1/estimate/basic", () => {
  const estimateResult: EstimateResult = {
    totalCost: 112_500,
    formatted: "£112,500.00",
    breakdown: {
      base: 90_000,
      multiplier: 1.25,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedCalculateEstimate.mockReturnValue(estimateResult);
    mockedUpsertEstimate.mockResolvedValue(undefined);
  });

  test("returns 400 for invalid JSON bodies", async () => {
    const response = await POST(createJsonRequest("{"));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload).toEqual({ error: "Invalid JSON body" });
    expect(mockedCalculateEstimate).not.toHaveBeenCalled();
    expect(mockedUpsertEstimate).not.toHaveBeenCalled();
  });

  test("returns 400 when the canonical contract payload is invalid", async () => {
    const response = await POST(createJsonRequest(JSON.stringify({ area: 0, region: "" })));
    const payload = (await response.json()) as { error: string; issues: Array<{ path: string[] }> };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("VALIDATION_ERROR");
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["area"] }),
        expect.objectContaining({ path: ["region"] }),
      ]),
    );
    expect(mockedCalculateEstimate).not.toHaveBeenCalled();
    expect(mockedUpsertEstimate).not.toHaveBeenCalled();
  });

  test("returns the real route wrapper and marks the estimate as indexed on success", async () => {
    const response = await POST(createJsonRequest(JSON.stringify({ area: 75, region: "london" })));
    const payload = (await response.json()) as {
      input: { area: number; region: string };
      result: EstimateResult;
      indexed: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      input: { area: 75, region: "london" },
      result: estimateResult,
      indexed: true,
    });
    expect(mockedCalculateEstimate).toHaveBeenCalledWith({ area: 75, region: "london" });
    expect(mockedUpsertEstimate).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateInput: { area: 75, region: "london" },
        estimateResult,
        summary: "Estimate region=london area=75 total=£112,500.00",
      }),
    );
  });

  test("keeps the response successful when Qdrant is not configured", async () => {
    mockedUpsertEstimate.mockRejectedValueOnce(new Error("QDRANT_URL is not configured"));

    const response = await POST(createJsonRequest(JSON.stringify({ area: 75, region: "london" })));
    const payload = (await response.json()) as {
      input: { area: number; region: string };
      result: EstimateResult;
      indexed: boolean;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      input: { area: 75, region: "london" },
      result: estimateResult,
      indexed: false,
    });
  });

  test("returns 500 for unexpected Qdrant failures", async () => {
    mockedUpsertEstimate.mockRejectedValueOnce(new Error("Qdrant unavailable"));

    const response = await POST(createJsonRequest(JSON.stringify({ area: 75, region: "london" })));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Qdrant unavailable" });
  });
});
