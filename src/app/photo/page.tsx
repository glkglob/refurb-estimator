"use client";

import {
  AlertCircle,
  Camera,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EstimateResultsFallback from "@/components/EstimateResultsFallback";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiClient";
import type { QuotePdfInput } from "@/lib/generateQuotePdf";
import type { PropertyType } from "@/lib/propertyType";
import type { EstimateInput, EstimateResult, Region } from "@/lib/types";

const EstimateResults = dynamic(() => import("@/components/EstimateResults"), {
  ssr: false,
  loading: () => <EstimateResultsFallback />
});

type PhotoEstimateResponse = {
  aiAnalysis: {
    propertyType: PropertyType;
    totalAreaM2: number;
    condition: string;
    finishLevel: string;
    region: string;
    confidence: string;
    notes: string;
  };
  estimateInput: EstimateInput;
  estimateResult: EstimateResult;
};

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 20 * 1024 * 1024;
const maxPhotos = 3;
const regions: Region[] = [
  "London",
  "SouthEast",
  "EastOfEngland",
  "EastMidlands",
  "WestMidlands",
  "SouthWest",
  "NorthWest",
  "NorthEast",
  "YorkshireAndTheHumber",
  "Scotland",
  "Wales",
  "NorthernIreland"
];


function estimateDataUrlBytes(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  const base64Payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const compactPayload = base64Payload.replace(/\s/g, "");
  const padding = compactPayload.endsWith("==")
    ? 2
    : compactPayload.endsWith("=")
      ? 1
      : 0;
  return Math.floor((compactPayload.length * 3) / 4) - padding;
}

function isPhotoEstimateResponse(payload: unknown): payload is PhotoEstimateResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const data = payload as Record<string, unknown>;
  return Boolean(data.aiAnalysis && data.estimateInput && data.estimateResult);
}

async function resizeToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read image"));
      img.src = objectUrl;
    });

    const maxDimension = 2048;
    const scale = Math.min(
      1,
      maxDimension / image.naturalWidth,
      maxDimension / image.naturalHeight
    );

    const targetWidth = Math.max(1, Math.round(image.naturalWidth * scale));
    const targetHeight = Math.max(1, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to process image");
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function labelForRegion(region: Region): string {
  return region === "SouthEast" ? "South East" : region;
}

function confidenceBadgeClass(confidence: string): string {
  switch (confidence) {
    case "high":
      return "border-primary/40 bg-primary/10 text-primary";
    case "medium":
      return "border-secondary bg-secondary text-secondary-foreground";
    default:
      return "border-destructive/40 bg-destructive/10 text-destructive";
  }
}

export default function PhotoPage() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [regionOverride, setRegionOverride] = useState<Region | "auto">("auto");
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [approxAreaM2, setApproxAreaM2] = useState<number | null>(null);
  const [postcode, setPostcode] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    aiAnalysis: {
      propertyType: PropertyType;
      totalAreaM2: number;
      condition: string;
      finishLevel: string;
      region: string;
      confidence: string;
      notes: string;
    };
    estimateInput: EstimateInput;
    estimateResult: EstimateResult;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  useEffect(() => {
    void import("@/components/EstimateResults");
  }, []);

  const refineHref = useMemo(() => {
    if (!result) {
      return "/";
    }

    const params = new URLSearchParams({
      region: result.estimateInput.region,
      totalAreaM2: String(result.estimateInput.totalAreaM2),
      condition: result.estimateInput.condition,
      finishLevel: result.estimateInput.finishLevel,
      propertyType: result.estimateInput.propertyType
    });
    return `/?${params.toString()}`;
  }, [result]);

  function resetAll() {
    setSelectedFiles([]);
    setPreviewUrls([]);
    setRegionOverride("auto");
    setBedrooms(null);
    setApproxAreaM2(null);
    setPostcode("");
    setShowDetails(false);
    setIsAnalysing(false);
    setError(null);
    setResult(null);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }

  function applyFiles(nextFiles: File[]) {
    const validFiles: File[] = [];

    for (const file of nextFiles) {
      if (!supportedTypes.has(file.type)) {
        setError("Please upload JPEG, PNG, or WebP images.");
        return;
      }

      if (file.size > maxBytes) {
        setError("One or more images are too large. Maximum size is 20MB each.");
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return;
    }

    const limitedFiles = validFiles.slice(0, maxPhotos);
    if (validFiles.length > maxPhotos) {
      setError("You can upload up to 3 photos.");
    } else {
      setError(null);
    }

    setSelectedFiles(limitedFiles);
    setPreviewUrls(limitedFiles.map((file) => URL.createObjectURL(file)));
    setResult(null);
  }

  function appendFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const combinedFiles = [...selectedFiles, ...files];
    applyFiles(combinedFiles);
  }

  function removeFile(index: number) {
    const nextFiles = selectedFiles.filter((_, fileIndex) => fileIndex !== index);
    if (nextFiles.length === 0) {
      resetAll();
      return;
    }
    applyFiles(nextFiles);
  }

  async function handleAnalyse() {
    if (selectedFiles.length === 0) {
      setError("Please select at least one property photo first.");
      return;
    }

    setIsAnalysing(true);
    setError(null);

    try {
      const base64DataUrls = await Promise.all(selectedFiles.map((file) => resizeToDataUrl(file)));
      for (const dataUrl of base64DataUrls) {
        if (estimateDataUrlBytes(dataUrl) > maxBytes) {
          throw new Error("One or more images are too large after processing. Please use smaller photos.");
        }
      }

      const response = await apiFetch("/api/v1/ai/photo-estimate", {
        method: "POST",
        body: JSON.stringify({
          image: base64DataUrls.length === 1 ? base64DataUrls[0] : base64DataUrls,
          region: regionOverride !== "auto" ? regionOverride : undefined,
          bedrooms: bedrooms && bedrooms > 0 ? bedrooms : undefined,
          approxAreaM2: approxAreaM2 && approxAreaM2 > 0 ? approxAreaM2 : undefined,
          postcode: postcode.trim() || undefined
        })
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!isPhotoEstimateResponse(payload)) {
        throw new Error("Unexpected response from the AI service.");
      }

      setResult(payload);
      requestAnimationFrame(() => {
        document.getElementById("photo-results")?.scrollIntoView({ behavior: "smooth" });
      });
    } catch (analysisError) {
      setResult(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Unable to analyse the photo. Please try again."
      );
    } finally {
      setIsAnalysing(false);
    }
  }

  async function handleDownloadPdf() {
    if (!result) {
      return;
    }

    setIsGeneratingPdf(true);

    try {
      const { estimateInput, estimateResult } = result;

      const pdfInput: QuotePdfInput = {
        propertyDescription: `${estimateInput.totalAreaM2}m² ${estimateInput.propertyType} in ${estimateInput.region}, ${estimateInput.condition} condition, ${estimateInput.finishLevel} finish`,
        categories: estimateResult.categories.map((category) => ({
          category: category.category,
          low: category.low,
          typical: category.typical,
          high: category.high
        })),
        totalLow: estimateResult.totalLow,
        totalTypical: estimateResult.totalTypical,
        totalHigh: estimateResult.totalHigh,
        costPerM2: estimateResult.costPerM2
      };

      const response = await apiFetch("/api/v1/estimate/pdf", {
        method: "POST",
        body: JSON.stringify({ input: pdfInput })
      });

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "property-estimate.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "PDF generation failed",
        description: "Unable to generate the PDF. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">AI Photo Estimate</h1>
        <p className="text-sm text-muted-foreground">
          Upload a property photo and get an instant refurbishment cost estimate powered by AI.
        </p>
      </div>

      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Upload Property Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => appendFiles(Array.from(event.target.files ?? []))}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => appendFiles(Array.from(event.target.files ?? []))}
          />

          <div
            role="button"
            tabIndex={0}
            className={cn(
              "rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 text-center transition-colors hover:border-primary/50",
              isDragging && "border-primary bg-primary/5"
            )}
            onClick={() => uploadInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                uploadInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              appendFiles(Array.from(event.dataTransfer.files ?? []));
            }}
          >
            <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drag & drop property photos or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Up to 3 photos · JPEG, PNG, or WebP · Max 20MB each
            </p>

            <div className="mt-4 sm:hidden">
              <Button
                type="button"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation();
                  cameraInputRef.current?.click();
                }}
              >
                <Camera className="size-4" />
                Use Camera
              </Button>
            </div>
          </div>

          {selectedFiles.length > 0 && previewUrls.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {previewUrls.map((url, index) => (
                  <div key={url} className="rounded-lg border bg-muted/20 p-2">
                    <div className="relative h-40 w-full overflow-hidden rounded">
                      <NextImage
                        src={url}
                        alt={`Selected property preview ${index + 1}`}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, 30vw"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="truncate text-xs text-muted-foreground">
                        {selectedFiles[index]?.name ?? `Photo ${index + 1}`}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => removeFile(index)}
                      >
                        <X className="size-4" />
                        <span className="sr-only">Remove photo {index + 1}</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Region preference</p>
                  <Select
                    value={regionOverride}
                    onValueChange={(value) => setRegionOverride(value as Region | "auto")}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect (let AI guess)</SelectItem>
                      {regions.map((region) => (
                        <SelectItem key={region} value={region}>
                          {labelForRegion(region)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto px-0 text-primary hover:bg-transparent hover:text-primary/90"
                    onClick={() => setShowDetails((current) => !current)}
                  >
                    <ChevronDown
                      className={cn(
                        "mr-2 size-4 transition-transform",
                        showDetails ? "rotate-180" : "rotate-0"
                      )}
                    />
                    Add property details for a more accurate estimate
                  </Button>
                </div>
              </div>

              {showDetails ? (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Bedrooms</p>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        placeholder="e.g. 3"
                        value={bedrooms ?? ""}
                        onChange={(event) => {
                          if (event.target.value === "") {
                            setBedrooms(null);
                            return;
                          }
                          const value = Number(event.target.value);
                          setBedrooms(Number.isFinite(value) ? value : null);
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Area (m²)</p>
                      <Input
                        type="number"
                        min={15}
                        max={2000}
                        step={1}
                        placeholder="e.g. 85"
                        value={approxAreaM2 ?? ""}
                        onChange={(event) => {
                          if (event.target.value === "") {
                            setApproxAreaM2(null);
                            return;
                          }
                          const value = Number(event.target.value);
                          setApproxAreaM2(Number.isFinite(value) ? value : null);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        If you know the approximate size
                      </p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Postcode</p>
                      <Input
                        type="text"
                        placeholder="e.g. SW1A 1AA"
                        maxLength={8}
                        value={postcode}
                        onChange={(event) => setPostcode(event.target.value.toUpperCase())}
                      />
                      <p className="text-xs text-muted-foreground">
                        Helps determine region and local costs
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  variant="default"
                  disabled={isAnalysing || selectedFiles.length === 0}
                  onClick={() => void handleAnalyse()}
                  className="w-full sm:w-auto"
                >
                  {isAnalysing ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {isAnalysing ? "Analysing property..." : "Analyse Photo"}
                </Button>
                <Button type="button" variant="outline" onClick={resetAll}>
                  Clear All
                </Button>
              </div>

              {isAnalysing ? (
                <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                  <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                  <p className="text-xs text-muted-foreground">This usually takes 5-15 seconds</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="bp-error space-y-3 rounded-md border p-3">
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
                <p className="text-red-300">{error}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-red-400/40 text-red-300 hover:bg-red-500/10"
                onClick={() => setError(null)}
              >
                Try Again
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <div id="photo-results" className="space-y-4">
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
            <CardHeader>
              <CardTitle className="text-lg">AI Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-foreground">Property Type:</span>{" "}
                  {result.aiAnalysis.propertyType}
                </p>
                <p>
                  <span className="font-medium text-foreground">Estimated Area:</span>{" "}
                  {Math.round(result.aiAnalysis.totalAreaM2)} m²
                </p>
                <p>
                  <span className="font-medium text-foreground">Condition:</span>{" "}
                  {result.aiAnalysis.condition}
                </p>
                <p>
                  <span className="font-medium text-foreground">Finish Level:</span>{" "}
                  {result.aiAnalysis.finishLevel}
                </p>
                <p>
                  <span className="font-medium text-foreground">Region:</span> {result.aiAnalysis.region}
                </p>
                <p className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Confidence:</span>
                  <Badge className={confidenceBadgeClass(result.aiAnalysis.confidence)}>
                    {result.aiAnalysis.confidence}
                  </Badge>
                </p>
              </div>

              <p className="italic text-muted-foreground">{result.aiAnalysis.notes}</p>
              <p className="text-xs text-muted-foreground">
                These estimates are AI-generated. Adjust inputs on the Quick Estimate page for more
                accuracy.
              </p>
              <Button type="button" variant="outline" asChild>
                <Link href={refineHref}>Refine Estimate</Link>
              </Button>
            </CardContent>
          </Card>

          <EstimateResults result={result.estimateResult} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              {isGeneratingPdf ? <Loader2 className="size-4 animate-spin" /> : null}
              Download PDF
            </Button>
            <Button type="button" variant="outline" onClick={resetAll}>
              Try Another Photo
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
