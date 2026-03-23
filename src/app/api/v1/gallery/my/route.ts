import { type NextRequest } from "next/server";
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
import { getGalleryItemsByUser } from "@/lib/supabase/gallery-db";
import { paginationSchema } from "@/lib/validation";

const ROUTE_TAG = "api/v1/gallery/my";

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const parsed = paginationSchema.safeParse({
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      return jsonError("Invalid pagination parameters", requestId, 400);
    }

    const result = await getGalleryItemsByUser(user.id, {
      page: parsed.data.page,
      limit: parsed.data.limit
    });

    return jsonSuccess(
      {
        data: result.data,
        total: result.total,
        page: parsed.data.page,
        limit: parsed.data.limit
      }, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch user gallery";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
  }
}
