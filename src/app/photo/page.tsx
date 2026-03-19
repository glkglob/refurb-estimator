"use client";

import { AlertCircle, Camera, RefreshCw, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import EstimateResults from "@/components/EstimateResults";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { EstimateInput, EstimateResult, Region } from "@/lib/types";

type PhotoEstimateResponse = {
  aiAnalysis: {
    propertyType: string;
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
const regions: Region[] = [
  "London",
  "SouthEast",
  "Midlands",
  "North",
  "Scotland",
  "Wales"
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

function parseApiError(payload: unknown): string {
  if (payload && typeof payload === "object") {
    const data = payload as Record<string, unknown>;
    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
    if (typeof data.error === "string" && data.error.trim()) {
      return data.error;
    }
  }
  return "Unable to analyse the photo. Please try again.";
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
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "medium":
      return "border-amber-300 bg-amber-50 text-amber-700";
    default:
      return "border-red-300 bg-red-50 text-red-700";
  }
}

export default function PhotoPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [regionOverride, setRegionOverride] = useState<Region | "auto">("auto");
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    aiAnalysis: {
      propertyType: string;
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

  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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

  function revokePreview(url: string | null) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  function resetAll() {
    revokePreview(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setRegionOverride("auto");
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

  function handleFile(file: File | null) {
    if (!file) {
      return;
    }

    if (!supportedTypes.has(file.type)) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > maxBytes) {
      setError("Image is too large. Maximum size is 20MB.");
      return;
    }

    revokePreview(previewUrl);
    const nextPreviewUrl = URL.createObjectURL(file);

    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setError(null);
    setResult(null);
  }

  async function handleAnalyse() {
    if (!selectedFile) {
      setError("Please select a property photo first.");
      return;
    }

    setIsAnalysing(true);
    setError(null);

    try {
      const base64DataUrl = await resizeToDataUrl(selectedFile);
      if (estimateDataUrlBytes(base64DataUrl) > maxBytes) {
        throw new Error("Image is too large after processing. Please use a smaller photo.");
      }

      const response = await fetch("/api/ai/photo-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: base64DataUrl,
          region: regionOverride !== "auto" ? regionOverride : undefined
        })
      });

      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        throw new Error(parseApiError(payload));
      }

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

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">AI Photo Estimate</h1>
        <p className="text-sm text-muted-foreground">
          Upload a property photo and get an instant refurbishment cost estimate powered by AI.
        </p>
      </div>

      <Card className="mx-auto w-full max-w-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Upload Property Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
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
              handleFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              Drag & drop a property photo or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP · Max 20MB</p>

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

          {selectedFile && previewUrl ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="relative mx-auto h-[300px] w-full">
                  <NextImage
                    src={previewUrl}
                    alt="Selected property photo preview"
                    fill
                    unoptimized
                    className="rounded object-contain"
                    sizes="(max-width: 640px) 100vw, 600px"
                  />
                </div>
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

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="default"
                    disabled={isAnalysing || !selectedFile}
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
                    Change Photo
                  </Button>
                </div>
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
            <div className="space-y-3 rounded-md border border-red-300 bg-red-50 p-3 text-red-700">
              <div className="flex items-start gap-2 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{error}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
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
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm">
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

          <Button type="button" variant="outline" onClick={resetAll}>
            Try Another Photo
          </Button>
        </div>
      ) : null}
    </section>
  );
}
