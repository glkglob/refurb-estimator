import { generateEmbedding } from "@/lib/embeddings";
import {
  ESTIMATES_COLLECTION,
  ESTIMATE_VECTOR_SIZE,
  type EstimateQdrantClient,
  ensureCollection,
  searchSimilarEstimates,
  upsertEstimate,
} from "@/services/qdrant";

jest.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: jest.fn(),
}));

jest.mock("@/lib/embeddings", () => ({
  EMBEDDING_DIMENSIONS: 768,
  generateEmbedding: jest.fn(),
}));

type QdrantClientMock = {
  getCollections: jest.Mock;
  createCollection: jest.Mock;
  upsert: jest.Mock;
  search: jest.Mock;
};

function createVector(): number[] {
  return Array.from({ length: ESTIMATE_VECTOR_SIZE }, (_, index) => index / 1000);
}

function createQdrantClientMock(): QdrantClientMock {
  return {
    getCollections: jest.fn(),
    createCollection: jest.fn(),
    upsert: jest.fn(),
    search: jest.fn(),
  };
}

const mockedGenerateEmbedding = generateEmbedding as jest.MockedFunction<
  typeof generateEmbedding
>;

describe("services/qdrant integration contract", () => {
  beforeEach(() => {
    mockedGenerateEmbedding.mockReset();
  });

  test("returns early when collection already exists and ignores invalid collection responses", async () => {
    const existingClient = createQdrantClientMock();
    existingClient.getCollections.mockResolvedValue({
      collections: [{ name: ESTIMATES_COLLECTION }],
    });

    await ensureCollection(existingClient as unknown as EstimateQdrantClient);
    expect(existingClient.createCollection).not.toHaveBeenCalled();

    const invalidCollectionsClient = createQdrantClientMock();
    invalidCollectionsClient.getCollections.mockResolvedValue({
      collections: null,
    });

    await ensureCollection(invalidCollectionsClient as unknown as EstimateQdrantClient);
    expect(invalidCollectionsClient.createCollection).toHaveBeenCalledTimes(1);
  });

  test("creates the estimates collection when it does not exist", async () => {
    const client = createQdrantClientMock();
    client.getCollections.mockResolvedValue({
      collections: [{ name: "properties" }],
    });
    client.createCollection.mockResolvedValue({});

    await ensureCollection(client as unknown as EstimateQdrantClient);

    expect(client.createCollection).toHaveBeenCalledWith(ESTIMATES_COLLECTION, {
      vectors: {
        size: ESTIMATE_VECTOR_SIZE,
        distance: "Cosine",
      },
    });
  });

  test("upserts estimate vectors with payload in the dedicated collection", async () => {
    const client = createQdrantClientMock();
    const vector = createVector();

    client.getCollections.mockResolvedValue({
      collections: [{ name: ESTIMATES_COLLECTION }],
    });
    client.upsert.mockResolvedValue({});
    mockedGenerateEmbedding.mockResolvedValue(vector);

    await upsertEstimate(
      {
        id: "estimate-1",
        estimateInput: {
          area: 120,
          region: "london",
        },
        estimateResult: {
          totalCost: 180000,
          formatted: "£180,000.00",
          breakdown: {
            base: 144000,
            multiplier: 1.25,
          },
        },
        summary: "london 120m2 total £180,000.00",
      },
      {
        client: client as unknown as EstimateQdrantClient,
      },
    );

    expect(client.upsert).toHaveBeenCalledTimes(1);
    expect(client.upsert).toHaveBeenCalledWith(
      ESTIMATES_COLLECTION,
      expect.objectContaining({
        points: [
          expect.objectContaining({
            id: "estimate-1",
            vector,
            payload: expect.objectContaining({
              area: 120,
              region: "london",
              totalCost: 180000,
            }),
          }),
        ],
      }),
    );
  });

  test("builds similarity search requests with region filter and 768-dim vectors", async () => {
    const client = createQdrantClientMock();
    const vector = createVector();

    client.getCollections.mockResolvedValue({
      collections: [{ name: ESTIMATES_COLLECTION }],
    });
    client.search.mockResolvedValue([
      {
        id: "estimate-2",
        score: 0.92,
        payload: {
          region: "london",
          totalCost: 200000,
        },
      },
    ]);
    mockedGenerateEmbedding.mockResolvedValue(vector);

    const results = await searchSimilarEstimates(
      {
        query: "london 130m2 estimate around £200k",
        limit: 3,
        region: "london",
      },
      {
        client: client as unknown as EstimateQdrantClient,
      },
    );

    expect(client.search).toHaveBeenCalledTimes(1);
    expect(client.search).toHaveBeenCalledWith(
      ESTIMATES_COLLECTION,
      expect.objectContaining({
        limit: 3,
        vector,
        filter: {
          must: [{ key: "region", match: { value: "london" } }],
        },
      }),
    );
    expect(results).toEqual([
      {
        id: "estimate-2",
        score: 0.92,
        payload: {
          region: "london",
          totalCost: 200000,
        },
      },
    ]);
  });

  test("throws for invalid summary, query, limit and vector dimensions", async () => {
    const client = createQdrantClientMock();
    const vector = createVector();

    client.getCollections.mockResolvedValue({
      collections: [{ name: ESTIMATES_COLLECTION }],
    });
    mockedGenerateEmbedding.mockResolvedValue(vector);

    await expect(
      upsertEstimate(
        {
          id: "estimate-invalid-summary",
          estimateInput: {
            area: 120,
            region: "london",
          },
          estimateResult: {
            totalCost: 180000,
            formatted: "£180,000.00",
            breakdown: {
              base: 144000,
              multiplier: 1.25,
            },
          },
          summary: "   ",
        },
        { client: client as unknown as EstimateQdrantClient },
      ),
    ).rejects.toThrow("Estimate summary must be non-empty");

    await expect(
      upsertEstimate(
        {
          id: "estimate-invalid-vector",
          estimateInput: {
            area: 120,
            region: "london",
          },
          estimateResult: {
            totalCost: 180000,
            formatted: "£180,000.00",
            breakdown: {
              base: 144000,
              multiplier: 1.25,
            },
          },
          summary: "Valid summary",
        },
        {
          client: client as unknown as EstimateQdrantClient,
          vector: [0.1, 0.2],
        },
      ),
    ).rejects.toThrow(`Estimate vector must be a finite numeric array with ${ESTIMATE_VECTOR_SIZE} dimensions`);

    await expect(
      searchSimilarEstimates(
        {
          query: "  ",
        },
        {
          client: client as unknown as EstimateQdrantClient,
          vector,
        },
      ),
    ).rejects.toThrow("Search query must be non-empty");

    await expect(
      searchSimilarEstimates(
        {
          query: "valid query",
          limit: 0,
        },
        {
          client: client as unknown as EstimateQdrantClient,
          vector,
        },
      ),
    ).rejects.toThrow("Search limit must be a positive integer");
  });

  test("filters invalid search points and supports score thresholds", async () => {
    const client = createQdrantClientMock();
    const vector = createVector();

    client.getCollections.mockResolvedValue({
      collections: [{ name: ESTIMATES_COLLECTION }],
    });
    client.search.mockResolvedValue([
      null,
      {
        id: "estimate-3",
        score: 0.81,
        payload: {
          region: "midlands",
        },
      },
    ]);
    mockedGenerateEmbedding.mockResolvedValue(vector);

    const results = await searchSimilarEstimates(
      {
        query: "midlands estimate",
        minScore: 0.75,
      },
      {
        client: client as unknown as EstimateQdrantClient,
      },
    );

    expect(client.search).toHaveBeenCalledWith(
      ESTIMATES_COLLECTION,
      expect.objectContaining({
        score_threshold: 0.75,
      }),
    );
    expect(results).toEqual([
      {
        id: "estimate-3",
        score: 0.81,
        payload: {
          region: "midlands",
        },
      },
    ]);
  });

  test("creates a client from env and enforces embedding dimensions", async () => {
    const originalUrl = process.env.QDRANT_URL;
    const originalApiKey = process.env.QDRANT_API_KEY;

    try {
      process.env.QDRANT_URL = "http://localhost:6333";
      process.env.QDRANT_API_KEY = "test-key";

      jest.resetModules();
      const qdrantClientConstructor = jest.fn(() => ({}));
      jest.doMock("@qdrant/js-client-rest", () => ({
        QdrantClient: qdrantClientConstructor,
      }));
      jest.doMock("@/lib/embeddings", () => ({
        EMBEDDING_DIMENSIONS: 768,
        generateEmbedding: jest.fn(),
      }));

      await jest.isolateModulesAsync(async () => {
        const isolatedModule = (await import("@/services/qdrant")) as {
          getEstimatesQdrantClient: () => unknown;
        };
        isolatedModule.getEstimatesQdrantClient();
      });

      expect(qdrantClientConstructor).toHaveBeenCalledWith({
        url: "http://localhost:6333",
        apiKey: "test-key",
      });

      jest.resetModules();
      jest.doMock("@qdrant/js-client-rest", () => ({
        QdrantClient: jest.fn(),
      }));
      jest.doMock("@/lib/embeddings", () => ({
        EMBEDDING_DIMENSIONS: 768,
        generateEmbedding: jest.fn(),
      }));

      delete process.env.QDRANT_URL;
      await jest.isolateModulesAsync(async () => {
        const isolatedModule = (await import("@/services/qdrant")) as {
          getEstimatesQdrantClient: () => unknown;
        };

        expect(() => isolatedModule.getEstimatesQdrantClient()).toThrow(
          "QDRANT_URL is not configured",
        );
      });
    } finally {
      jest.resetModules();
      if (originalUrl === undefined) {
        delete process.env.QDRANT_URL;
      } else {
        process.env.QDRANT_URL = originalUrl;
      }

      if (originalApiKey === undefined) {
        delete process.env.QDRANT_API_KEY;
      } else {
        process.env.QDRANT_API_KEY = originalApiKey;
      }
    }
  });
});
