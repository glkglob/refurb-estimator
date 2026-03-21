import { createServerSupabaseClient } from "./server";

function getExtensionFromFile(file: File): string {
  const trimmedName = file.name.trim();
  const byName = trimmedName.includes(".") ? trimmedName.split(".").pop() : "";
  if (byName) {
    return byName.toLowerCase();
  }

  const mimeToExtension: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf"
  };

  return mimeToExtension[file.type] ?? "bin";
}

export async function uploadFile(bucket: string, filePath: string, file: File): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: true,
    contentType: file.type
  });

  if (error) {
    throw new Error(`Failed to upload file to ${bucket}: ${error.message}`);
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return publicUrl;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const extension = getExtensionFromFile(file);
  const filePath = `${userId}/avatar.${extension}`;
  return uploadFile("avatars", filePath, file);
}

export async function uploadGalleryImage(
  userId: string,
  file: File,
  filename?: string
): Promise<string> {
  const extension = getExtensionFromFile(file);
  const baseName = filename && filename.trim().length > 0 ? filename.trim() : crypto.randomUUID();
  const filePath = `${userId}/${baseName}.${extension}`;
  return uploadFile("gallery", filePath, file);
}

export async function deleteFile(bucket: string, filePath: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.storage.from(bucket).remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete file from ${bucket}: ${error.message}`);
  }
}

export async function getSignedUrl(
  bucket: string,
  filePath: string,
  expiresIn: number = 3600
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL for ${bucket}: ${error?.message ?? "Unknown error"}`);
  }

  return data.signedUrl;
}
