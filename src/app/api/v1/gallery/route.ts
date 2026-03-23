import { NextResponse, type NextRequest } from "next/server";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { createGalleryItem, getPublicGallery } from "@/lib/supabase/gallery-db";
import { validateJsonRequest } from "@/lib/validate";
import { galleryItemCreateSchema, paginationSchema } from "@/lib/validation";

const galleryCreateSchema = galleryItemCreateSchema;
const ROUTE_TAG = "api/v1/gallery";

function getPaginationFromRequest(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = paginationSchema.safeParse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Invalid pagination parameters",
          details: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      )
    };
  }

  return { ok: true as const, data: parsed.data };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const pagination = getPaginationFromRequest(request);
    if (!pagination.ok) {
      return pagination.response;
    }

    const projectType = request.nextUrl.searchParams.get("projectType") ?? undefined;
    const result = await getPublicGallery({
      page: pagination.data.page,
      limit: pagination.data.limit,
      projectType
    });

    return jsonSuccess(
      {
        data: result.data,
        total: result.total,
        page: pagination.data.page,
        limit: pagination.data.limit
      }, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch gallery";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const parsed = await validateJsonRequest(request, galleryCreateSchema, {
      errorMessage: "Invalid gallery item payload"
    });
    if (!parsed.success) {
      return parsed.response;
    }

    const created = await createGalleryItem(user.id, parsed.data);
    return jsonSuccess(created, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to create gallery item";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
  }
}
