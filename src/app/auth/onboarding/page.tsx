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

type TradeType = "plumber" | "electrician" | "builder" | "decorator" | "general";

type FormState = {
  businessName: string;
  tradeType: TradeType;
  yearsExperience: string;
  servicePostcode: string;
  serviceRadiusMiles: string;
  profilePhotoUrl: string;
  bio: string;
};

type UploadPresignResponse = {
  uploadUrl: string;
  key: string;
};

type UploadConfirmResponse = {
  url: string;
};

type FieldName = keyof FormState;

const TRADE_OPTIONS: Array<{ value: TradeType; label: string }> = [
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "builder", label: "Builder" },
  { value: "decorator", label: "Decorator" },
  { value: "general", label: "General" }
];

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

function normaliseTradeType(value: string | null): TradeType {
  if (!value) {
    return "general";
  }

  const normalised = value.trim().toLowerCase();
  if (normalised === "plumber") return "plumber";
  if (normalised === "electrician") return "electrician";
  if (normalised === "builder") return "builder";
  if (normalised === "decorator") return "decorator";
  if (normalised === "general" || normalised === "general builder") return "general";
  return "general";
}

function toFormState(profile: Profile): FormState {
  return {
    businessName: profile.businessName ?? "",
    tradeType: normaliseTradeType(profile.tradeSpecialty),
    yearsExperience: profile.yearsExperience === null ? "" : String(profile.yearsExperience),
    servicePostcode: profile.locationPostcode ?? "",
    serviceRadiusMiles: profile.serviceRadiusMiles ? String(profile.serviceRadiusMiles) : "10",
    profilePhotoUrl: profile.avatarUrl ?? "",
    bio: profile.bio ?? ""
  };
}

function validateStep(step: number, form: FormState): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};

  if (step === 1 || step === 4) {
    if (form.businessName.trim().length === 0) {
      errors.businessName = "Business name is required.";
    }
    if (form.businessName.trim().length > 200) {
      errors.businessName = "Business name must be 200 characters or less.";
    }

    const yearsExperience = Number(form.yearsExperience);
    if (form.yearsExperience.trim().length === 0) {
      errors.yearsExperience = "Years of experience is required.";
    } else if (
      !Number.isInteger(yearsExperience) ||
      yearsExperience < 0 ||
      yearsExperience > 70
    ) {
      errors.yearsExperience = "Years of experience must be a whole number between 0 and 70.";
    }
  }

  if (step === 2 || step === 4) {
    if (form.servicePostcode.trim().length < 2) {
      errors.servicePostcode = "Enter a valid postcode.";
    } else if (form.servicePostcode.trim().length > 10) {
      errors.servicePostcode = "Postcode must be 10 characters or less.";
    }

    if (!RADIUS_OPTIONS.includes(Number(form.serviceRadiusMiles) as (typeof RADIUS_OPTIONS)[number])) {
      errors.serviceRadiusMiles = "Select a service radius.";
    }
  }

  if (step === 3 || step === 4) {
    if (form.profilePhotoUrl.trim().length === 0) {
      errors.profilePhotoUrl = "Profile photo is required.";
    }

    if (form.bio.trim().length < 10) {
      errors.bio = "Bio must be at least 10 characters.";
    } else if (form.bio.length > 2000) {
      errors.bio = "Bio must be 2000 characters or less.";
    }
  }

  return errors;
}

export default function OnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentProfile() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await apiFetch("/api/v1/profile");
        const payload = (await response.json()) as Profile;

        if (!isActive) {
          return;
        }

        if (payload.role !== "tradesperson") {
          router.replace("/dashboard");
          return;
        }

        if (payload.onboardingComplete) {
          router.replace("/dashboard");
          return;
        }

        setForm(toFormState(payload));
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isApiFetchError(error) && error.status === 401) {
          router.replace("/auth/login?redirectedFrom=/auth/onboarding");
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Unable to load onboarding.");
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCurrentProfile();

    return () => {
      isActive = false;
    };
  }, [router]);

  const bioLength = useMemo(() => form?.bio.length ?? 0, [form]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((previous) => (previous ? { ...previous, [field]: value } : previous));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function handleNextStep() {
    if (!form) {
      return;
    }

    const stepErrors = validateStep(step, form);
    setErrors((previous) => ({ ...previous, ...stepErrors }));
    if (Object.keys(stepErrors).length > 0) {
      return;
    }

    setStep((previous) => Math.min(previous + 1, 3));
  }

  function handlePreviousStep() {
    setStep((previous) => Math.max(previous - 1, 1));
  }

  async function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files || event.target.files.length === 0 || !form) {
      return;
    }

    const file = event.target.files[0];
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setErrors((previous) => ({
        ...previous,
        profilePhotoUrl: "Photo must be a JPEG, PNG, or WebP image."
      }));
      return;
    }

    setIsUploadingPhoto(true);
    setErrors((previous) => ({ ...previous, profilePhotoUrl: undefined }));

    try {
      const presignResponse = await apiFetch("/api/v1/upload", {
        method: "POST",
        body: JSON.stringify({
          action: "presign",
          bucket: "avatars",
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        })
      });
      const presignPayload = (await presignResponse.json()) as UploadPresignResponse;

      const putResponse = await fetch(presignPayload.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type
        },
        body: file
      });
      if (!putResponse.ok) {
        throw new Error("Failed to upload photo directly to storage.");
      }

      const confirmResponse = await apiFetch("/api/v1/upload", {
        method: "POST",
        body: JSON.stringify({
          action: "confirm",
          bucket: "avatars",
          key: presignPayload.key
        })
      });
      const confirmPayload = (await confirmResponse.json()) as UploadConfirmResponse;

      if (typeof confirmPayload.url !== "string" || confirmPayload.url.trim().length === 0) {
        throw new Error("Upload response did not include a valid URL.");
      }

      setField("profilePhotoUrl", confirmPayload.url);
      toast({
        title: "Photo uploaded",
        description: "Your profile photo is ready."
      });
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login?redirectedFrom=/auth/onboarding");
        return;
      }
      setErrors((previous) => ({
        ...previous,
        profilePhotoUrl: error instanceof Error ? error.message : "Failed to upload photo."
      }));
    } finally {
      event.target.value = "";
      setIsUploadingPhoto(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) {
      return;
    }

    const validationErrors = validateStep(4, form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      if (validationErrors.businessName || validationErrors.yearsExperience) {
        setStep(1);
      } else if (validationErrors.servicePostcode || validationErrors.serviceRadiusMiles) {
        setStep(2);
      } else {
        setStep(3);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      await apiFetch("/api/v1/onboarding", {
        method: "POST",
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          tradeType: form.tradeType,
          yearsExperience: Number(form.yearsExperience),
          servicePostcode: form.servicePostcode.trim().toUpperCase(),
          serviceRadiusMiles: Number(form.serviceRadiusMiles),
          profilePhotoUrl: form.profilePhotoUrl,
          bio: form.bio.trim()
        })
      });

      toast({
        title: "Onboarding complete",
        description: "Your tradesperson profile has been set up."
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login?redirectedFrom=/auth/onboarding");
        return;
      }

      toast({
        title: "Unable to complete onboarding",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <section className="mx-auto w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Tradesperson onboarding</h1>
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
      <section className="mx-auto w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold text-foreground">Tradesperson onboarding</h1>
        <Card className="bp-card-border">
          <CardContent className="p-6">
            <p className="text-sm text-destructive">{loadError ?? "Onboarding is unavailable."}</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Tradesperson onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Complete your profile to start appearing in the tradesperson experience.
        </p>
      </header>

      <Card className="bg-card bp-card-border">
        <CardHeader className="space-y-3">
          <CardTitle>Step {step} of 3</CardTitle>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((stepNumber) => (
              <div
                key={stepNumber}
                className={
                  stepNumber <= step
                    ? "h-1.5 rounded-full bg-primary"
                    : "h-1.5 rounded-full bg-muted"
                }
              />
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            {step === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="business-name" className="text-foreground">
                    Business name
                  </Label>
                  <Input
                    id="business-name"
                    value={form.businessName}
                    onChange={(event) => setField("businessName", event.target.value)}
                    placeholder="Your business name"
                  />
                  {errors.businessName ? (
                    <p className="text-xs text-destructive">{errors.businessName}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trade-type" className="text-foreground">
                    Trade type
                  </Label>
                  <Select
                    value={form.tradeType}
                    onValueChange={(value) => setField("tradeType", value as TradeType)}
                  >
                    <SelectTrigger id="trade-type">
                      <SelectValue placeholder="Select a trade type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRADE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="years-experience" className="text-foreground">
                    Years experience
                  </Label>
                  <Input
                    id="years-experience"
                    type="number"
                    min={0}
                    max={70}
                    value={form.yearsExperience}
                    onChange={(event) => setField("yearsExperience", event.target.value)}
                    placeholder="e.g. 8"
                  />
                  {errors.yearsExperience ? (
                    <p className="text-xs text-destructive">{errors.yearsExperience}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service-postcode" className="text-foreground">
                    Service area postcode
                  </Label>
                  <Input
                    id="service-postcode"
                    value={form.servicePostcode}
                    onChange={(event) => setField("servicePostcode", event.target.value)}
                    placeholder="e.g. SW1A"
                    maxLength={10}
                  />
                  {errors.servicePostcode ? (
                    <p className="text-xs text-destructive">{errors.servicePostcode}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service-radius" className="text-foreground">
                    Service radius
                  </Label>
                  <Select
                    value={form.serviceRadiusMiles}
                    onValueChange={(value) => setField("serviceRadiusMiles", value)}
                  >
                    <SelectTrigger id="service-radius">
                      <SelectValue placeholder="Select service radius" />
                    </SelectTrigger>
                    <SelectContent>
                      {RADIUS_OPTIONS.map((miles) => (
                        <SelectItem key={miles} value={String(miles)}>
                          {miles} miles
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.serviceRadiusMiles ? (
                    <p className="text-xs text-destructive">{errors.serviceRadiusMiles}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-4">
                <div className="space-y-3 rounded-lg border border-border bg-background/40 p-4">
                  <Label className="text-foreground">Profile photo</Label>
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-input">
                      {form.profilePhotoUrl ? (
                        <NextImage
                          src={form.profilePhotoUrl}
                          alt="Profile photo"
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
                        onChange={handlePhotoUpload}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingPhoto}
                      >
                        {isUploadingPhoto ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Upload className="size-4" />
                        )}
                        Upload profile photo
                      </Button>
                      {errors.profilePhotoUrl ? (
                        <p className="text-xs text-destructive">{errors.profilePhotoUrl}</p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio" className="text-foreground">
                    Short bio
                  </Label>
                  <textarea
                    id="bio"
                    value={form.bio}
                    onChange={(event) => setField("bio", event.target.value)}
                    maxLength={2000}
                    rows={5}
                    placeholder="Tell customers about your services and experience."
                    className="bp-focus-ring flex min-h-[120px] w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Minimum 10 characters</p>
                    <p className="font-mono text-xs text-muted-foreground">{bioLength}/2000</p>
                  </div>
                  {errors.bio ? <p className="text-xs text-destructive">{errors.bio}</p> : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={handlePreviousStep} disabled={step === 1 || isSubmitting}>
                Back
              </Button>

              {step < 3 ? (
                <Button type="button" onClick={handleNextStep}>
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting || isUploadingPhoto}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  Complete onboarding
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
