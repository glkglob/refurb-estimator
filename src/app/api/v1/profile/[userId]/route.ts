import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/rbac";
import { AuthError, handleAuthError } from "@/lib/supabase/auth-helpers";
import { getPublicProfile } from "@/lib/supabase/profiles-db";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const { userId } = await context.params;
    const profile = await getPublicProfile(userId);

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch public profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
