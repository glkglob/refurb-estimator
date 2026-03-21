import type { Profile, ProfileUpdateInput, UserRole } from "@/lib/platform-types";
import { createClient } from "./client";
import { createServerSupabaseClient } from "./server";

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

function toUserRole(value: string): UserRole {
  if (value === "customer" || value === "tradesperson" || value === "admin") {
    return value;
  }
  return "customer";
}

function mapProfileUpdateInputToRow(data: ProfileUpdateInput): Partial<ProfileRow> {
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
  if (data.websiteUrl !== undefined) mapped.website_url = data.websiteUrl || null;
  if (data.isPublic !== undefined) mapped.is_public = data.isPublic;

  return mapped;
}

export function mapProfileRowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    role: toUserRole(row.role),
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

export async function getProfileById(userId: string): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  console.error("[getProfileById] query result:", {
    data,
    error: error?.message,
    userId
  });

  if (error) {
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapProfileRowToProfile(data as ProfileRow);
}

export async function getPublicProfile(userId: string): Promise<Profile | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .eq("is_public", true)
    .eq("role", "tradesperson")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch public profile: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return mapProfileRowToProfile(data as ProfileRow);
}

export async function updateProfile(userId: string, data: ProfileUpdateInput): Promise<Profile> {
  const supabase = await createServerSupabaseClient();
  const updates = {
    ...mapProfileUpdateInputToRow(data),
    updated_at: new Date().toISOString()
  };

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update profile: ${error?.message ?? "Profile not found"}`);
  }

  return mapProfileRowToProfile(updated as ProfileRow);
}

// Server-only: uses cookies
export async function listPublicTradespeople(options: {
  page: number;
  limit: number;
  specialty?: string;
  city?: string;
}): Promise<{ data: Profile[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  const start = (options.page - 1) * options.limit;
  const end = start + options.limit - 1;

  let query = supabase
    .from("profiles")
    .select("*", { count: "exact" })
    .eq("role", "tradesperson")
    .eq("is_public", true);

  if (options.specialty) {
    query = query.eq("trade_specialty", options.specialty);
  }

  if (options.city) {
    query = query.ilike("location_city", `%${options.city}%`);
  }

  const { data, error, count } = await query.range(start, end);

  if (error) {
    throw new Error(`Failed to list public tradespeople: ${error.message}`);
  }

  return {
    data: (data ?? []).map((row) => mapProfileRowToProfile(row as ProfileRow)),
    total: count ?? 0
  };
}

// Server-only: uses cookies
export async function listAllProfiles(options: {
  page: number;
  limit: number;
  role?: string;
  email?: string;
}): Promise<{ data: Profile[]; total: number }> {
  const supabase = await createServerSupabaseClient();
  const start = (options.page - 1) * options.limit;
  const end = start + options.limit - 1;

  let query = supabase.from("profiles").select("*", { count: "exact" });

  if (options.role) {
    query = query.eq("role", options.role);
  }

  if (options.email) {
    query = query.ilike("email", `%${options.email}%`);
  }

  const { data, error, count } = await query.range(start, end);

  if (error) {
    throw new Error(`Failed to list profiles: ${error.message}`);
  }

  return {
    data: (data ?? []).map((row) => mapProfileRowToProfile(row as ProfileRow)),
    total: count ?? 0
  };
}
