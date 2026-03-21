import { NextResponse } from "next/server";
import {
  AuthError,
  handleAuthError,
  requireAuth
} from "@/lib/supabase/auth-helpers";
import { uploadFile } from "@/lib/supabase/storage";

const bucketConfig = {
  gallery: {
    maxBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
  },
  avatars: {
    maxBytes: 2 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"]
  },
  documents: {
    maxBytes: 10 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"]
  }
} as const;

type AllowedBucket = keyof typeof bucketConfig;

function isAllowedBucket(value: unknown): value is AllowedBucket {
  return value === "gallery" || value === "avatars" || value === "documents";
}

function extensionFromFile(file: File): string {
  const lowerName = file.name.toLowerCase().trim();
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

  return mimeToExt[file.type] ?? "bin";
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const formData = await request.formData();

    const bucketValue = formData.get("bucket");
    if (!isAllowedBucket(bucketValue)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }

    const fileValue = formData.get("file");
    if (!(fileValue instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (fileValue.size <= 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const config = bucketConfig[bucketValue];
    const allowedMimeTypes = config.allowedMimeTypes as readonly string[];
    if (!allowedMimeTypes.includes(fileValue.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    if (fileValue.size > config.maxBytes) {
      return NextResponse.json({ error: "File exceeds size limit" }, { status: 400 });
    }

    const extension = extensionFromFile(fileValue);
    const filePath =
      bucketValue === "avatars"
        ? `${user.id}/avatar.${extension}`
        : `${user.id}/${crypto.randomUUID()}.${extension}`;

    let publicUrl: string;
    try {
      publicUrl = await uploadFile(bucketValue, filePath, fileValue);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload file";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json(
      { url: publicUrl, path: filePath, bucket: bucketValue },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
