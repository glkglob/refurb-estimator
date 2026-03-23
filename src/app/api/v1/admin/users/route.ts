import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logApiError,
  withRequestIdHeader
} from "@/lib/api-route";
import { validateJsonRequest } from "@/lib/validate";
import { paginationSchema } from "@/lib/validation";
import { requireRole } from "@/lib/rbac";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapProfileRowToProfile, listAllProfiles } from "@/lib/supabase/profiles-db";
import {
  AuthError,
  handleAuthError,
  type UserRole
} from "@/lib/supabase/auth-helpers";

const roleSchema = z.enum(["customer", "tradesperson", "admin"]);
const ROUTE_TAG = "api/v1/admin/users";

const updateUserSchema = z
  .object({
    userId: z.string().uuid("Invalid user id"),
    role: roleSchema.optional(),
    isVerified: z.boolean().optional()
  })
  .refine((value) => value.role !== undefined || value.isVerified !== undefined, {
    message: "Provide role or isVerified to update"
  });

function getQueryParams(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const pagination = paginationSchema.safeParse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined
  });

  if (!pagination.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Invalid pagination parameters",
          details: pagination.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      )
    };
  }

  const role = params.get("role");
  if (role) {
    const parsedRole = roleSchema.safeParse(role);
    if (!parsedRole.success) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Invalid role filter" }, { status: 400 })
      };
    }
  }

  const email = params.get("email")?.trim() || undefined;

  return {
    ok: true as const,
    data: {
      page: pagination.data.page,
      limit: pagination.data.limit,
      role: role as UserRole | undefined,
      email
    }
  };
}

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);

  try {
    await requireRole("ADMIN");

    const parsedQuery = getQueryParams(request);
    if (!parsedQuery.ok) {
      return withRequestIdHeader(parsedQuery.response, requestId);
    }

    const [profilesResult, supabase] = await Promise.all([
      listAllProfiles({
        page: parsedQuery.data.page,
        limit: parsedQuery.data.limit,
        role: parsedQuery.data.role,
        email: parsedQuery.data.email
      }),
      createServerSupabaseClient()
    ]);

    const [totalUsers, tradespeople, verifiedTradespeople, customers] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "tradesperson"),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "tradesperson")
        .eq("is_verified", true),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "customer")
    ]);

    const stats = {
      totalUsers: totalUsers.count ?? 0,
      tradespeople: tradespeople.count ?? 0,
      verifiedTradespeople: verifiedTradespeople.count ?? 0,
      customers: customers.count ?? 0
    };

    return jsonSuccess(
      {
        data: profilesResult.data,
        total: profilesResult.total,
        page: parsedQuery.data.page,
        limit: parsedQuery.data.limit,
        stats
      },
      { status: 200, requestId }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return withRequestIdHeader(handleAuthError(error), requestId);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch users";
    logApiError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "ADMIN_USERS_GET_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "ADMIN_USERS_GET_FAILED"
    });
  }
}

export async function PATCH(request: Request) {
  const requestId = getRequestId(request);

  try {
    await requireRole("ADMIN");
    const supabase = await createServerSupabaseClient();

    const parsed = await validateJsonRequest(request, updateUserSchema, {
      errorMessage: "Invalid update payload"
    });
    if (!parsed.success) {
      return withRequestIdHeader(parsed.response, requestId);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (parsed.data.role !== undefined) {
      updates.role = parsed.data.role;
    }

    if (parsed.data.isVerified !== undefined) {
      updates.is_verified = parsed.data.isVerified;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", parsed.data.userId)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return jsonError({
          status: 404,
          error: "User not found",
          requestId,
          code: "USER_NOT_FOUND"
        });
      }
      throw new Error(`Failed to update user: ${error.message}`);
    }

    return jsonSuccess({ data: mapProfileRowToProfile(data) }, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return withRequestIdHeader(handleAuthError(error), requestId);
    }

    const message = error instanceof Error ? error.message : "Failed to update user";
    logApiError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "ADMIN_USERS_PATCH_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "ADMIN_USERS_PATCH_FAILED"
    });
  }
}
