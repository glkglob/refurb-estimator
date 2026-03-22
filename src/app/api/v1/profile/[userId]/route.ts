import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/rbac";
import { AuthError, handleAuthError } from "@/lib/supabase/auth-helpers";
import { getPublicProfile } from "@/lib/supabase/profiles-db";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(_request);

  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const { userId } = await context.params;
    const profile = await getPublicProfile(userId);

    if (!profile) {
      return jsonError("Profile not found", requestId, 404);
    }

    return jsonSuccess(profile, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("profile/[userId] GET", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to fetch public profile";
    return jsonError(message, requestId);
  }
}
