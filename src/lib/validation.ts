import { z } from "zod";

export const profileUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional(),
  businessName: z.string().max(200).optional(),
  tradeSpecialty: z.string().max(100).optional(),
  bio: z.string().max(2000).optional(),
  yearsExperience: z.number().int().min(0).max(70).optional(),
  locationCity: z.string().max(100).optional(),
  locationPostcode: z.string().max(10).optional(),
  websiteUrl: z.string().url().max(500).optional().or(z.literal("")),
  isPublic: z.boolean().optional()
});

export const galleryItemCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  projectType: z
    .enum(["kitchen", "bathroom", "full_refurb", "extension", "new_build", "other"])
    .optional(),
  beforeImageUrl: z.string().url().optional(),
  locationCity: z.string().max(100).optional(),
  estimatedCost: z.number().positive().max(10_000_000).optional()
});

export const galleryItemUpdateSchema = galleryItemCreateSchema.partial();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type ProfileUpdatePayload = z.infer<typeof profileUpdateSchema>;
export type GalleryItemCreatePayload = z.infer<typeof galleryItemCreateSchema>;
export type GalleryItemUpdatePayload = z.infer<typeof galleryItemUpdateSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
