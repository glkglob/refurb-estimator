import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "./server";

export type UserRole = "customer" | "tradesperson" | "admin";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

function isUserRole(value: unknown): value is UserRole {
  return value === "customer" || value === "tradesperson" || value === "admin";
}

/**
 * Usage in API routes:
 * const user = await requireAuth(); // any authenticated user
 * const user = await requireAuth(["tradesperson", "admin"]); // role-restricted
 */
export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthenticatedUser> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  console.error("[requireAuth] getUser result:", {
    userId: user?.id,
    userEmail: user?.email,
    userError: userError?.message
  });

  if (userError || !user) {
    throw new AuthError("Not authenticated", 401);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError && profileError.code !== "PGRST116") {
    console.error("[auth-helpers] profiles query failed:", {
      code: profileError.code,
      message: profileError.message,
      hint: profileError.hint,
      details: profileError.details
    });
    throw new AuthError("Internal server error", 500);
  }

  const role: UserRole = isUserRole(profile?.role) ? profile.role : "customer";

  if (allowedRoles && !allowedRoles.includes(role)) {
    throw new AuthError("Insufficient permissions", 403);
  }

  return {
    id: user.id,
    email: user.email ?? "",
    role
  };
}

export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
