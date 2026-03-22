import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequestId, jsonSuccess, jsonError, logError } from "@/lib/api-route";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_BUCKET = "avatars";

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
      return jsonError("No file provided", requestId, 400);
    }

    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      return jsonError("File type not allowed", requestId, 400);
    }

    if (file.size <= 0) {
      return jsonError("No file provided", requestId, 400);
    }

    if (file.size > AVATAR_MAX_BYTES) {
      return jsonError("File exceeds size limit", requestId, 400);
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
      requestId,
      201
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    logError("upload POST", requestId, error);
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return jsonError(message, requestId);
  }
}
