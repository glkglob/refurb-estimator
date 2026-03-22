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
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

type RouteContext = {
  params: Promise<{
    itemId: string;
  }>;
};

const galleryUpdateSchema = galleryItemUpdateSchema;

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
      return jsonError("Gallery item not found", requestId, 404);
    }

    const item = mapGalleryRow(data as Parameters<typeof mapGalleryRow>[0]);
    return jsonSuccess(item, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("gallery/[itemId] GET", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to fetch gallery item";
    return jsonError(message, requestId);
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
    return jsonSuccess(updated, requestId);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("gallery/[itemId] PATCH", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to update gallery item";
    return jsonError(message, requestId);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const requestId = getRequestId(_request);

  try {
    await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const { itemId } = await context.params;
    await deleteGalleryItem(itemId);
    return new NextResponse(null, {
      status: 204,
      headers: { "x-request-id": requestId }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("gallery/[itemId] DELETE", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to delete gallery item";
    return jsonError(message, requestId);
  }
}
