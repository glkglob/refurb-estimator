import { NextResponse, type NextRequest } from "next/server";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
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
const ROUTE_TAG = "api/v1/gallery/[itemId]";

export async function GET(_request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(_request);

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
      return jsonError({
        status: 404,
        error: "Gallery item not found",
        requestId,
        code: "GALLERY_ITEM_NOT_FOUND"
      });
    }

    const item = mapGalleryRow(data as Parameters<typeof mapGalleryRow>[0]);
    return jsonSuccess(item, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to fetch gallery item";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "GALLERY_ITEM_GET_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "GALLERY_ITEM_GET_FAILED"
    });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(request);

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
    return jsonSuccess(updated, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to update gallery item";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "GALLERY_ITEM_PATCH_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "GALLERY_ITEM_PATCH_FAILED"
    });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(_request);

  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const { itemId } = await context.params;
    await deleteGalleryItem(itemId);
    return new NextResponse(null, { status: 204 }, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to delete gallery item";
    logError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "GALLERY_ITEM_DELETE_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "GALLERY_ITEM_DELETE_FAILED"
    });
  }
}
