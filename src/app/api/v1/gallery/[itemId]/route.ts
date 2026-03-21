import { NextResponse, type NextRequest } from "next/server";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import {
  deleteGalleryItem,
  mapGalleryRow,
  updateGalleryItem
} from "@/lib/supabase/gallery-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { galleryItemUpdateSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { itemId } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("gallery_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch gallery item: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json({ error: "Gallery item not found" }, { status: 404 });
    }

    const item = mapGalleryRow(data as Parameters<typeof mapGalleryRow>[0]);
    return NextResponse.json(item, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch gallery item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireAuth(["tradesperson", "admin"]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = galleryItemUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid gallery item update payload",
          details: parsed.error.issues.map((issue) => issue.message)
        },
        { status: 400 }
      );
    }

    const { itemId } = await context.params;
    const updated = await updateGalleryItem(itemId, parsed.data);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to update gallery item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    await requireAuth(["tradesperson", "admin"]);
    const { itemId } = await context.params;
    await deleteGalleryItem(itemId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to delete gallery item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
