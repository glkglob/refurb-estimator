import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { getGalleryItemsByUser } from "@/lib/supabase/gallery-db";
import { paginationSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const parsed = paginationSchema.safeParse({
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid pagination parameters",
          details: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const result = await getGalleryItemsByUser(user.id, {
      page: parsed.data.page,
      limit: parsed.data.limit
    });

    return NextResponse.json(
      {
        data: result.data,
        total: result.total,
        page: parsed.data.page,
        limit: parsed.data.limit
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch user gallery";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
