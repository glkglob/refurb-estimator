import { randomUUID } from "crypto";
import { z } from "zod";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
import { REGION_VALUES } from "@/lib/domain/region";
import { requireRole } from "@/lib/rbac";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import {
  AIDesignServiceError,
  generateDesign,
  type DesignProjectType,
  type GenerateDesignResult
} from "@/services/ai";

const ROUTE_TAG = "api/upload";
const DEFAULT_BUCKET_NAME = "design-uploads";
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 60 * 60;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const OPTIONAL_DIMENSION_SCHEMA = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }
    if (typeof value === "string") {
      return Number(value);
    }
    return value;
  },
  z.number().int().min(256).max(2048).optional()
);

const uploadMetadataSchema = z.object({
  region: z.enum(REGION_VALUES),
  projectType: z.enum(["loft", "new_build"]),
  promptHint: z.string().trim().max(500).optional(),
  width: OPTIONAL_DIMENSION_SCHEMA,
  height: OPTIONAL_DIMENSION_SCHEMA
});

type UploadStorageError = {
  message: string;
  statusCode?: number | null;
  code?: string | null;
  name?: string;
};

type UploadDatabaseError = {
  message: string;
  code?: string | null;
};

type UploadSupabaseClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        file: File,
        options: { contentType: string; upsert: boolean }
      ) => Promise<{
        error: UploadStorageError | null;
      }>;
      createSignedUrl: (
        path: string,
        expiresInSeconds: number
      ) => Promise<{
        data: { signedUrl: string } | null;
        error: UploadStorageError | null;
      }>;
    };
  };
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{
      error: UploadDatabaseError | null;
    }>;
  };
};

type UploadHandlerDependencies = {
  requireRoleFn?: typeof requireRole;
  generateDesignFn?: typeof generateDesign;
  supabaseClient?: UploadSupabaseClient;
  bucketName?: string;
  signedUrlExpirySeconds?: number;
  now?: () => Date;
  uploadIdFactory?: () => string;
};

type UploadMetadata = {
  region: (typeof REGION_VALUES)[number];
  projectType: DesignProjectType;
  promptHint?: string;
  width?: number;
  height?: number;
};

function getTextField(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getExtensionFromFile(file: File): string {
  const fileName = file.name.toLowerCase();
  const fromName = fileName.includes(".") ? fileName.split(".").pop() : undefined;
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };

  return mimeMap[file.type] ?? "bin";
}

function hasNetworkErrorSignature(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("network") ||
    normalized.includes("fetch") ||
    normalized.includes("econn") ||
    normalized.includes("timeout") ||
    normalized.includes("enotfound")
  );
}

function isStorageQuotaError(error: UploadStorageError): boolean {
  const normalizedMessage = error.message.toLowerCase();
  return (
    error.statusCode === 413 ||
    normalizedMessage.includes("quota") ||
    normalizedMessage.includes("limit exceeded") ||
    normalizedMessage.includes("insufficient_storage") ||
    normalizedMessage.includes("file too large")
  );
}

function mapStorageError(
  operation: "upload" | "signed_url",
  error: UploadStorageError
): { status: number; message: string } {
  if (isStorageQuotaError(error)) {
    return {
      status: 507,
      message: "Storage quota exceeded. Please free space or use a smaller image."
    };
  }

  if (hasNetworkErrorSignature(error.message)) {
    return {
      status: 503,
      message: `Network error during storage ${operation}. Please retry.`
    };
  }

  return {
    status: 502,
    message:
      operation === "upload"
        ? "Failed to upload file to storage."
        : "Failed to create signed URL for uploaded file."
  };
}

function mapDatabaseError(error: UploadDatabaseError): { status: number; message: string } {
  if (hasNetworkErrorSignature(error.message)) {
    return {
      status: 503,
      message: "Network error while saving design metadata."
    };
  }

  return {
    status: 500,
    message: "Failed to persist design metadata."
  };
}

function parseUploadMetadata(formData: FormData): {
  success: true;
  data: UploadMetadata;
} | {
  success: false;
  details: string[];
} {
  const parsed = uploadMetadataSchema.safeParse({
    region: getTextField(formData, "region"),
    projectType: getTextField(formData, "projectType"),
    promptHint: getTextField(formData, "promptHint"),
    width: getTextField(formData, "width"),
    height: getTextField(formData, "height")
  });

  if (!parsed.success) {
    return {
      success: false,
      details: parsed.error.issues.map((issue) => issue.message)
    };
  }

  return {
    success: true,
    data: {
      region: parsed.data.region,
      projectType: parsed.data.projectType,
      promptHint: parsed.data.promptHint,
      width: parsed.data.width,
      height: parsed.data.height
    }
  };
}

function buildStoragePath(userId: string, file: File, uploadId: string, now: Date): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  const extension = getExtensionFromFile(file);
  const dateSegment = now.toISOString().slice(0, 10);

  return `${safeUserId}/${dateSegment}/${uploadId}.${extension}`;
}

async function persistDesignMetadata(
  supabaseClient: UploadSupabaseClient,
  input: {
    userId: string;
    userEmail: string;
    region: string;
    projectType: DesignProjectType;
    bucket: string;
    storagePath: string;
    signedUrl: string;
    design: GenerateDesignResult;
    createdAt: string;
  }
): Promise<UploadDatabaseError | null> {
  const { error } = await supabaseClient.from("design_generations").insert({
    user_id: input.userId,
    user_email: input.userEmail,
    region: input.region,
    project_type: input.projectType,
    upload_bucket: input.bucket,
    upload_path: input.storagePath,
    image_signed_url: input.signedUrl,
    prompt: input.design.prompt,
    seed: input.design.seed,
    width: input.design.width,
    height: input.design.height,
    provider: input.design.provider,
    model: input.design.model,
    generated_at: input.design.createdAt,
    created_at: input.createdAt,
    updated_at: input.createdAt
  });

  return error;
}

/**
 * Handles image upload, AI design generation, and metadata persistence.
 */
export async function handleUpload(
  request: Request,
  dependencies?: UploadHandlerDependencies
) {
  const requestId = getRequestId(request);
  const requireRoleFn = dependencies?.requireRoleFn ?? requireRole;
  const generateDesignFn = dependencies?.generateDesignFn ?? generateDesign;
  const bucketName = dependencies?.bucketName ?? process.env.SUPABASE_DESIGN_UPLOAD_BUCKET ?? DEFAULT_BUCKET_NAME;
  const signedUrlExpirySeconds = dependencies?.signedUrlExpirySeconds ?? Number(
    process.env.DESIGN_SIGNED_URL_EXPIRY_SECONDS ?? DEFAULT_SIGNED_URL_EXPIRY_SECONDS
  );
  const resolvedSignedUrlExpirySeconds = Number.isFinite(signedUrlExpirySeconds)
    ? signedUrlExpirySeconds
    : DEFAULT_SIGNED_URL_EXPIRY_SECONDS;
  const nowFactory = dependencies?.now ?? (() => new Date());
  const uploadIdFactory = dependencies?.uploadIdFactory ?? randomUUID;

  try {
    const user = await requireRoleFn(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";

    if (contentType.length > 0 && !contentType.includes("multipart/form-data")) {
      return jsonError("Expected multipart/form-data upload request.", requestId, 415);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size <= 0) {
      return jsonError("Invalid file. Please upload an image file.", requestId, 400);
    }

    if (!SUPPORTED_MIME_TYPES.has(file.type)) {
      return jsonError(
        "Invalid file type. Supported types: image/jpeg, image/png, image/webp.",
        requestId,
        400
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      return jsonError(
        `Invalid file size. Maximum upload size is ${MAX_IMAGE_BYTES / (1024 * 1024)}MB.`,
        requestId,
        400
      );
    }

    const parsedMetadata = parseUploadMetadata(formData);
    if (!parsedMetadata.success) {
      return jsonError("Invalid upload metadata.", requestId, 400, {
        details: parsedMetadata.details
      });
    }

    const now = nowFactory();
    const storagePath = buildStoragePath(user.id, file, uploadIdFactory(), now);
    const supabaseClient =
      dependencies?.supabaseClient ??
      (createAdminSupabaseClient() as unknown as UploadSupabaseClient);

    const storageBucket = supabaseClient.storage.from(bucketName);

    const { error: uploadError } = await storageBucket.upload(storagePath, file, {
      upsert: false,
      contentType: file.type
    });

    if (uploadError) {
      const mapped = mapStorageError("upload", uploadError);
      return jsonError(mapped.message, requestId, mapped.status);
    }

    const { data: signedUrlData, error: signedUrlError } = await storageBucket.createSignedUrl(
      storagePath,
      resolvedSignedUrlExpirySeconds
    );

    if (signedUrlError || !signedUrlData?.signedUrl) {
      const mapped = mapStorageError("signed_url", signedUrlError ?? {
        message: "Signed URL was not returned by Supabase Storage."
      });
      return jsonError(mapped.message, requestId, mapped.status);
    }

    const design = await generateDesignFn({
      imageUrl: signedUrlData.signedUrl,
      region: parsedMetadata.data.region,
      projectType: parsedMetadata.data.projectType,
      promptHint: parsedMetadata.data.promptHint,
      width: parsedMetadata.data.width,
      height: parsedMetadata.data.height,
      user: {
        userId: user.id,
        email: user.email,
        role: user.role
      }
    });

    const createdAt = now.toISOString();
    const persistError = await persistDesignMetadata(supabaseClient, {
      userId: user.id,
      userEmail: user.email,
      region: parsedMetadata.data.region,
      projectType: parsedMetadata.data.projectType,
      bucket: bucketName,
      storagePath,
      signedUrl: signedUrlData.signedUrl,
      design,
      createdAt
    });

    if (persistError) {
      const mapped = mapDatabaseError(persistError);
      return jsonError(mapped.message, requestId, mapped.status);
    }

    return jsonSuccess({
      bucket: bucketName,
      path: storagePath,
      signedUrl: signedUrlData.signedUrl,
      signedUrlExpirySeconds: resolvedSignedUrlExpirySeconds,
      design: {
        prompt: design.prompt,
        seed: design.seed,
        width: design.width,
        height: design.height,
        region: design.region,
        provider: design.provider,
        model: design.model,
        createdAt: design.createdAt
      }
    }, requestId, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    if (error instanceof AIDesignServiceError) {
      return jsonError(error.message, requestId, error.statusCode);
    }

    logError(ROUTE_TAG, requestId, error);
    const message = error instanceof Error ? error.message : "Failed to process upload request.";
    return jsonError(message, requestId, 500);
  }
}
