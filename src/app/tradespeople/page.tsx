import NextImage from "next/image";
import Link from "next/link";
import { MapPin, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listPublicTradespeople } from "@/lib/supabase/profiles-db";

const TRADE_SPECIALTY_OPTIONS = [
  "General Builder",
  "Kitchen Fitter",
  "Bathroom Fitter",
  "Electrician",
  "Plumber",
  "Plasterer",
  "Decorator",
  "Roofer",
  "Carpenter",
  "Landscaper",
  "Other"
] as const;

type PageProps = {
  searchParams?:
    | {
        specialty?: string;
        city?: string;
      }
    | Promise<{
        specialty?: string;
        city?: string;
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

export default async function TradespeoplePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const specialty =
    typeof resolvedSearchParams.specialty === "string" &&
    resolvedSearchParams.specialty.trim().length > 0
      ? resolvedSearchParams.specialty.trim()
      : undefined;
  const city =
    typeof resolvedSearchParams.city === "string" && resolvedSearchParams.city.trim().length > 0
      ? resolvedSearchParams.city.trim()
      : undefined;

  const { data: profiles } = await listPublicTradespeople({
    page: 1,
    limit: 20,
    specialty,
    city
  });

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Find a Tradesperson</h1>
        <p className="text-sm text-muted-foreground">
          Browse verified professionals and compare portfolios before requesting quotes.
        </p>
      </header>

      <Card>
        <CardContent className="p-4">
          <form method="get" className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="space-y-1 text-sm text-muted-foreground">
              Specialty
              <select
                name="specialty"
                defaultValue={specialty ?? ""}
                className="bp-focus-ring flex h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:outline-none"
              >
                <option value="">All specialties</option>
                {TRADE_SPECIALTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-muted-foreground">
              City
              <input
                name="city"
                defaultValue={city ?? ""}
                placeholder="e.g. Manchester"
                className="bp-focus-ring flex h-10 w-full rounded-md border border-border bg-input px-3 text-sm text-foreground focus:outline-none"
              />
            </label>

            <div className="flex items-end">
              <Button type="submit" variant="outline" className="w-full md:w-auto">
                Apply filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {profiles.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              No public tradespeople matched your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {profiles.map((profile) => {
            const displayName = profile.businessName ?? profile.displayName ?? "Tradesperson";
            const location =
              profile.locationCity && profile.locationPostcode
                ? `${profile.locationCity}, ${profile.locationPostcode}`
                : profile.locationCity ?? profile.locationPostcode ?? "Location not provided";

            return (
              <Card key={profile.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center gap-3">
                    {profile.avatarUrl ? (
                      <div className="relative h-12 w-12 overflow-hidden rounded-full border border-border">
                        <NextImage
                          src={profile.avatarUrl}
                          alt={displayName}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-input text-sm font-semibold text-primary">
                        {toInitials(displayName)}
                      </div>
                    )}
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium text-foreground">{displayName}</p>
                      {profile.tradeSpecialty ? (
                        <Badge variant="secondary" className="max-w-full truncate">
                          <Wrench className="size-3" />
                          {profile.tradeSpecialty}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-4" />
                    <span className="truncate">{location}</span>
                  </p>

                  <p className="text-sm text-muted-foreground">
                    {profile.yearsExperience !== null
                      ? `${profile.yearsExperience}+ years experience`
                      : "Experience not specified"}
                  </p>

                  <Button variant="outline" className="w-full" asChild>
                    <Link href={`/tradespeople/${profile.id}`}>View Profile</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
