import "server-only";

export type QdrantMatchFilter = {
  key: string;
  match: {
    value: string;
  };
};

export type QdrantRangeFilter = {
  key: string;
  range: {
    gte?: number;
    lte?: number;
  };
};

export type QdrantFilter = {
  must: Array<QdrantMatchFilter | QdrantRangeFilter>;
};

export type QdrantSearchPoint = {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
};

type QdrantQueryResponse = {
  result?:
    | {
        points?: unknown[];
      }
    | unknown[];
};

const QDRANT_TIMEOUT_MS = 10_000;

const qdrantUrl = process.env.QDRANT_URL?.trim() ?? "";
const qdrantApiKey = process.env.QDRANT_API_KEY?.trim() ?? "";

export const PROPERTIES_COLLECTION =
  process.env.QDRANT_PROPERTIES_COLLECTION?.trim() || "properties";

function getQdrantBaseUrl(): string {
  if (qdrantUrl.length === 0) {
    throw new Error("QDRANT_URL is not configured");
  }

  return qdrantUrl.replace(/\/+$/, "");
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isQdrantSearchPoint(value: unknown): value is QdrantSearchPoint {
  if (!isObjectRecord(value)) {
    return false;
  }

  const hasValidId =
    typeof value.id === "string" || typeof value.id === "number";
  const hasValidScore =
    typeof value.score === "number" && Number.isFinite(value.score);
  const hasValidPayload =
    value.payload === undefined || isObjectRecord(value.payload);

  return hasValidId && hasValidScore && hasValidPayload;
}

function parsePoints(responseBody: QdrantQueryResponse): QdrantSearchPoint[] {
  if (Array.isArray(responseBody.result)) {
    return responseBody.result.filter(isQdrantSearchPoint);
  }

  if (
    isObjectRecord(responseBody.result) &&
    Array.isArray(responseBody.result.points)
  ) {
    return responseBody.result.points.filter(isQdrantSearchPoint);
  }

  return [];
}

export async function queryPropertiesCollection(
  queryVector: number[],
  limit: number,
  filter?: QdrantFilter,
): Promise<QdrantSearchPoint[]> {
  if (
    queryVector.length === 0 ||
    queryVector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("Qdrant query vector is invalid");
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("Qdrant query limit must be a positive integer");
  }

  const endpoint = `${getQdrantBaseUrl()}/collections/${encodeURIComponent(PROPERTIES_COLLECTION)}/points/query`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (qdrantApiKey.length > 0) {
    headers["api-key"] = qdrantApiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), QDRANT_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({
        query: queryVector,
        filter,
        limit,
        with_payload: true,
        with_vector: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant query failed with status ${response.status}`);
    }

    const responseBody = (await response.json()) as QdrantQueryResponse;
    return parsePoints(responseBody);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Qdrant query timed out");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
