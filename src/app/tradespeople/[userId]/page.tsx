import NextImage from "next/image";
import Link from "next/link";
import { Calendar, ExternalLink, MapPin, Phone, Shield } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicGalleryByUser } from "@/lib/supabase/gallery-db";
import { getPublicProfile } from "@/lib/supabase/profiles-db";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PROJECT_TYPE_LABELS = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  full_refurb: "Full Refurb",
  extension: "Extension",
  new_build: "New Build",
  other: "Other"
} as const;

type PageProps = {
  params:
    | {
        userId: string;
      }
    | Promise<{
        userId: string;
      }>;
  searchParams?:
    | {
        view?: string;
      }
    | Promise<{
        view?: string;
      }>;
};

function toInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return "TR";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
}

export default async function TradespersonProfilePage({ params, searchParams }: PageProps) {
  const { userId } = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const showAllGallery = resolvedSearchParams.view === "all";
  const galleryLimit = showAllGallery ? 24 : 8;

  let profile: Awaited<ReturnType<typeof getPublicProfile>> = null;
  let galleryItems: Awaited<ReturnType<typeof getPublicGalleryByUser>>["data"] = [];
  let galleryTotal = 0;
  let isDirectoryUnavailable = false;

  try {
    profile = await getPublicProfile(userId);
  } catch (error) {
    isDirectoryUnavailable = true;
    console.error(
      "[TradespersonProfilePage] Unable to load trades profile. Showing fallback state.",
      error
    );
  }

  if (!isDirectoryUnavailable && !profile) {
    notFound();
  }

  if (!isDirectoryUnavailable && profile) {
    try {
      const galleryResult = await getPublicGalleryByUser(userId, {
        page: 1,
        limit: galleryLimit
      });
      galleryItems = galleryResult.data;
      galleryTotal = galleryResult.total;
    } catch (error) {
      isDirectoryUnavailable = true;
      console.error(
        "[TradespersonProfilePage] Unable to load trades gallery. Showing fallback state.",
        error
      );
    }
  }

  if (isDirectoryUnavailable || !profile) {
    return (
      <section className="space-y-6">
        <Card>
          <CardContent className="space-y-3 p-6">
            <h1 className="text-2xl font-semibold text-foreground">Tradesperson profile</h1>
            <p className="text-sm text-muted-foreground">
              This profile is temporarily unavailable. Please try again shortly.
            </p>
            <Button variant="outline" asChild>
              <Link href="/tradespeople">Back to directory</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  let isAuthenticated = false;
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    isAuthenticated = Boolean(user);
  } catch {
    isAuthenticated = false;
  }

  const displayName = profile.businessName ?? profile.displayName ?? "Tradesperson";
  const location =
    profile.locationCity && profile.locationPostcode
      ? `${profile.locationCity}, ${profile.locationPostcode}`
      : profile.locationCity ?? profile.locationPostcode ?? "Location not provided";

  return (
    <section className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {profile.avatarUrl ? (
              <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border">
                <NextImage
                  src={profile.avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-input text-xl font-semibold text-primary">
                {toInitials(displayName)}
              </div>
            )}

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {profile.tradeSpecialty ? (
                  <Badge variant="secondary">{profile.tradeSpecialty}</Badge>
                ) : null}
                {profile.isVerified ? (
                  <Badge className="border-primary/40 bg-primary/15 text-primary">
                    <Shield className="size-3.5" />
                    Verified
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MapPin className="size-4" />
                  {location}
                </p>
                {profile.yearsExperience !== null ? (
                  <p className="flex items-center gap-2">
                    <Calendar className="size-4" />
                    {profile.yearsExperience}+ years experience
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {profile.websiteUrl ? (
            <div>
              <Button variant="outline" asChild>
                <a href={profile.websiteUrl} target="_blank" rel="noreferrer">
                  Website
                  <ExternalLink className="size-4" />
                </a>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold text-foreground">Bio</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {profile.bio && profile.bio.trim().length > 0
              ? profile.bio
              : "No biography provided yet."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">Gallery</h2>
            {galleryTotal > 8 && !showAllGallery ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/tradespeople/${userId}?view=all`}>View all</Link>
              </Button>
            ) : null}
            {showAllGallery && galleryTotal > 8 ? (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/tradespeople/${userId}`}>Show less</Link>
              </Button>
            ) : null}
          </div>

          {galleryItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No gallery items published yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {galleryItems.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-lg border border-border">
                  <div className="relative h-28 w-full bg-input">
                    <NextImage
                      src={item.thumbnailUrl ?? item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{item.title}</p>
                    {item.projectType ? (
                      <Badge variant="secondary">
                        {PROJECT_TYPE_LABELS[item.projectType]}
                      </Badge>
                    ) : null}
                    {item.estimatedCost !== null ? (
                      <p className="font-mono text-sm text-primary">
                        £{item.estimatedCost.toLocaleString("en-GB")}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" asChild>
              <Link href="/">Request Estimate</Link>
            </Button>
            {isAuthenticated && profile.phone ? (
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="size-4" />
                {profile.phone}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sign in to view direct phone contact details.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
