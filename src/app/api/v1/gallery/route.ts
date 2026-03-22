import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { createGalleryItem, getPublicGallery } from "@/lib/supabase/gallery-db";
import { validateJsonRequest } from "@/lib/validate";
import { galleryItemCreateSchema, paginationSchema } from "@/lib/validation";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

const galleryCreateSchema = galleryItemCreateSchema;

function getPaginationFromRequest(request: NextRequest, requestId: string) {
  const params = request.nextUrl.searchParams;
  const parsed = paginationSchema.safeParse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      response: jsonError(
        "Invalid pagination parameters",
        requestId,
        400,
        { details: parsed.error.issues.map((issue) => issue.message) }
      )
    };
  }

  return { ok: true as const, data: parsed.data };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const pagination = getPaginationFromRequest(request, requestId);
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
      },
      requestId
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("gallery GET", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to fetch gallery";
    return jsonError(message, requestId);
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
    return jsonSuccess(created, requestId, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("gallery POST", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to create gallery item";
    return jsonError(message, requestId);
  }
}
