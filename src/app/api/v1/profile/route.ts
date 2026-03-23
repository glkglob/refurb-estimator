import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
import { requireRole } from "@/lib/rbac";
import { profileUpdateSchema } from "@/lib/validation";
import { validateJsonRequest } from "@/lib/validate";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { getProfileById, updateProfile } from "@/lib/supabase/profiles-db";

const profilePatchSchema = profileUpdateSchema;
const ROUTE_TAG = "api/v1/profile";

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const profile = await getProfileById(user.id);

    if (!profile) {
      return jsonError({
        status: 404,
        error: "Profile not found",
        requestId,
        code: "PROFILE_NOT_FOUND"
      });
    }

    return jsonSuccess(profile, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return withRequestIdHeader(handleAuthError(error), requestId);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch profile";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "PROFILE_GET_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "PROFILE_GET_FAILED"
    });
  }
}

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const parsed = await validateJsonRequest(request, profilePatchSchema, {
      errorMessage: "Invalid profile update payload"
    });
    if (!parsed.success) {
      return withRequestIdHeader(parsed.response, requestId);
    }

    const updated = await updateProfile(user.id, parsed.data);
    return jsonSuccess(updated, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return withRequestIdHeader(handleAuthError(error), requestId);
    }

    const message = error instanceof Error ? error.message : "Failed to update profile";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "PROFILE_PATCH_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "PROFILE_PATCH_FAILED"
    });
  }
}
