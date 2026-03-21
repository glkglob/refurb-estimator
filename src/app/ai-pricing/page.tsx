"use client";

import { Loader2, Upload, X } from "lucide-react";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch } from "@/lib/apiClient";
import type { QuotePdfInput } from "@/lib/generateQuotePdf";

type PricingCondition = "poor" | "fair" | "good";

type PricingCategory = {
  name: string;
  low: number;
  typical: number;
  high: number;
  notes: string;
};

type PricingAgentResponse = {
  summary: string;
  categories: PricingCategory[];
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  advice: string;
};

const MAX_PHOTOS = 3;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const PROPERTY_TYPES = [
  "Terraced house",
  "Semi-detached house",
  "Detached house",
  "Flat/Apartment",
  "Bungalow",
  "Commercial unit",
  "Other"
] as const;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}

function isPricingAgentResponse(payload: unknown): payload is PricingAgentResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const data = payload as Record<string, unknown>;
  return (
    typeof data.summary === "string" &&
    Array.isArray(data.categories) &&
    typeof data.totalLow === "number" &&
    typeof data.totalTypical === "number" &&
    typeof data.totalHigh === "number" &&
    typeof data.advice === "string"
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Invalid image encoding for ${file.name}`));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export default function AiPricingPage() {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [propertyType, setPropertyType] = useState<string>(PROPERTY_TYPES[0]);
  const [location, setLocation] = useState<string>("");
  const [floorAreaM2, setFloorAreaM2] = useState<string>("");
  const [condition, setCondition] = useState<PricingCondition>("fair");
  const [scope, setScope] = useState<string>("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PricingAgentResponse | null>(null);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const canSubmit = useMemo(() => {
    const parsedArea = Number(floorAreaM2);
    return (
      propertyType.trim().length > 0 &&
      location.trim().length > 0 &&
      scope.trim().length > 0 &&
      Number.isFinite(parsedArea) &&
      parsedArea > 0 &&
      !isSubmitting
    );
  }, [floorAreaM2, isSubmitting, location, propertyType, scope]);

  function setPhotoFiles(nextFiles: File[]) {
    setErrorMessage(null);

    if (nextFiles.length > MAX_PHOTOS) {
      setErrorMessage(`You can upload up to ${MAX_PHOTOS} photos.`);
      return;
    }

    for (const file of nextFiles) {
      if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
        setErrorMessage("Please upload JPEG, PNG, or WebP images only.");
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        setErrorMessage("Each image must be 20MB or smaller.");
        return;
      }
    }

    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    setPhotos(nextFiles);
    setPreviewUrls(nextFiles.map((file) => URL.createObjectURL(file)));
  }

  function removePhoto(index: number) {
    const nextPhotos = photos.filter((_, itemIndex) => itemIndex !== index);
    setPhotoFiles(nextPhotos);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const floorArea = Number(floorAreaM2);
      const photoPayload = photos.length > 0 ? await Promise.all(photos.map(fileToDataUrl)) : [];

      const response = await apiFetch("/api/v1/ai/pricing-agent", {
        method: "POST",
        body: JSON.stringify({
          propertyType,
          location,
          floorAreaM2: floorArea,
          condition,
          scope,
          photos: photoPayload.length > 0 ? photoPayload : undefined
        })
      });

      const payload = (await response.json()) as unknown;
      if (!isPricingAgentResponse(payload)) {
        throw new Error("Unexpected response from pricing agent.");
      }

      setResult(payload);
    } catch (error: unknown) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate AI estimate.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleExportPdf() {
    if (!result) {
      return;
    }

    setIsExportingPdf(true);
    setErrorMessage(null);

    try {
      const parsedArea = Math.max(1, Number(floorAreaM2) || 1);

      const pdfInput: QuotePdfInput = {
        propertyDescription: `${propertyType}, ${location}, ${parsedArea}m², ${condition} condition`,
        categories: result.categories.map((category) => ({
          category: category.name,
          low: category.low,
          typical: category.typical,
          high: category.high
        })),
        totalLow: result.totalLow,
        totalTypical: result.totalTypical,
        totalHigh: result.totalHigh,
        costPerM2: {
          low: Math.round(result.totalLow / parsedArea),
          typical: Math.round(result.totalTypical / parsedArea),
          high: Math.round(result.totalHigh / parsedArea)
        },
        metadata: {
          postcodeDistrict: location.trim(),
          renovationScope: scope.trim()
        }
      };

      const response = await apiFetch("/api/v1/estimate/pdf", {
        method: "POST",
        body: JSON.stringify({ input: pdfInput })
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "ai-pricing-estimate.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">AI Pricing Agent</h1>
        <p className="text-sm text-muted-foreground">
          Get AI-powered cost estimates for your property project
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Inputs</CardTitle>
          <CardDescription>
            Provide project details and optional photos for improved pricing accuracy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="propertyType">
                  Property type
                </label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger id="propertyType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="location">
                  Location / postcode
                </label>
                <Input
                  id="location"
                  placeholder="e.g. SW18 1AA"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="floorArea">
                  Floor area m²
                </label>
                <Input
                  id="floorArea"
                  type="number"
                  min={1}
                  step={1}
                  value={floorAreaM2}
                  onChange={(event) => setFloorAreaM2(event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="condition">
                  Current condition
                </label>
                <Select value={condition} onValueChange={(value) => setCondition(value as PricingCondition)}>
                  <SelectTrigger id="condition" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poor">poor</SelectItem>
                    <SelectItem value="fair">fair</SelectItem>
                    <SelectItem value="good">good</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="scope">
                Renovation scope
              </label>
              <textarea
                id="scope"
                className="bp-focus-ring min-h-28 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
                placeholder="Describe scope, priorities, and any special constraints..."
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Optional photos (up to 3)</label>
              <input
                ref={uploadRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setPhotoFiles(Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS))
                }
              />
              <button
                type="button"
                className="flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/10 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                onClick={() => uploadRef.current?.click()}
              >
                <Upload className="size-5" />
                <span>Click to upload room photos</span>
              </button>

              {photos.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {previewUrls.map((url, index) => (
                    <div key={url} className="rounded-md border border-border bg-muted/10 p-2">
                      <div className="relative h-28 w-full overflow-hidden rounded">
                        <NextImage
                          src={url}
                          alt={`Pricing photo ${index + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 33vw"
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-muted-foreground">{photos[index]?.name}</p>
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => removePhoto(index)}>
                          <X className="size-4" />
                          <span className="sr-only">Remove photo {index + 1}</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <Button type="submit" disabled={!canSubmit} className="w-full md:w-auto">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Analysing your property...
                </>
              ) : (
                "Get AI Estimate"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {errorMessage ? (
        <Card className="border-destructive/40">
          <CardContent className="pt-4 text-sm text-destructive">{errorMessage}</CardContent>
        </Card>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{result.summary}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Low</TableHead>
                    <TableHead className="text-right">Typical</TableHead>
                    <TableHead className="text-right">High</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.categories.map((category) => (
                    <TableRow key={category.name}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(category.low)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(category.typical)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(category.high)}</TableCell>
                      <TableCell className="whitespace-normal text-xs text-muted-foreground">
                        {category.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-teal-500/20 font-semibold text-teal-100">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(result.totalLow)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(result.totalTypical)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(result.totalHigh)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Advice</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{result.advice}</p>
            </CardContent>
          </Card>

          <Button type="button" onClick={handleExportPdf} disabled={isExportingPdf}>
            {isExportingPdf ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Exporting PDF...
              </>
            ) : (
              "Export to PDF"
            )}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
