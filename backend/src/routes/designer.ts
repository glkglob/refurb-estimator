import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import express, { Router, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";

import type {
  DesignerAgentInput,
  DesignerAgentResponse,
  DesignerRoomType,
  DesignerTargetSpec
} from "../../../shared/designerTypes";
import { callDesignerAgent } from "../services/designerAgent";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const UPLOAD_ROOT = path.resolve(process.cwd(), "backend/storage/uploads/designer");
const RESULT_ROOT = path.resolve(process.cwd(), "backend/storage/designer-results");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_IMAGES,
    fileSize: MAX_IMAGE_BYTES
  }
});

const metadataSchema = z.object({
  propertySizeM2: z.coerce.number().positive().max(20_000),
  roomType: z.enum(["living room", "bedroom", "kitchen", "bathroom", "other"]),
  targetSpec: z.enum(["basic", "standard", "premium"]),
  preferredStyles: z.string().trim().max(400).default("")
});

interface ParsedMetadata {
  propertySizeM2: number;
  roomType: DesignerRoomType;
  targetSpec: DesignerTargetSpec;
  preferredStyles: string;
}

interface UploadedImage {
  mimetype: string;
  buffer: Buffer;
}

function extensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

function toStorageUrl(request: Request, fileName: string): string {
  const forwardedProto = request.header("x-forwarded-proto");
  const protocol = forwardedProto ? forwardedProto.split(",")[0].trim() : request.protocol;
  const host = request.get("host") ?? "localhost:3000";
  return `${protocol}://${host}/api/designer/uploads/designer/${fileName}`;
}

function extractMetadataSource(body: Record<string, unknown>): Record<string, unknown> {
  const rawMetadata = body.metadata;
  if (typeof rawMetadata === "string") {
    const parsed: unknown = JSON.parse(rawMetadata);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  }

  return body;
}

function parseMetadata(body: Record<string, unknown>): ParsedMetadata {
  const source = extractMetadataSource(body);

  const parsed = metadataSchema.parse({
    propertySizeM2: source.propertySizeM2 ?? source.property_size_m2,
    roomType: source.roomType ?? source.room_type,
    targetSpec: source.targetSpec ?? source.target_spec,
    preferredStyles: source.preferredStyles ?? source.preferred_styles ?? ""
  });

  return parsed;
}

async function persistUploads(
  files: UploadedImage[],
  roomId: string,
  request: Request
): Promise<string[]> {
  await fs.mkdir(UPLOAD_ROOT, { recursive: true });

  const urls: string[] = [];
  for (const [index, file] of files.entries()) {
    const extension = extensionFromMimeType(file.mimetype);
    const fileName = `${roomId}-${index + 1}.${extension}`;
    const destinationPath = path.join(UPLOAD_ROOT, fileName);

    await fs.writeFile(destinationPath, file.buffer);
    urls.push(toStorageUrl(request, fileName));
  }

  return urls;
}

async function persistDesignerResult(result: DesignerAgentResponse): Promise<void> {
  await fs.mkdir(RESULT_ROOT, { recursive: true });
  const outputPath = path.join(RESULT_ROOT, `${result.room_id}.json`);
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), "utf8");
}

export const designerRouter = Router();

designerRouter.use("/uploads", express.static(path.resolve(process.cwd(), "backend/storage/uploads")));

designerRouter.post(
  "/analyse-room",
  upload.array("images", MAX_IMAGES),
  async (
    request: Request,
    response: Response<DesignerAgentResponse | { error: string; message?: string }>
  ) => {
    try {
      const files = (request.files as UploadedImage[] | undefined) ?? [];
      if (files.length === 0) {
        return response.status(400).json({
          error: "At least one room image is required"
        });
      }

      if (files.length > MAX_IMAGES) {
        return response.status(400).json({
          error: `You can upload up to ${MAX_IMAGES} room images`
        });
      }

      const metadata = parseMetadata(request.body as Record<string, unknown>);
      const fallbackRoomId = randomUUID();
      const imageUrls = await persistUploads(files, fallbackRoomId, request);

      const agentInput: DesignerAgentInput = {
        imageUrls,
        propertySizeM2: metadata.propertySizeM2,
        roomType: metadata.roomType,
        targetSpec: metadata.targetSpec,
        preferredStyles: metadata.preferredStyles
      };

      const agentResult = await callDesignerAgent(agentInput);
      const typedResponse: DesignerAgentResponse = {
        ...agentResult,
        room_id: agentResult.room_id || fallbackRoomId,
        room_type: agentResult.room_type || metadata.roomType,
        approx_room_area_m2: agentResult.approx_room_area_m2 || metadata.propertySizeM2
      };

      await persistDesignerResult(typedResponse);
      return response.status(200).json(typedResponse);
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return response.status(400).json({
          error: "Invalid room designer metadata",
          message: error.issues.map((issue) => issue.message).join("; ")
        });
      }

      const message = error instanceof Error ? error.message : "Failed to analyse room";
      return response.status(500).json({ error: "Failed to analyse room", message });
    }
  }
);

export default designerRouter;
