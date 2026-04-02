import { QdrantClient } from "@qdrant/js-client-rest";

import { EMBEDDING_DIMENSIONS, generateEmbedding } from "@/lib/embeddings";
import type { EstimateInput } from "@/lib/types";
import type { EstimateResult } from "@/services/estimate";

const DEFAULT_SEARCH_LIMIT = 5;

const qdrantUrl = process.env.QDRANT_URL?.trim() ?? "";
const qdrantApiKey = process.env.QDRANT_API_KEY?.trim() ?? "";

export const ESTIMATES_COLLECTION =
  process.env.QDRANT_ESTIMATES_COLLECTION?.trim() || "estimates";
export const ESTIMATE_VECTOR_SIZE = 1536;

export type EstimateQdrantClient = Pick<
  QdrantClient,
  "getCollections" | "createCollection" | "upsert" | "search"
>;

type IndexedEstimateResult = {
  totalCost: number;
  formatted: string;
  breakdown: {
    base: number;
    multiplier: number;
  };
};

export type UpsertEstimateInput = {
  id: string | number;
  estimateInput: EstimateInput;
  estimateResult: IndexedEstimateResult;
  summary: string;
  metadata?: Record<string, unknown>;
};

export type UpsertEstimateOptions = {
  client?: EstimateQdrantClient;
  vector?: number[];
};

export type SimilarEstimateSearchInput = {
  query: string;
  limit?: number;
  minScore?: number;
  region?: string;
};

export type SimilarEstimateSearchResult = {
  id: string | number;
  score: number;
  payload: Record<string, unknown> | null;
};

type SearchPoint = {
  id: string | number;
  score: number;
  payload?: unknown;
};

let qdrantClient: QdrantClient | null = null;

function getQdrantUrl(): string {
  if (qdrantUrl.length === 0) {
    throw new Error("QDRANT_URL is not configured");
  }

  return qdrantUrl;
}

function assertEmbeddingDimensions(): void {
  if (EMBEDDING_DIMENSIONS !== ESTIMATE_VECTOR_SIZE) {
    throw new Error(
      `Embedding dimension mismatch: expected ${ESTIMATE_VECTOR_SIZE}, got ${EMBEDDING_DIMENSIONS}`,
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSearchPoint(value: unknown): value is SearchPoint {
  if (!isRecord(value)) {
    return false;
  }

  const { id, score } = value;
  const isValidId = typeof id === "string" || typeof id === "number";
  const isValidScore = typeof score === "number" && Number.isFinite(score);
  const isValidPayload = value.payload === undefined || isRecord(value.payload);

  return isValidId && isValidScore && isValidPayload;
}

function normalizeLimit(limit: number | undefined): number {
  const resolvedLimit = limit ?? DEFAULT_SEARCH_LIMIT;

  if (!Number.isInteger(resolvedLimit) || resolvedLimit <= 0) {
    throw new Error("Search limit must be a positive integer");
  }

  return resolvedLimit;
}

function normalizeVector(vector: number[]): number[] {
  if (
    vector.length !== ESTIMATE_VECTOR_SIZE ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `Estimate vector must be a finite numeric array with ${ESTIMATE_VECTOR_SIZE} dimensions`,
    );
  }

  return vector;
}

function normalizeSummary(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length === 0) {
    throw new Error("Estimate summary must be non-empty");
  }

  return trimmed;
}

function normalizeQuery(query: string): string {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new Error("Search query must be non-empty");
  }

  return trimmed;
}

function isUpsertEstimatePayload(
  value: UpsertEstimateInput | EstimateInput,
): value is UpsertEstimateInput {
  return (
    isRecord(value) &&
    "id" in value &&
    "estimateInput" in value &&
    "estimateResult" in value &&
    "summary" in value
  );
}

function isEstimateResult(value: unknown): value is EstimateResult {
  if (!isRecord(value)) {
    return false;
  }

  const formatted = value["formatted"];
  const totalCost = value["totalCost"];
  const breakdown = value["breakdown"];

  if (typeof formatted !== "string" || typeof totalCost !== "number") {
    return false;
  }

  if (!isRecord(breakdown)) {
    return false;
  }

  return (
    typeof breakdown.base === "number" &&
    typeof breakdown.multiplier === "number"
  );
}

function createEstimateSummary(input: EstimateInput, result: EstimateResult): string {
  return JSON.stringify({
    area: input.area,
    region: input.region,
    totalCost: result.totalCost,
    formatted: result.formatted,
  });
}

function getCollectionNames(
  collectionsResponse: Awaited<ReturnType<EstimateQdrantClient["getCollections"]>>,
): string[] {
  const collections = collectionsResponse.collections;

  if (!Array.isArray(collections)) {
    return [];
  }

  return collections
    .map((collection) => collection.name)
    .filter((name): name is string => typeof name === "string");
}

export function getEstimatesQdrantClient(): EstimateQdrantClient {
  assertEmbeddingDimensions();

  if (!qdrantClient) {
    qdrantClient = new QdrantClient({
      url: getQdrantUrl(),
      ...(qdrantApiKey.length > 0 ? { apiKey: qdrantApiKey } : {}),
    });
  }

  return qdrantClient;
}

export async function ensureCollection(
  client: EstimateQdrantClient = getEstimatesQdrantClient(),
): Promise<void> {
  const existingNames = getCollectionNames(await client.getCollections());

  if (existingNames.includes(ESTIMATES_COLLECTION)) {
    return;
  }

  await client.createCollection(ESTIMATES_COLLECTION, {
    vectors: {
      size: ESTIMATE_VECTOR_SIZE,
      distance: "Cosine",
    },
  });
}

async function performUpsertEstimate(
  input: UpsertEstimateInput,
  options: UpsertEstimateOptions = {},
): Promise<void> {
  const client = options.client ?? getEstimatesQdrantClient();
  const summary = normalizeSummary(input.summary);
  const vector = normalizeVector(options.vector ?? (await generateEmbedding(summary)));

  await ensureCollection(client);

  const payload: Record<string, unknown> = {
    area: input.estimateInput.area,
    region: input.estimateInput.region.trim().toLowerCase(),
    totalCost: input.estimateResult.totalCost,
    formatted: input.estimateResult.formatted,
    base: input.estimateResult.breakdown.base,
    multiplier: input.estimateResult.breakdown.multiplier,
    summary,
    ...(input.metadata ?? {}),
  };

  await client.upsert(ESTIMATES_COLLECTION, {
    points: [
      {
        id: input.id,
        vector,
        payload,
      },
    ],
  });
}

export async function upsertEstimate(
  input: UpsertEstimateInput,
  options?: UpsertEstimateOptions,
): Promise<void>;
export async function upsertEstimate(
  input: EstimateInput,
  result: EstimateResult,
): Promise<void>;
export async function upsertEstimate(
  input: UpsertEstimateInput | EstimateInput,
  second: UpsertEstimateOptions | EstimateResult = {},
): Promise<void> {
  if (isUpsertEstimatePayload(input)) {
    const options = isEstimateResult(second) ? {} : second;
    return performUpsertEstimate(input, options);
  }

  if (!isEstimateResult(second)) {
    throw new Error("Estimate result is required when upserting an estimate input");
  }

  return performUpsertEstimate({
    id: crypto.randomUUID(),
    estimateInput: input,
    estimateResult: second,
    summary: createEstimateSummary(input, second),
  });
}

export async function searchSimilarEstimates(
  input: SimilarEstimateSearchInput,
  options: {
    client?: EstimateQdrantClient;
    vector?: number[];
  } = {},
): Promise<SimilarEstimateSearchResult[]> {
  const client = options.client ?? getEstimatesQdrantClient();
  const query = normalizeQuery(input.query);
  const vector = normalizeVector(options.vector ?? (await generateEmbedding(query)));
  const limit = normalizeLimit(input.limit);

  await ensureCollection(client);

  const region = input.region?.trim().toLowerCase();
  const hasRegionFilter = typeof region === "string" && region.length > 0;

  const points = await client.search(ESTIMATES_COLLECTION, {
    vector,
    limit,
    with_payload: true,
    with_vector: false,
    ...(input.minScore !== undefined
      ? { score_threshold: input.minScore }
      : {}),
    ...(hasRegionFilter
      ? {
          filter: {
            must: [{ key: "region", match: { value: region } }],
          },
        }
      : {}),
  });

  if (!Array.isArray(points)) {
    throw new Error("Invalid Qdrant search response");
  }

  return points.filter(isSearchPoint).map((point) => ({
    id: point.id,
    score: point.score,
    payload: isRecord(point.payload) ? point.payload : null,
  }));
}

export async function searchSimilar(
  input: EstimateInput,
): Promise<SimilarEstimateSearchResult[]> {
  return searchSimilarEstimates({
    query: JSON.stringify({
      area: input.area,
      region: input.region,
    }),
    region: input.region,
  });
}
