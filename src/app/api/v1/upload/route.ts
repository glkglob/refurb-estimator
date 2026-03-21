import { NextResponse } from "next/server";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { requireRole } from "@/lib/rbac";
import {
  AuthError,
  handleAuthError
} from "@/lib/supabase/auth-helpers";
import { validateJsonRequest } from "@/lib/validate";

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

const presignSchema = z.object({
  action: z.literal("presign"),
  bucket: z.enum(["gallery", "avatars", "documents"]),
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().positive()
});

const confirmSchema = z.object({
  action: z.literal("confirm"),
  bucket: z.enum(["gallery", "avatars", "documents"]),
  key: z.string().min(1).max(512)
});

const uploadBodySchema = z.discriminatedUnion("action", [presignSchema, confirmSchema]);

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

function getS3Client(): { client: S3Client; bucket: string; region: string } | null {
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET;
  const region = process.env.AWS_REGION;

  if (!bucket || !region) {
    return null;
  }

  return {
    client: new S3Client({ region }),
    bucket,
    region
  };
}

function buildPublicUrl(bucket: string, region: string, key: string): string {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

export async function POST(request: Request) {
  try {
    const user = await requireRole(["CUSTOMER", "TRADESPERSON", "ADMIN"]);
    const parsedBody = await validateJsonRequest(
      request,
      uploadBodySchema,
      { errorMessage: "Invalid upload payload" }
    );
    if (!parsedBody.success) {
      return parsedBody.response;
    }
    const uploadRequest = parsedBody.data;
    const s3Config = getS3Client();

    if (!s3Config) {
      return NextResponse.json(
        {
          error: "S3 is not configured. Set NEXT_PUBLIC_S3_BUCKET and AWS_REGION."
        },
        { status: 500 }
      );
    }

    if (uploadRequest.action === "presign") {
      const bucketValue: AllowedBucket = uploadRequest.bucket;
      const config = bucketConfig[bucketValue];
      const allowedMimeTypes = config.allowedMimeTypes as readonly string[];

      if (!allowedMimeTypes.includes(uploadRequest.fileType)) {
        return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
      }

      if (uploadRequest.fileSize > config.maxBytes) {
        return NextResponse.json({ error: "File exceeds size limit" }, { status: 400 });
      }

      const extension = extensionFromMetadata(uploadRequest.fileName, uploadRequest.fileType);
      const key =
        bucketValue === "avatars"
          ? `${user.id}/avatar.${extension}`
          : `${user.id}/${crypto.randomUUID()}.${extension}`;

      const putCommand = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        ContentType: uploadRequest.fileType
      });
      const expiresIn = 300;
      const uploadUrl = await getSignedUrl(s3Config.client, putCommand, { expiresIn });
      const publicUrl = buildPublicUrl(s3Config.bucket, s3Config.region, key);

      return NextResponse.json(
        {
          uploadUrl,
          key,
          bucket: bucketValue,
          publicUrl,
          expiresIn
        },
        { status: 200 }
      );
    }

    const bucketValue: AllowedBucket = uploadRequest.bucket;
    const key = uploadRequest.key;
    if (!key.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Invalid file key" }, { status: 403 });
    }

    try {
      await s3Config.client.send(
        new HeadObjectCommand({
          Bucket: s3Config.bucket,
          Key: key
        })
      );
    } catch {
      return NextResponse.json({ error: "File upload not found" }, { status: 400 });
    }

    const publicUrl = buildPublicUrl(s3Config.bucket, s3Config.region, key);
    return NextResponse.json(
      { url: publicUrl, path: key, bucket: bucketValue, confirmed: true },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
