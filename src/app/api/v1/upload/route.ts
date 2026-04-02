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
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateJsonRequest } from "@/lib/validate";
import { randomUUID } from "crypto";
import { z } from "zod";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const GALLERY_MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_GALLERY_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_BUCKET = "avatars";
const GALLERY_BUCKET = "gallery";
const ROUTE_TAG = "api/v1/upload";

const uploadRequestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("presign"),
    bucket: z.enum([AVATAR_BUCKET, GALLERY_BUCKET]),
    fileName: z.string().trim().min(1).max(255),
    fileType: z.string().trim().min(1).max(100),
    fileSize: z.number().int().positive()
  }),
  z.object({
    action: z.literal("confirm"),
    bucket: z.enum([AVATAR_BUCKET, GALLERY_BUCKET]),
    key: z.string().trim().min(3).max(1024)
  })
]);

type UploadBucket = z.infer<typeof uploadRequestSchema>["bucket"];

function extensionFromMetadata(fileName: string, fileType: string): string {
  const lowerName = fileName.toLowerCase().trim();
  const fromName = lowerName.includes(".") ? lowerName.split(".").pop() : "";
  if (fromName && fromName.length > 0) {
    return fromName.replace(/[^a-z0-9]/g, "");
  }

  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf"
  };

  return mimeToExt[fileType] ?? "bin";
}

function getBucketRules(bucket: UploadBucket): {
  maxBytes: number;
  allowedMimeTypes: Set<string>;
  upsert: boolean;
} {
  if (bucket === AVATAR_BUCKET) {
    return {
      maxBytes: AVATAR_MAX_BYTES,
      allowedMimeTypes: ALLOWED_AVATAR_MIME_TYPES,
      upsert: true
    };
  }

  return {
    maxBytes: GALLERY_MAX_BYTES,
    allowedMimeTypes: ALLOWED_GALLERY_MIME_TYPES,
    upsert: false
  };
}

function ensureOwnedObjectKey(key: string, userId: string): boolean {
  const normalized = key.trim();
  if (!normalized.startsWith(`${userId}/`)) {
    return false;
  }

  if (normalized.includes("..") || normalized.includes("\\")) {
    return false;
  }

  return true;
}

function buildObjectKey(
  userId: string,
  bucket: UploadBucket,
  fileName: string,
  fileType: string
): string {
  const extension = extensionFromMetadata(fileName, fileType) || "bin";
  const safeExtension = extension.slice(0, 8) || "bin";

  if (bucket === AVATAR_BUCKET) {
    return `${userId}/avatar.${safeExtension}`;
  }

  return `${userId}/${Date.now()}-${randomUUID()}.${safeExtension}`;
}

async function handleJsonUploadRequest(request: Request, requestId: string, userId: string) {
  const parsed = await validateJsonRequest(request, uploadRequestSchema, {
    errorMessage: "Invalid upload payload"
  });

  if (!parsed.success) {
    return parsed.response;
  }

  const supabase = await createServerSupabaseClient();

  if (parsed.data.action === "presign") {
    const { bucket, fileName, fileType, fileSize } = parsed.data;
    const rules = getBucketRules(bucket);

    if (!rules.allowedMimeTypes.has(fileType)) {
      return jsonError("File type not allowed", requestId, 400);
    }

    if (fileSize > rules.maxBytes) {
      return jsonError("File exceeds size limit", requestId, 400);
    }

    const key = buildObjectKey(userId, bucket, fileName, fileType);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(key, { upsert: rules.upsert });

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to create upload URL: ${error?.message ?? "Unknown error"}`);
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(key);

    return jsonSuccess(
      {
        uploadUrl: data.signedUrl,
        key,
        publicUrl: publicData.publicUrl
      },
      requestId
    );
  }

  const { bucket, key } = parsed.data;
  if (!ensureOwnedObjectKey(key, userId)) {
    return jsonError("Invalid upload key", requestId, 403);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(key);
  return jsonSuccess(
    {
      url: data.publicUrl,
      key,
      bucket
    },
    requestId
  );
}

async function handleFormDataUploadRequest(request: Request, requestId: string, userId: string) {
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
  const filePath = `${userId}/avatar.${extension}`;
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
    requestId
  );
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (contentType.includes("application/json")) {
      return await handleJsonUploadRequest(request, requestId, user.id);
    }

    return await handleFormDataUploadRequest(request, requestId, user.id);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to upload file";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
  }
}
