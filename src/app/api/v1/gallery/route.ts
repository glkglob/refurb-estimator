import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { createGalleryItem, getPublicGallery } from "@/lib/supabase/gallery-db";
import { galleryItemCreateSchema, paginationSchema } from "@/lib/validation";

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
    const message = error instanceof Error ? error.message : "Failed to fetch gallery";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth(["tradesperson", "admin"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = galleryItemCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid gallery item payload",
          details: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
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
