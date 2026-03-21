"use client";

import NextImage from "next/image";
import { Loader2, Upload, UserCircle2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import type { Profile } from "@/lib/platform-types";

type FieldName =
  | "displayName"
  | "phone"
  | "businessName"
  | "tradeSpecialty"
  | "bio"
  | "yearsExperience"
  | "locationCity"
  | "locationPostcode"
  | "websiteUrl"
  | "avatarUrl";

type FormState = {
  displayName: string;
  phone: string;
  businessName: string;
  tradeSpecialty: string;
  bio: string;
  yearsExperience: string;
  locationCity: string;
  locationPostcode: string;
  websiteUrl: string;
  isPublic: boolean;
  avatarUrl: string;
};

const TRADE_SPECIALTIES = [
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

function toFormState(profile: Profile): FormState {
  return {
    displayName: profile.displayName ?? "",
    phone: profile.phone ?? "",
    businessName: profile.businessName ?? "",
    tradeSpecialty: profile.tradeSpecialty ?? "",
    bio: profile.bio ?? "",
    yearsExperience: profile.yearsExperience === null ? "" : String(profile.yearsExperience),
    locationCity: profile.locationCity ?? "",
    locationPostcode: profile.locationPostcode ?? "",
    websiteUrl: profile.websiteUrl ?? "",
    isPublic: profile.isPublic,
    avatarUrl: profile.avatarUrl ?? ""
  };
}

function validate(form: FormState): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  if (form.displayName.trim().length > 100) {
    errors.displayName = "Display name must be 100 characters or less.";
  }
  if (form.phone.trim().length > 20) {
    errors.phone = "Phone number must be 20 characters or less.";
  }
  if (form.businessName.trim().length > 200) {
    errors.businessName = "Business name must be 200 characters or less.";
  }
  if (form.tradeSpecialty.trim().length > 100) {
    errors.tradeSpecialty = "Trade specialty must be 100 characters or less.";
  }
  if (form.bio.length > 2000) {
    errors.bio = "Bio must be 2000 characters or less.";
  }
  if (form.locationCity.trim().length > 100) {
    errors.locationCity = "City must be 100 characters or less.";
  }
  if (form.locationPostcode.trim().length > 10) {
    errors.locationPostcode = "Postcode must be 10 characters or less.";
  }
  if (form.websiteUrl.trim().length > 500) {
    errors.websiteUrl = "Website URL must be 500 characters or less.";
  } else if (form.websiteUrl.trim().length > 0) {
    try {
      const url = new URL(form.websiteUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.websiteUrl = "Website URL must start with http:// or https://.";
      }
    } catch {
      errors.websiteUrl = "Please enter a valid website URL.";
    }
  }

  if (form.yearsExperience.trim().length > 0) {
    const parsed = Number(form.yearsExperience);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 70) {
      errors.yearsExperience = "Years of experience must be a whole number between 0 and 70.";
    }
  }

  return errors;
}

export default function DashboardProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});

  useEffect(() => {
    let isActive = true;

    async function fetchProfile() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await apiFetch("/api/v1/profile");
        const payload = (await response.json()) as Profile;

        if (!isActive) {
          return;
        }

        setForm(toFormState(payload));
      } catch (error) {
        if (!isActive) {
          return;
        }
        if (isApiFetchError(error) && error.status === 401) {
          router.replace("/auth/login");
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Unable to load profile.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchProfile();

    return () => {
      isActive = false;
    };
  }, [router]);

  const bioLength = useMemo(() => form?.bio.length ?? 0, [form]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => (previous ? { ...previous, [field]: value } : previous));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files || event.target.files.length === 0 || !form) {
      return;
    }

    const file = event.target.files[0];
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setErrors((previous) => ({
        ...previous,
        avatarUrl: "Avatar must be a JPEG, PNG, or WebP image."
      }));
      return;
    }

    setIsUploadingAvatar(true);
    setErrors((previous) => ({ ...previous, avatarUrl: undefined }));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/v1/upload", {
        method: "POST",
        body: formData
      });

      if (!uploadResponse.ok) {
        const errPayload = (await uploadResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(errPayload.error ?? "Upload failed");
      }

      const uploadPayload = (await uploadResponse.json()) as { url: string };

      if (!uploadPayload.url) {
        throw new Error("Upload response did not include a valid URL.");
      }

      const patchResponse = await apiFetch("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify({ avatarUrl: uploadPayload.url })
      });
      const patchPayload = (await patchResponse.json()) as Profile;

      setForm(toFormState(patchPayload));
      toast({
        title: "Avatar updated",
        description: "Your profile photo has been updated."
      });
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login");
        return;
      }
      setErrors((previous) => ({
        ...previous,
        avatarUrl: error instanceof Error ? error.message : "Failed to upload avatar."
      }));
    } finally {
      event.target.value = "";
      setIsUploadingAvatar(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    const validationErrors = validate(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    const yearsExperienceValue =
      form.yearsExperience.trim().length > 0 ? Number(form.yearsExperience) : undefined;

    const payload = {
      displayName: form.displayName.trim() || undefined,
      phone: form.phone.trim() || undefined,
      businessName: form.businessName.trim() || undefined,
      tradeSpecialty: form.tradeSpecialty.trim() || undefined,
      bio: form.bio.trim() || undefined,
      yearsExperience: yearsExperienceValue,
      locationCity: form.locationCity.trim() || undefined,
      locationPostcode: form.locationPostcode.trim() || undefined,
      websiteUrl: form.websiteUrl.trim(),
      isPublic: form.isPublic
    };

    setIsSaving(true);
    try {
      const response = await apiFetch("/api/v1/profile", {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      const responsePayload = (await response.json()) as Profile;

      setForm(toFormState(responsePayload));
      toast({
        title: "Profile saved",
        description: "Your profile changes have been saved."
      });
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login");
        return;
      }
      toast({
        title: "Unable to save profile",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Edit Profile</h1>
        <Card className="bp-card-border">
          <CardContent className="space-y-3 p-6">
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      </section>
    );
  }

  if (!form) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Edit Profile</h1>
        <Card className="bp-card-border">
          <CardContent className="p-6">
            <p className="text-sm text-destructive">{loadError ?? "Profile data is unavailable."}</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Edit Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your tradesperson profile details and public listing preferences.
        </p>
      </div>

      <Card className="bg-card bp-card-border">
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSave}>
            <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
              <Label className="text-foreground">Avatar</Label>
              <div className="flex items-center gap-4">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-input">
                  {form.avatarUrl ? (
                    <NextImage
                      src={form.avatarUrl}
                      alt="Profile avatar"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <UserCircle2 className="size-8 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                    Upload photo
                  </Button>
                  {errors.avatarUrl ? (
                    <p className="text-xs text-destructive">{errors.avatarUrl}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="display-name" className="text-foreground">
                  Display Name
                </Label>
                <Input
                  id="display-name"
                  value={form.displayName}
                  onChange={(event) => setField("displayName", event.target.value)}
                  placeholder="Your name"
                />
                {errors.displayName ? (
                  <p className="text-xs text-destructive">{errors.displayName}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">
                  Phone
                </Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => setField("phone", event.target.value)}
                  placeholder="e.g. 07123 456789"
                />
                {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="business-name" className="text-foreground">
                  Business Name
                </Label>
                <Input
                  id="business-name"
                  value={form.businessName}
                  onChange={(event) => setField("businessName", event.target.value)}
                  placeholder="Your business"
                />
                {errors.businessName ? (
                  <p className="text-xs text-destructive">{errors.businessName}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Trade Specialty</Label>
                <Select
                  value={form.tradeSpecialty || "unset"}
                  onValueChange={(value) =>
                    setField("tradeSpecialty", value === "unset" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a specialty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    {TRADE_SPECIALTIES.map((specialty) => (
                      <SelectItem key={specialty} value={specialty}>
                        {specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.tradeSpecialty ? (
                  <p className="text-xs text-destructive">{errors.tradeSpecialty}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="text-foreground">
                Bio
              </Label>
              <textarea
                id="bio"
                value={form.bio}
                onChange={(event) => setField("bio", event.target.value)}
                maxLength={2000}
                className="bp-focus-ring min-h-28 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                placeholder="Tell homeowners about your experience and services."
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Maximum 2000 characters</span>
                <span className="font-mono">{bioLength}/2000</span>
              </div>
              {errors.bio ? <p className="text-xs text-destructive">{errors.bio}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="experience" className="text-foreground">
                  Years of Experience
                </Label>
                <Input
                  id="experience"
                  type="number"
                  min={0}
                  max={70}
                  value={form.yearsExperience}
                  onChange={(event) => setField("yearsExperience", event.target.value)}
                  placeholder="e.g. 12"
                />
                {errors.yearsExperience ? (
                  <p className="text-xs text-destructive">{errors.yearsExperience}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city" className="text-foreground">
                  City
                </Label>
                <Input
                  id="city"
                  value={form.locationCity}
                  onChange={(event) => setField("locationCity", event.target.value)}
                  placeholder="e.g. Manchester"
                />
                {errors.locationCity ? (
                  <p className="text-xs text-destructive">{errors.locationCity}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="postcode" className="text-foreground">
                  Postcode
                </Label>
                <Input
                  id="postcode"
                  value={form.locationPostcode}
                  onChange={(event) => setField("locationPostcode", event.target.value)}
                  placeholder="e.g. SW1A 1AA"
                />
                {errors.locationPostcode ? (
                  <p className="text-xs text-destructive">{errors.locationPostcode}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="website-url" className="text-foreground">
                  Website URL
                </Label>
                <Input
                  id="website-url"
                  value={form.websiteUrl}
                  onChange={(event) => setField("websiteUrl", event.target.value)}
                  placeholder="https://example.com"
                />
                {errors.websiteUrl ? (
                  <p className="text-xs text-destructive">{errors.websiteUrl}</p>
                ) : null}
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={form.isPublic}
                onChange={(event) => setField("isPublic", event.target.checked)}
              />
              Make profile public
            </label>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
