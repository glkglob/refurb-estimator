/** @jest-environment node */

import { QdrantClient } from "@qdrant/js-client-rest";

import type { EstimateQdrantClient } from "@/services/qdrant";

const runContainerSmoke = process.env.RUN_CONTAINER_SMOKE === "1";
const describeIfContainer = runContainerSmoke ? describe : describe.skip;

function createOneHotVector(size: number, hotIndex: number): number[] {
  return Array.from({ length: size }, (_, index) => (index === hotIndex ? 1 : 0));
}

function createWeightedVector(size: number): number[] {
  return Array.from({ length: size }, (_, index) => {
    if (index === 0) {
      return 0.9;
    }

    if (index === 1) {
      return 0.1;
    }

    return 0;
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function retry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      if (attempt < retries) {
        await wait(200);
      }
    }
  }

  throw (lastError instanceof Error
    ? lastError
    : new Error("Retry failed with a non-error value"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getCollectionVectorConfig(info: unknown): { size: number; distance: string } {
  if (!isRecord(info)) {
    throw new Error("Collection info is not an object");
  }

  const config = info.config;
  if (!isRecord(config)) {
    throw new Error("Collection config is missing");
  }

  const params = config.params;
  if (!isRecord(params)) {
    throw new Error("Collection params are missing");
  }

  const vectors = params.vectors;
  if (!isRecord(vectors)) {
    throw new Error("Collection vectors config is missing");
  }

  const size = vectors.size;
  const distance = vectors.distance;

  if (typeof size !== "number" || !Number.isFinite(size)) {
    throw new Error("Collection vectors size is invalid");
  }

  if (typeof distance !== "string" || distance.length === 0) {
    throw new Error("Collection vectors distance is invalid");
  }

  return {
    size,
    distance,
  };
}

describeIfContainer("Qdrant container smoke", () => {
  const qdrantUrl = process.env.QDRANT_URL ?? "http://127.0.0.1:6333";
  const collectionName = `estimates_test_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const originalQdrantUrl = process.env.QDRANT_URL;
  const originalEstimatesCollection = process.env.QDRANT_ESTIMATES_COLLECTION;

  let client: QdrantClient;
  let qdrantService: typeof import("@/services/qdrant");
  let estimateClient: EstimateQdrantClient;

  beforeAll(async () => {
    process.env.QDRANT_URL = qdrantUrl;
    process.env.QDRANT_ESTIMATES_COLLECTION = collectionName;

    client = new QdrantClient({ url: qdrantUrl });
    estimateClient = client as unknown as EstimateQdrantClient;

    await retry(async () => {
      await client.getCollections();
    }, 5);

    jest.resetModules();
    qdrantService = await import("@/services/qdrant");
  });

  afterAll(async () => {
    try {
      await client.deleteCollection(collectionName);
    } catch (error: unknown) {
      console.warn("Failed to delete Qdrant smoke collection", {
        collectionName,
        error,
      });
    }

    if (originalQdrantUrl === undefined) {
      delete process.env.QDRANT_URL;
    } else {
      process.env.QDRANT_URL = originalQdrantUrl;
    }

    if (originalEstimatesCollection === undefined) {
      delete process.env.QDRANT_ESTIMATES_COLLECTION;
    } else {
      process.env.QDRANT_ESTIMATES_COLLECTION = originalEstimatesCollection;
    }
  });

  test("ensures estimates collection, upserts vectors, and finds similar estimate", async () => {
    await qdrantService.ensureCollection(estimateClient);

    const collectionsResponse = await client.getCollections();
    const collectionNames = Array.isArray(collectionsResponse.collections)
      ? collectionsResponse.collections
          .map((collection) => collection.name)
          .filter((name): name is string => typeof name === "string")
      : [];

    expect(collectionNames).toContain(qdrantService.ESTIMATES_COLLECTION);

    const collectionInfo = await client.getCollection(collectionName);
    const vectorConfig = getCollectionVectorConfig(collectionInfo);

    expect(vectorConfig.size).toBe(768);
    expect(vectorConfig.distance).toBe("Cosine");

    const londonVector = createOneHotVector(qdrantService.ESTIMATE_VECTOR_SIZE, 0);
    const blendedLondonVector = createWeightedVector(qdrantService.ESTIMATE_VECTOR_SIZE);

    const firstId = 10_001;
    const secondId = 10_002;

    await qdrantService.upsertEstimate(
      {
        id: firstId,
        estimateInput: {
          area: 95,
          region: "london",
        },
        estimateResult: {
          totalCost: 142500,
          formatted: "£142,500.00",
          breakdown: {
            base: 114000,
            multiplier: 1.25,
          },
        },
        summary: "london 95m2 full refurb estimate",
      },
      {
        client: estimateClient,
        vector: londonVector,
      },
    );

    await qdrantService.upsertEstimate(
      {
        id: secondId,
        estimateInput: {
          area: 100,
          region: "london",
        },
        estimateResult: {
          totalCost: 150000,
          formatted: "£150,000.00",
          breakdown: {
            base: 120000,
            multiplier: 1.25,
          },
        },
        summary: "london 100m2 premium refurb estimate",
      },
      {
        client: estimateClient,
        vector: blendedLondonVector,
      },
    );

    const results = await retry(async () => {
      const searchResults = await qdrantService.searchSimilarEstimates(
        {
          query: "london refurb estimate",
          limit: 3,
          region: "london",
        },
        {
          client: estimateClient,
          vector: londonVector,
        },
      );

      if (searchResults.length === 0) {
        throw new Error("No search results returned yet");
      }

      return searchResults;
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.some((result) => result.payload?.region === "london")).toBe(true);

    const ids = results.map((result) => result.id);
    expect(ids).toEqual(expect.arrayContaining([firstId, secondId]));

    const firstScore = results[0]?.score;
    if (typeof firstScore === "number") {
      expect(firstScore).toBeGreaterThan(0);
    }
  });
});
