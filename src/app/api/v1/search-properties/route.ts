import { z } from "zod";

import { generateEmbedding } from "@/lib/embeddings";
import { getRequestId, jsonError, jsonSuccess, logError } from "@/lib/api-route";
import {
  queryPropertiesCollection,
  type QdrantFilter,
  type QdrantMatchFilter,
  type QdrantRangeFilter,
} from "@/lib/qdrant";
import { validateJsonRequest } from "@/lib/validate";

const searchPropertiesSchema = z
  .object({
    query: z.string().trim().min(3).max(500),
    limit: z.coerce.number().int().min(1).max(20).default(5),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    city: z.string().trim().min(1).max(100).optional(),
    propertyType: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((input, context) => {
    if (
      input.minPrice !== undefined &&
      input.maxPrice !== undefined &&
      input.minPrice > input.maxPrice
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minPrice"],
        message: "minPrice cannot be greater than maxPrice",
      });
    }
  });

type SearchPropertiesRequest = z.infer<typeof searchPropertiesSchema>;

type SearchProperty = {
  id: string | number;
  score: number;
} & Record<string, unknown>;

function buildFilter(input: SearchPropertiesRequest): QdrantFilter | undefined {
  const must: Array<QdrantMatchFilter | QdrantRangeFilter> = [];

  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    const range: QdrantRangeFilter["range"] = {};
    if (input.minPrice !== undefined) {
      range.gte = input.minPrice;
    }
    if (input.maxPrice !== undefined) {
      range.lte = input.maxPrice;
    }
    must.push({ key: "price", range });
  }

  if (input.city) {
    must.push({ key: "city", match: { value: input.city } });
  }

  if (input.propertyType) {
    must.push({ key: "propertyType", match: { value: input.propertyType } });
  }

  if (!must.length) {
    return undefined;
  }

  return { must };
}

function mapSearchError(error: unknown): { message: string; status: number } {
  if (!(error instanceof Error)) {
    return { message: "Property search failed", status: 500 };
  }

  if (error.message.includes("not configured")) {
    return { message: "Property search is not configured", status: 503 };
  }

  if (
    error.message.includes("OpenAI") ||
    error.message.includes("Qdrant query failed") ||
    error.message.includes("timed out")
  ) {
    return {
      message: "Property search service is temporarily unavailable",
      status: 503,
    };
  }

  return { message: "Property search failed", status: 500 };
}

export async function POST(request: Request): Promise<Response> {
  const requestId = getRequestId(request);

  try {
    const parsed = await validateJsonRequest(request, searchPropertiesSchema, {
      errorMessage: "Invalid search-properties payload",
    });

    if (!parsed.success) {
      return parsed.response;
    }

    const input = parsed.data;
    const queryVector = await generateEmbedding(input.query);
    const filter = buildFilter(input);
    const points = await queryPropertiesCollection(
      queryVector,
      input.limit,
      filter,
    );

    const properties: SearchProperty[] = points.map((point) => ({
      ...(point.payload ?? {}),
      id: point.id,
      score: point.score,
    }));

    return jsonSuccess({ properties, total: properties.length }, requestId);
  } catch (error: unknown) {
    logError("search-properties", requestId, error);

    if (error instanceof z.ZodError) {
      return jsonError("Search validation failed", requestId, 400, {
        details: error.issues.map((issue) => issue.message),
      });
    }

    const mappedError = mapSearchError(error);
    return jsonError(mappedError.message, requestId, mappedError.status);
  }
}
