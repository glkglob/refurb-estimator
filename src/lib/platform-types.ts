// === User Roles ===
export type UserRole = "customer" | "tradesperson" | "admin";

// === Profiles ===
export type Profile = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  // Tradesperson fields
  businessName: string | null;
  tradeSpecialty: string | null;
  bio: string | null;
  yearsExperience: number | null;
  locationCity: string | null;
  locationPostcode: string | null;
  websiteUrl: string | null;
  serviceRadiusMiles: number | null;
  onboardingComplete: boolean;
  isVerified: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProfileUpdateInput = {
  displayName?: string;
  phone?: string;
  avatarUrl?: string;
  businessName?: string;
  tradeSpecialty?: string;
  bio?: string;
  yearsExperience?: number;
  locationCity?: string;
  locationPostcode?: string;
  websiteUrl?: string;
  isPublic?: boolean;
};

// === Gallery ===
export type ProjectType =
  | "kitchen"
  | "bathroom"
  | "full_refurb"
  | "extension"
  | "new_build"
  | "other";

export type GalleryItem = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  projectType: ProjectType | null;
  beforeImageUrl: string | null;
  locationCity: string | null;
  estimatedCost: number | null;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GalleryItemCreateInput = {
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  projectType?: ProjectType;
  beforeImageUrl?: string;
  locationCity?: string;
  estimatedCost?: number;
};

// === Notifications ===
export type NotificationType = "estimate_request" | "message" | "system" | "review";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};
