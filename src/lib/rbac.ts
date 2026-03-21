import {
  requireAuth,
  type AuthenticatedUser,
  type UserRole
} from "@/lib/supabase/auth-helpers";

export type Role = "CUSTOMER" | "TRADESPERSON" | "ADMIN";

const roleMap: Record<Role, UserRole> = {
  CUSTOMER: "customer",
  TRADESPERSON: "tradesperson",
  ADMIN: "admin"
};

export async function requireRole(role: Role | Role[]): Promise<AuthenticatedUser> {
  const roles = Array.isArray(role) ? role : [role];
  const allowedRoles = roles.map((item) => roleMap[item]);
  return requireAuth(allowedRoles);
}
