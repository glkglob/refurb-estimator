import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logApiError,
  withRequestIdHeader
} from "@/lib/api-route";
import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_BUCKET = "avatars";
const ROUTE_TAG = "api/v1/upload";

function extensionFromMetadata(fileName: string, fileType: string): string {
  const lowerName = fileName.toLowerCase().trim();
  const fromName = lowerName.includes(".") ? lowerName.split(".").pop() : "";
  if (fromName && fromName.length > 0) {
    return fromName;
  }

  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf"
  };

  return mimeToExt[fileType] ?? "bin";
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return jsonError({
        status: 400,
        error: "No file provided",
        requestId,
        code: "NO_FILE"
      });
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      return jsonError({
        status: 400,
        error: "File type not allowed",
        requestId,
        code: "INVALID_FILE_TYPE"
      });
    }

    if (file.size <= 0) {
      return jsonError({
        status: 400,
        error: "No file provided",
        requestId,
        code: "EMPTY_FILE"
      });
    }

    if (file.size > AVATAR_MAX_BYTES) {
      return jsonError({
        status: 400,
        error: "File exceeds size limit",
        requestId,
        code: "FILE_TOO_LARGE"
      });
    }

    const extension = extensionFromMetadata(file.name, file.type);
    const filePath = `${user.id}/avatar.${extension}`;
    const supabase = await createServerSupabaseClient();

    const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

    if (uploadError) {
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    const { data: publicData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

    return jsonSuccess(
      {
        url: publicData.publicUrl,
        path: filePath,
        bucket: AVATAR_BUCKET
      },
      { status: 201, requestId }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return withRequestIdHeader(handleAuthError(error), requestId);
    }

    const message = error instanceof Error ? error.message : "Failed to upload file";
    logApiError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "UPLOAD_POST_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "UPLOAD_POST_FAILED"
    });
  }
}
