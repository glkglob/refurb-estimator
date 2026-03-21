import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import {
  deleteGalleryItem,
  mapGalleryRow,
  updateGalleryItem
} from "@/lib/supabase/gallery-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateJsonRequest } from "@/lib/validate";
import { galleryItemUpdateSchema } from "@/lib/validation";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

const galleryUpdateSchema = galleryItemUpdateSchema;

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const { itemId } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("gallery")
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
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch gallery item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);

    const parsed = await validateJsonRequest(request, galleryUpdateSchema, {
      errorMessage: "Invalid gallery item update payload"
    });
    if (!parsed.success) {
      return parsed.response;
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
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
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
