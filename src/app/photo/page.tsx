"use client";

import { AlertCircle, Camera, RefreshCw, Sparkles, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import EstimateResults from "@/components/EstimateResults";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { EstimateInput, EstimateResult, Region } from "@/lib/types";

const regions: Region[] = [
  "London",
  "SouthEast",
  "Midlands",
  "North",
  "Scotland",
  "Wales"
];

const supportedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 20 * 1024 * 1024;

type PhotoEstimateApiResponse = {
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

function getBase64ByteSize(dataUrl: string): number {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const sanitized = base64.replace(/\s/g, "");
  const paddingLength = sanitized.endsWith("==")
    ? 2
    : sanitized.endsWith("=")
      ? 1
      : 0;
  return Math.floor((sanitized.length * 3) / 4) - paddingLength;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error;
    }
  }

  return fallback;
}

function isPhotoEstimateApiResponse(payload: unknown): payload is PhotoEstimateApiResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;
  return Boolean(record.aiAnalysis && record.estimateInput && record.estimateResult);
}

async function resizeImageToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image"));
      img.src = objectUrl;
    });

    const maxDimension = 2048;
    const widthRatio = maxDimension / image.naturalWidth;
    const heightRatio = maxDimension / image.naturalHeight;
    const scale = Math.min(1, widthRatio, heightRatio);
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

export default function PhotoEstimatePage() {
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

  function clearPreview(url: string | null) {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  function handleFileSelection(file: File | null) {
    if (!file) {
      return;
    }

    if (!supportedMimeTypes.has(file.type)) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    clearPreview(previewUrl);
    const nextPreviewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextPreviewUrl);
    setError(null);
    setResult(null);
  }

  function resetAll() {
    clearPreview(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setResult(null);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = "";
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }

  async function handleAnalyse() {
    if (!selectedFile) {
      setError("Please upload a property photo before analysing.");
      return;
    }

    setIsAnalysing(true);
    setError(null);

    try {
      const resizedImage = await resizeImageToDataUrl(selectedFile);
      if (getBase64ByteSize(resizedImage) > maxImageBytes) {
        setResult(null);
        setError("Image is too large after processing. Please choose a smaller image.");
        return;
      }

      const payload: { image: string; region?: Region } = { image: resizedImage };
      if (regionOverride !== "auto") {
        payload.region = regionOverride;
      }

      const response = await fetch("/api/ai/photo-estimate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Failed to analyse image"));
      }

      if (!isPhotoEstimateApiResponse(data)) {
        throw new Error("Unexpected response from AI estimate API");
      }

      setResult(data);
      requestAnimationFrame(() => {
        document.getElementById("photo-results")?.scrollIntoView({ behavior: "smooth" });
      });
    } catch (analysisError) {
      setResult(null);
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "Unable to analyse image right now. Please try again."
      );
    } finally {
      setIsAnalysing(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">AI Estimate</h1>
        <p className="text-sm text-muted-foreground">
          Upload a property photo and get an AI-assisted refurbishment estimate in seconds.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="size-5 text-primary" />
            Photo Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/20"
            }`}
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
              const droppedFile = event.dataTransfer.files?.[0] ?? null;
              handleFileSelection(droppedFile);
            }}
          >
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(event) => handleFileSelection(event.target.files?.[0] ?? null)}
            />

            <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop a photo, or choose upload options below.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => uploadInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Upload image
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInputRef.current?.click()}
              >
                <Camera className="size-4" />
                Use camera
              </Button>
              {selectedFile ? (
                <Button type="button" variant="ghost" onClick={resetAll}>
                  <RefreshCw className="size-4" />
                  Clear
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Region override (optional)</p>
              <Select
                value={regionOverride}
                onValueChange={(value) => setRegionOverride(value as Region | "auto")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Auto-detect region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  {regions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="default"
                className="w-full sm:w-auto"
                disabled={!selectedFile || isAnalysing}
                onClick={() => void handleAnalyse()}
              >
                {isAnalysing ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {isAnalysing ? "Analysing photo..." : "Analyse photo"}
              </Button>
            </div>
          </div>

          {previewUrl ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Selected image preview</p>
              <div className="overflow-hidden rounded-lg border bg-card">
                <img
                  src={previewUrl}
                  alt="Selected property preview"
                  className="max-h-[420px] w-full object-cover"
                />
              </div>
              {selectedFile ? (
                <p className="text-xs text-muted-foreground">
                  {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <p>{error}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <div id="photo-results" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">AI Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="font-medium text-foreground">Property type:</span>{" "}
                {result.aiAnalysis.propertyType}
              </p>
              <p>
                <span className="font-medium text-foreground">Estimated area:</span>{" "}
                {Math.round(result.aiAnalysis.totalAreaM2)} m²
              </p>
              <p>
                <span className="font-medium text-foreground">Condition:</span>{" "}
                {result.aiAnalysis.condition}
              </p>
              <p>
                <span className="font-medium text-foreground">Finish level:</span>{" "}
                {result.aiAnalysis.finishLevel}
              </p>
              <p>
                <span className="font-medium text-foreground">Region:</span> {result.aiAnalysis.region}
              </p>
              <p>
                <span className="font-medium text-foreground">Confidence:</span>{" "}
                {result.aiAnalysis.confidence}
              </p>
              <p className="text-muted-foreground">{result.aiAnalysis.notes}</p>
            </CardContent>
          </Card>
          <EstimateResults result={result.estimateResult} />
        </div>
      ) : null}
    </section>
  );
}
