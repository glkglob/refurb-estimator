"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Camera,
  FileText,
  Images,
  UserCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import { loadScenarios } from "@/lib/dataService";
import type { GalleryItem, Profile } from "@/lib/platform-types";

type GalleryResponse = {
  data: GalleryItem[];
  total: number;
  page: number;
  limit: number;
};

export default function DashboardHomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentGallery, setRecentGallery] = useState<GalleryItem[]>([]);
  const [galleryCount, setGalleryCount] = useState(0);
  const [scenarioCount, setScenarioCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadDashboardData() {
      setIsLoading(true);
      setError(null);

      try {
        const [profileResponse, galleryResponse, notificationsResponse, scenariosResult] =
          await Promise.all([
            apiFetch("/api/v1/profile"),
            apiFetch("/api/v1/gallery/my?page=1&limit=4"),
            apiFetch("/api/v1/notifications/count").catch((notificationsError: unknown) => {
              if (
                isApiFetchError(notificationsError) &&
                notificationsError.status === 401
              ) {
                return null;
              }

              throw notificationsError;
            }),
            loadScenarios().catch((loadError: unknown) => {
              const fallback =
                loadError &&
                typeof loadError === "object" &&
                "fallbackData" in loadError &&
                Array.isArray((loadError as { fallbackData?: unknown }).fallbackData)
                  ? ((loadError as { fallbackData: unknown[] }).fallbackData as unknown[])
                  : [];
              return fallback;
            })
          ]);

        const profilePayload = (await profileResponse.json()) as Profile;
        const galleryPayload = (await galleryResponse.json()) as GalleryResponse;

        let unread = 0;
        if (notificationsResponse) {
          const notificationsPayload = (await notificationsResponse
            .json()
            .catch(() => null)) as unknown;
          const value =
            notificationsPayload && typeof notificationsPayload === "object"
              ? (notificationsPayload as { unreadCount?: unknown }).unreadCount
              : undefined;
          unread = typeof value === "number" ? value : 0;
        }

        if (!isActive) {
          return;
        }

        const galleryData = galleryPayload as GalleryResponse;
        setProfile(profilePayload as Profile);
        setRecentGallery(galleryData.data ?? []);
        setGalleryCount(galleryData.total ?? 0);
        setUnreadCount(unread);
        setScenarioCount(Array.isArray(scenariosResult) ? scenariosResult.length : 0);
      } catch (loadError) {
        if (isApiFetchError(loadError) && loadError.status === 401) {
          router.replace("/auth/login");
          return;
        }

        if (!isActive) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load dashboard data."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboardData();

    return () => {
      isActive = false;
    };
  }, [router]);

  const displayName = profile?.displayName || profile?.email || "there";

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome back, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Manage your profile, portfolio, and notifications from one place.
        </p>
      </header>

      {profile && profile.role !== "tradesperson" ? (
        <Card className="bp-warning">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-destructive">
              Upgrade to a tradesperson account to access the full dashboard.
            </p>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/profile">Complete Profile</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Profile Views</p>
          <p className="mt-2 text-base font-medium text-foreground">Coming soon</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Gallery Items</p>
          <p className="mt-2 font-mono text-2xl text-primary">
            {isLoading ? "…" : galleryCount}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Saved Estimates</p>
          <p className="mt-2 font-mono text-2xl text-primary">
            {isLoading ? "…" : scenarioCount}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">Unread Notifications</p>
            {unreadCount > 0 ? (
              <Badge className="border border-destructive/40 bg-destructive/15 text-destructive">
                {unreadCount}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 font-mono text-2xl text-primary">
            {isLoading ? "…" : unreadCount}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Recent Gallery</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/gallery">
              View all
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentGallery.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No gallery items yet. Add project photos to grow your public portfolio.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {recentGallery.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-md border border-border">
                  <div className="relative h-24 w-full bg-input">
                    <NextImage
                      src={item.thumbnailUrl ?? item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="line-clamp-1 text-xs font-medium text-foreground">{item.title}</p>
                    {item.estimatedCost !== null ? (
                      <p className="text-xs font-mono text-primary">
                        £{item.estimatedCost.toLocaleString("en-GB")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No cost provided</p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/profile">
              <UserCircle className="size-4" />
              Edit Profile
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/gallery">
              <Images className="size-4" />
              Add Project Photo
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <FileText className="size-4" />
              Create Estimate
            </Link>
          </Button>
          <Button variant="outline" asChild disabled={!profile}>
            <Link href={profile ? `/tradespeople/${profile.id}` : "#"}>
              <Camera className="size-4" />
              View Public Profile
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/notifications">
              <Bell className="size-4" />
              Notifications
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
