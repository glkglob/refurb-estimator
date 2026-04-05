import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const vector = Array.from({ length: 768 }, (_, index) => index / 1000);

const qdrantClientMock = {
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  upsert: vi.fn(),
  search: vi.fn(),
};

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: vi.fn(function MockQdrantClient() {
    return qdrantClientMock;
  }),
}));

vi.mock("@/lib/embeddings", () => ({
  EMBEDDING_DIMENSIONS: 768,
  generateEmbedding: vi.fn(async () => vector),
}));

const originalQdrantUrl = process.env.QDRANT_URL;
const originalQdrantApiKey = process.env.QDRANT_API_KEY;

function resetClientMocks(): void {
  qdrantClientMock.getCollections.mockReset();
  qdrantClientMock.createCollection.mockReset();
  qdrantClientMock.upsert.mockReset();
  qdrantClientMock.search.mockReset();
}

async function loadQdrantService() {
  vi.resetModules();
  return import("@/services/qdrant");
}

describe("services/qdrant spec adapters", () => {
  beforeEach(() => {
    process.env.QDRANT_URL = "http://localhost:6333";
    process.env.QDRANT_API_KEY = "";
    resetClientMocks();
  });

  afterEach(() => {
    process.env.QDRANT_URL = originalQdrantUrl;
    process.env.QDRANT_API_KEY = originalQdrantApiKey;
  });

  it("upserts an estimate via the two-argument adapter", async () => {
    qdrantClientMock.getCollections.mockResolvedValue({
      collections: [{ name: "estimates" }],
    });
    qdrantClientMock.upsert.mockResolvedValue({});

    const { upsertEstimate } = await loadQdrantService();

    await upsertEstimate(
      {
        area: 50,
        region: "london",
      },
      {
        totalCost: 75000,
        formatted: "£75,000.00",
        breakdown: {
          base: 60000,
          multiplier: 1.25,
        },
      },
    );

    expect(qdrantClientMock.upsert).toHaveBeenCalledTimes(1);
    expect(qdrantClientMock.upsert).toHaveBeenCalledWith(
      "estimates",
      expect.objectContaining({
        points: [
          expect.objectContaining({
            payload: expect.objectContaining({
              area: 50,
              region: "london",
              totalCost: 75000,
            }),
          }),
        ],
      }),
    );
  });

  it("throws when the adapter is used without QDRANT_URL configured", async () => {
    process.env.QDRANT_URL = "";

    const { upsertEstimate } = await loadQdrantService();

    await expect(
      upsertEstimate(
        {
          area: 50,
          region: "london",
        },
        {
          totalCost: 75000,
          formatted: "£75,000.00",
          breakdown: {
            base: 60000,
            multiplier: 1.25,
          },
        },
      ),
    ).rejects.toThrow("QDRANT_URL is not configured");
  });

  it("searches similar estimates using the input adapter and normalizes the region", async () => {
    qdrantClientMock.getCollections.mockResolvedValue({
      collections: [{ name: "estimates" }],
    });
    qdrantClientMock.search.mockResolvedValue([
      {
        id: "estimate-1",
        score: 0.9,
        payload: { region: "london" },
      },
    ]);

    const { searchSimilar } = await loadQdrantService();
    const results = await searchSimilar({
      area: 50,
      region: "London",
    });

    expect(qdrantClientMock.search).toHaveBeenCalledWith(
      "estimates",
      expect.objectContaining({
        filter: {
          must: [{ key: "region", match: { value: "london" } }],
        },
      }),
    );
    expect(results).toEqual([
      {
        id: "estimate-1",
        score: 0.9,
        payload: { region: "london" },
      },
    ]);
  });
});
