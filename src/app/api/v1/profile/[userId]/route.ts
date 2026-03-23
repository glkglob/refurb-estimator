import { type NextRequest } from "next/server";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
import { requireRole } from "@/lib/rbac";
import { AuthError, handleAuthError } from "@/lib/supabase/auth-helpers";
import { getPublicProfile } from "@/lib/supabase/profiles-db";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

const ROUTE_TAG = "api/v1/profile/[userId]";

export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(_request);

  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const { userId } = await context.params;
    const profile = await getPublicProfile(userId);

    if (!profile) {
      return jsonError({
        status: 404,
        error: "Profile not found",
        requestId,
        code: "PUBLIC_PROFILE_NOT_FOUND"
      });
    }

    return jsonSuccess(profile, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch public profile";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "PUBLIC_PROFILE_GET_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "PUBLIC_PROFILE_GET_FAILED"
    });
  }
}
