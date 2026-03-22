import { requireRole } from "@/lib/rbac";
import { profileUpdateSchema } from "@/lib/validation";
import { validateJsonRequest } from "@/lib/validate";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { getProfileById, updateProfile } from "@/lib/supabase/profiles-db";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

const profilePatchSchema = profileUpdateSchema;

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

    logError("profile GET", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to fetch profile";
    return jsonError(message, requestId);
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

    logError("profile PATCH", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return jsonError(message, requestId);
  }
}
