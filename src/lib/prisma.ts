import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  EstimateInput,
  EstimateResult
} from "@/lib/types";
import type {
  GalleryItem,
  Notification,
  Profile,
  ProfileUpdateInput,
  UserRole
} from "@/lib/platform-types";

type ScenarioRow = {
  id: string;
  user_id: string;
  name: string;
  input: EstimateInput;
  result: EstimateResult;
  purchase_price: number | string | null;
  gdv: number | string | null;
  created_at: string;
  updated_at: string;
};

type GalleryItemRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  image_url: string;
  thumbnail_url: string | null;
  project_type: string | null;
  before_image_url: string | null;
  location_city: string | null;
  estimated_cost: number | string | null;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  user_id: string;
  type: Notification["type"];
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  business_name: string | null;
  trade_specialty: string | null;
  bio: string | null;
  years_experience: number | null;
  location_city: string | null;
  location_postcode: string | null;
  website_url: string | null;
  service_radius_miles: number | null;
  onboarding_complete: boolean | null;
  is_verified: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type ScenarioRecord = {
  id: string;
  userId: string;
  name: string;
  input: EstimateInput;
  result: EstimateResult;
  purchasePrice: number | null;
  gdv: number | null;
  createdAt: string;
  updatedAt: string;
};

type ScenarioCreateData = {
  userId: string;
  name: string;
  input: EstimateInput;
  result: EstimateResult;
  purchasePrice?: number;
  gdv?: number;
};

function toOptionalNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRole(role: string): UserRole {
  if (role === "customer" || role === "tradesperson" || role === "admin") {
    return role;
  }
  return "customer";
}

function mapScenarioRow(row: ScenarioRow): ScenarioRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    input: row.input,
    result: row.result,
    purchasePrice: toOptionalNumber(row.purchase_price),
    gdv: toOptionalNumber(row.gdv),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapGalleryRow(row: GalleryItemRow): GalleryItem {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    thumbnailUrl: row.thumbnail_url,
    projectType: row.project_type as GalleryItem["projectType"],
    beforeImageUrl: row.before_image_url,
    locationCity: row.location_city,
    estimatedCost: toOptionalNumber(row.estimated_cost),
    isFeatured: row.is_featured,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    isRead: row.is_read,
    createdAt: row.created_at
  };
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    role: toRole(row.role),
    displayName: row.display_name,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    businessName: row.business_name,
    tradeSpecialty: row.trade_specialty,
    bio: row.bio,
    yearsExperience: row.years_experience,
    locationCity: row.location_city,
    locationPostcode: row.location_postcode,
    websiteUrl: row.website_url,
    serviceRadiusMiles: row.service_radius_miles,
    onboardingComplete: row.onboarding_complete ?? false,
    isVerified: row.is_verified,
    isPublic: row.is_public,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapProfileUpdateInput(data: ProfileUpdateInput): Partial<ProfileRow> {
  const mapped: Partial<ProfileRow> = {};

  if (data.displayName !== undefined) mapped.display_name = data.displayName;
  if (data.phone !== undefined) mapped.phone = data.phone;
  if (data.avatarUrl !== undefined) mapped.avatar_url = data.avatarUrl;
  if (data.businessName !== undefined) mapped.business_name = data.businessName;
  if (data.tradeSpecialty !== undefined) mapped.trade_specialty = data.tradeSpecialty;
  if (data.bio !== undefined) mapped.bio = data.bio;
  if (data.yearsExperience !== undefined) mapped.years_experience = data.yearsExperience;
  if (data.locationCity !== undefined) mapped.location_city = data.locationCity;
  if (data.locationPostcode !== undefined) mapped.location_postcode = data.locationPostcode;
  if (data.websiteUrl !== undefined) {
    mapped.website_url = data.websiteUrl ? data.websiteUrl : null;
  }
  if (data.isPublic !== undefined) mapped.is_public = data.isPublic;

  return mapped;
}

export const prisma = {
  scenario: {
    async findMany(options: {
      where: { userId: string };
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
    }): Promise<ScenarioRecord[]> {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from("scenarios")
        .select("*")
        .eq("user_id", options.where.userId)
        .order("created_at", {
          ascending: options.orderBy?.createdAt === "asc"
        });

      if (options.take !== undefined) {
        query = query.limit(options.take);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch scenarios: ${error.message}`);
      }

      return (data ?? []).map((row) => mapScenarioRow(row as ScenarioRow));
    },

    async findUnique(options: {
      where: { id: string; userId?: string };
    }): Promise<ScenarioRecord | null> {
      const supabase = await createServerSupabaseClient();
      let query = supabase.from("scenarios").select("*").eq("id", options.where.id);

      if (options.where.userId) {
        query = query.eq("user_id", options.where.userId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) {
        throw new Error(`Failed to fetch scenario: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return mapScenarioRow(data as ScenarioRow);
    },

    async create(options: { data: ScenarioCreateData }): Promise<ScenarioRecord> {
      const supabase = await createServerSupabaseClient();
      const payload = {
        user_id: options.data.userId,
        name: options.data.name,
        input: options.data.input,
        result: options.data.result,
        purchase_price: options.data.purchasePrice ?? null,
        gdv: options.data.gdv ?? null
      };

      const { data, error } = await supabase
        .from("scenarios")
        .insert(payload)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          `Failed to create scenario: ${error?.message ?? "Unknown error"}`
        );
      }

      return mapScenarioRow(data as ScenarioRow);
    }
  },

  galleryItem: {
    async findMany(options: {
      where: { userId: string };
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
    }): Promise<GalleryItem[]> {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from("gallery_items")
        .select("*")
        .eq("user_id", options.where.userId)
        .order("created_at", {
          ascending: options.orderBy?.createdAt === "asc"
        });

      if (options.take !== undefined) {
        query = query.limit(options.take);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch gallery items: ${error.message}`);
      }

      return (data ?? []).map((row) => mapGalleryRow(row as GalleryItemRow));
    }
  },

  notification: {
    async findMany(options: {
      where: { userId: string; isRead?: boolean };
      orderBy?: { createdAt: "asc" | "desc" };
      take?: number;
    }): Promise<Notification[]> {
      const supabase = await createServerSupabaseClient();
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("user_id", options.where.userId)
        .order("created_at", {
          ascending: options.orderBy?.createdAt === "asc"
        });

      if (options.where.isRead !== undefined) {
        query = query.eq("is_read", options.where.isRead);
      }

      if (options.take !== undefined) {
        query = query.limit(options.take);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }

      return (data ?? []).map((row) => mapNotificationRow(row as NotificationRow));
    },

    async update(options: {
      where: { id: string; userId: string };
      data: { isRead: boolean };
    }): Promise<Notification> {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("notifications")
        .update({ is_read: options.data.isRead })
        .eq("id", options.where.id)
        .eq("user_id", options.where.userId)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          `Failed to update notification: ${error?.message ?? "Unknown error"}`
        );
      }

      return mapNotificationRow(data as NotificationRow);
    }
  },

  profile: {
    async findUnique(options: { where: { id: string } }): Promise<Profile | null> {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", options.where.id)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch profile: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      return mapProfileRow(data as ProfileRow);
    },

    async update(options: {
      where: { id: string };
      data: ProfileUpdateInput;
    }): Promise<Profile> {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase
        .from("profiles")
        .update({
          ...mapProfileUpdateInput(options.data),
          updated_at: new Date().toISOString()
        })
        .eq("id", options.where.id)
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(
          `Failed to update profile: ${error?.message ?? "Unknown error"}`
        );
      }

      return mapProfileRow(data as ProfileRow);
    }
  }
};

export type PrismaClient = typeof prisma;
