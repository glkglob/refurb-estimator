import type { GalleryItem, GalleryItemCreateInput, ProjectType } from "../platform-types";
import { createServerSupabaseClient } from "./server";

type GalleryItemRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string;
  thumbnail_url: string | null;
  project_type: ProjectType | null;
  before_image_url: string | null;
  location_city: string | null;
  estimated_cost: number | string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

function toOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapGalleryInputToRow(
  data: Partial<GalleryItemCreateInput>
): Partial<GalleryItemRow> {
  const mapped: Partial<GalleryItemRow> = {};

  if (data.title !== undefined) mapped.title = data.title;
  if (data.description !== undefined) mapped.description = data.description ?? null;
  if (data.imageUrl !== undefined) mapped.image_url = data.imageUrl;
  if (data.thumbnailUrl !== undefined) mapped.thumbnail_url = data.thumbnailUrl ?? null;
  if (data.projectType !== undefined) mapped.project_type = data.projectType;
  if (data.beforeImageUrl !== undefined) mapped.before_image_url = data.beforeImageUrl ?? null;
  if (data.locationCity !== undefined) mapped.location_city = data.locationCity ?? null;
  if (data.estimatedCost !== undefined) mapped.estimated_cost = data.estimatedCost;

  return mapped;
}

export function mapGalleryRow(row: GalleryItemRow): GalleryItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    projectType: row.project_type,
    beforeImageUrl: row.before_image_url,
    locationCity: row.location_city,
    estimatedCost: toOptionalNumber(row.estimated_cost),
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createGalleryItem(
  userId: string,
  data: GalleryItemCreateInput
): Promise<GalleryItem> {
  const supabase = await createServerSupabaseClient();
  const payload: Partial<GalleryItemRow> = {
    user_id: userId,
    ...mapGalleryInputToRow(data)
  };

  const { data: created, error } = await supabase
    .from("gallery")
    .insert(payload)
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create gallery item: ${error?.message ?? "Unknown error"}`);
  }

  return mapGalleryRow(created as GalleryItemRow);
}

export async function updateGalleryItem(
  itemId: string,
  data: Partial<GalleryItemCreateInput>
): Promise<GalleryItem> {
  const supabase = await createServerSupabaseClient();
  const payload: Partial<GalleryItemRow> = {
    ...mapGalleryInputToRow(data),
    updated_at: new Date().toISOString()
  };

  const { data: updated, error } = await supabase
    .from("gallery")
    .update(payload)
    .eq("id", itemId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update gallery item: ${error?.message ?? "Unknown error"}`);
  }

  return mapGalleryRow(updated as GalleryItemRow);
}

export async function deleteGalleryItem(itemId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("gallery").delete().eq("id", itemId);

  if (error) {
    throw new Error(`Failed to delete gallery item: ${error.message}`);
  }
}

export async function getGalleryItemsByUser(
  userId: string,
  options: { page: number; limit: number }
): Promise<{ data: GalleryItem[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  const start = (options.page - 1) * options.limit;
  const end = start + options.limit - 1;

  const { data, error, count } = await supabase
    .from("gallery")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw new Error(`Failed to fetch user gallery items: ${error.message}`);
  }

  return {
    data: (data ?? []).map((row) => mapGalleryRow(row as GalleryItemRow)),
    total: count ?? 0
  };
}

export async function getPublicGallery(options: {
  page: number;
  limit: number;
  projectType?: string;
}): Promise<{ data: GalleryItem[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  const start = (options.page - 1) * options.limit;
  const end = start + options.limit - 1;

  let query = supabase
    .from("gallery")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (options.projectType) {
    query = query.eq("project_type", options.projectType);
  }

  const { data, error, count } = await query.range(start, end);

  if (error) {
    throw new Error(`Failed to fetch public gallery: ${error.message}`);
  }

  return {
    data: (data ?? []).map((row) => mapGalleryRow(row as GalleryItemRow)),
    total: count ?? 0
  };
}

export async function getFeaturedGalleryItems(limit: number): Promise<GalleryItem[]> {
  const supabase = await createServerSupabaseClient();
  const boundedLimit = Math.max(1, Math.min(limit, 100));
  const { data, error } = await supabase
    .from("gallery")
    .select("*")
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(`Failed to fetch featured gallery items: ${error.message}`);
  }

  return (data ?? []).map((row) => mapGalleryRow(row as GalleryItemRow));
}

// Server-only: uses cookies
export async function getPublicGalleryByUser(
  userId: string,
  options: { page: number; limit: number }
): Promise<{ data: GalleryItem[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  const start = (options.page - 1) * options.limit;
  const end = start + options.limit - 1;

  const { data, error, count } = await supabase
    .from("gallery")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(start, end);

  if (error) {
    throw new Error(`Failed to fetch public gallery for user: ${error.message}`);
  }

  return {
    data: (data ?? []).map((row) => mapGalleryRow(row as GalleryItemRow)),
    total: count ?? 0
  };
}
