import { NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { profileUpdateSchema } from "@/lib/validation";
import { validateJsonRequest } from "@/lib/validate";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { getProfileById, updateProfile } from "@/lib/supabase/profiles-db";

const profilePatchSchema = profileUpdateSchema;

export async function GET() {
  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const profile = await getProfileById(user.id);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const parsed = await validateJsonRequest(request, profilePatchSchema, {
      errorMessage: "Invalid profile update payload"
    });
    if (!parsed.success) {
      return parsed.response;
    }

    const updated = await updateProfile(user.id, parsed.data);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
