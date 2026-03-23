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
      return jsonError("Profile not found", requestId, 404);
    }

    return jsonSuccess(profile, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch profile";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
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
      return parsed.response;
    }

    const updated = await updateProfile(user.id, parsed.data);
    return jsonSuccess(updated, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to update profile";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
  }
}
