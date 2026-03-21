import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { createGalleryItem, getPublicGallery } from "@/lib/supabase/gallery-db";
import { validateJsonRequest } from "@/lib/validate";
import { galleryItemCreateSchema, paginationSchema } from "@/lib/validation";

const galleryCreateSchema = galleryItemCreateSchema;

function getPaginationFromRequest(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = paginationSchema.safeParse({
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: "Invalid pagination parameters",
          details: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      )
    };
  }

  return { ok: true as const, data: parsed.data };
}

export async function GET(request: NextRequest) {
  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const pagination = getPaginationFromRequest(request);
    if (!pagination.ok) {
      return pagination.response;
    }

    const projectType = request.nextUrl.searchParams.get("projectType") ?? undefined;
    const result = await getPublicGallery({
      page: pagination.data.page,
      limit: pagination.data.limit,
      projectType
    });

    return NextResponse.json(
      {
        data: result.data,
        total: result.total,
        page: pagination.data.page,
        limit: pagination.data.limit
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch gallery";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const parsed = await validateJsonRequest(request, galleryCreateSchema, {
      errorMessage: "Invalid gallery item payload"
    });
    if (!parsed.success) {
      return parsed.response;
    }

    const created = await createGalleryItem(user.id, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to create gallery item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
