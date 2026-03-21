"use client";

import NextImage from "next/image";
import { Loader2, Upload, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent
} from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

type DesignRoomType = "Living Room" | "Kitchen" | "Bathroom" | "Bedroom" | "Hallway" | "Other";
type DesignStyle =
  | "Modern"
  | "Contemporary"
  | "Traditional"
  | "Industrial"
  | "Scandinavian"
  | "Maximalist";
type DesignBudget = "Under £5k" | "£5k-£15k" | "£15k-£30k" | "£30k-£50k" | "£50k+";

type ColourPaletteItem = {
  name: string;
  hex: string;
  usage: string;
};

type MaterialRecommendation = {
  item: string;
  description: string;
  supplier: string;
  estimatedCost: number;
};

type DesignAgentResponse = {
  currentAssessment: string;
  designConcept: string;
  colourPalette: ColourPaletteItem[];
  materialRecommendations: MaterialRecommendation[];
  roomTransformation: string;
  estimatedCost: {
    low: number;
    typical: number;
    high: number;
  };
  nextSteps: string[];
};

type GalleryProjectType = "kitchen" | "bathroom" | "other";

const MAX_PHOTOS = 5;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const ROOM_TYPES: DesignRoomType[] = [
  "Living Room",
  "Kitchen",
  "Bathroom",
  "Bedroom",
  "Hallway",
  "Other"
];
const STYLES: DesignStyle[] = [
  "Modern",
  "Contemporary",
  "Traditional",
  "Industrial",
  "Scandinavian",
  "Maximalist"
];
const BUDGETS: DesignBudget[] = ["Under £5k", "£5k-£15k", "£15k-£30k", "£30k-£50k", "£50k+"];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}

function isDesignAgentResponse(payload: unknown): payload is DesignAgentResponse {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const data = payload as Record<string, unknown>;
  return (
    typeof data.currentAssessment === "string" &&
    typeof data.designConcept === "string" &&
    Array.isArray(data.colourPalette) &&
    Array.isArray(data.materialRecommendations) &&
    typeof data.roomTransformation === "string" &&
    typeof data.estimatedCost === "object" &&
    data.estimatedCost !== null &&
    Array.isArray(data.nextSteps)
  );
}

function mapRoomTypeToProjectType(roomType: DesignRoomType): GalleryProjectType {
  if (roomType === "Kitchen") {
    return "kitchen";
  }
  if (roomType === "Bathroom") {
    return "bathroom";
  }
  return "other";
}

function estimateDataUrlSizeKb(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return (base64.length * 3) / (4 * 1024);
}

async function compressImage(file: File, maxSizeKB: number = 500): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Image compression failed to initialize."));
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      const maxDim = 1024;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      let quality = 0.7;
      let compressedBase64 = canvas.toDataURL("image/jpeg", quality);

      while (estimateDataUrlSizeKb(compressedBase64) > maxSizeKB && quality > 0.2) {
        quality -= 0.1;
        compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      }

      resolve(compressedBase64);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to process ${file.name}`));
    };

    img.src = url;
  });
}

export default function DesignAgentPage() {
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [roomType, setRoomType] = useState<DesignRoomType>("Living Room");
  const [style, setStyle] = useState<DesignStyle>("Contemporary");
  const [budget, setBudget] = useState<DesignBudget>("£15k-£30k");
  const [requirements, setRequirements] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DesignAgentResponse | null>(null);
  const [submittedPhotoPayloads, setSubmittedPhotoPayloads] = useState<string[]>([]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  const canSubmit = useMemo(() => photos.length > 0 && !isGenerating, [isGenerating, photos.length]);

  function setPhotoFiles(nextFiles: File[]) {
    setErrorMessage(null);

    const limitedFiles = nextFiles.slice(0, MAX_PHOTOS);
    if (nextFiles.length > MAX_PHOTOS) {
      setErrorMessage(`You can upload up to ${MAX_PHOTOS} photos.`);
    }

    for (const file of limitedFiles) {
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
    setPhotos(limitedFiles);
    setPreviewUrls(limitedFiles.map((file) => URL.createObjectURL(file)));
  }

  function removePhoto(index: number) {
    const next = photos.filter((_, itemIndex) => itemIndex !== index);
    setPhotoFiles(next);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length === 0) {
      return;
    }
    setPhotoFiles([...photos, ...droppedFiles]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const selectedFiles = [...photos];
      const compressedPhotos = await Promise.all(
        selectedFiles.map((file) => compressImage(file))
      );

      const response = await apiFetch("/api/v1/ai/design-agent", {
        method: "POST",
        body: JSON.stringify({
          photos: compressedPhotos,
          roomType,
          style,
          budget,
          requirements
        })
      });

      const payload = (await response.json()) as unknown;
      if (!isDesignAgentResponse(payload)) {
        throw new Error("Unexpected response from design agent.");
      }

      setResult(payload);
      setSubmittedPhotoPayloads(compressedPhotos);
      setInfoMessage("Design concept generated. Review details and save to gallery if needed.");
    } catch (error: unknown) {
      setResult(null);
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate design concept.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveToGallery() {
    if (!result) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const imageUrl = submittedPhotoPayloads[0];
      if (!imageUrl) {
        throw new Error("No photo payload available to save.");
      }

      const description = `${result.designConcept}\n\n${result.roomTransformation}`.slice(0, 1000);

      await apiFetch("/api/v1/gallery", {
        method: "POST",
        body: JSON.stringify({
          title: `${roomType} ${style} design concept`,
          description,
          imageUrl,
          projectType: mapRoomTypeToProjectType(roomType),
          estimatedCost: result.estimatedCost.typical
        })
      });

      setInfoMessage("Design concept saved to Gallery.");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save to gallery.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">AI Design Visualiser</h1>
        <p className="text-sm text-muted-foreground">
          Upload photos and get AI-powered design recommendations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Design Inputs</CardTitle>
          <CardDescription>Upload room photos and define style goals for your concept.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              ref={uploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPhotoFiles(Array.from(event.target.files ?? []))
              }
            />

            <div
              role="button"
              tabIndex={0}
              className={cn(
                "rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/60",
                isDragging && "border-primary bg-primary/10"
              )}
              onClick={() => uploadRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  uploadRef.current?.click();
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
              onDrop={onDrop}
            >
              <Upload className="mx-auto mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-medium">Photo upload (up to 5 photos, drag and drop)</p>
              <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP · Max 20MB each</p>
            </div>

            {photos.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {previewUrls.map((url, index) => (
                  <div key={url} className="rounded-md border border-border bg-muted/20 p-2">
                    <div className="relative h-32 w-full overflow-hidden rounded">
                      <NextImage
                        src={url}
                        alt={`Design photo ${index + 1}`}
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

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="roomType">
                  Room type
                </label>
                <Select value={roomType} onValueChange={(value) => setRoomType(value as DesignRoomType)}>
                  <SelectTrigger id="roomType" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROOM_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="style">
                  Style preference
                </label>
                <Select value={style} onValueChange={(value) => setStyle(value as DesignStyle)}>
                  <SelectTrigger id="style" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="budget">
                  Budget range
                </label>
                <Select value={budget} onValueChange={(value) => setBudget(value as DesignBudget)}>
                  <SelectTrigger id="budget" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUDGETS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground" htmlFor="requirements">
                Any specific requirements or must-haves?
              </label>
              <textarea
                id="requirements"
                className="bp-focus-ring min-h-24 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
                placeholder="Any specific requirements or must-haves?"
                value={requirements}
                onChange={(event) => setRequirements(event.target.value)}
              />
            </div>

            <Button type="submit" disabled={!canSubmit}>
              {isGenerating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating your design concept...
                </>
              ) : (
                "Generate Design Concept"
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

      {infoMessage ? (
        <Card className="border-primary/40">
          <CardContent className="pt-4 text-sm text-primary">{infoMessage}</CardContent>
        </Card>
      ) : null}

      {result ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{result.currentAssessment}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Design concept</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{result.designConcept}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Colour palette</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {result.colourPalette.map((colour) => (
                  <div key={`${colour.name}-${colour.hex}`} className="rounded-lg border border-border p-3">
                    <div
                      className="mb-2 h-10 w-full rounded"
                      style={{ backgroundColor: colour.hex }}
                      aria-label={`${colour.name} swatch`}
                    />
                    <p className="text-sm font-medium text-foreground">{colour.name}</p>
                    <p className="text-xs text-muted-foreground">{colour.hex}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{colour.usage}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Materials &amp; products</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="text-right">Estimated cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.materialRecommendations.map((item, index) => (
                    <TableRow key={`${item.item}-${index}`}>
                      <TableCell className="font-medium">{item.item}</TableCell>
                      <TableCell className="whitespace-normal text-xs text-muted-foreground">
                        {item.description}
                      </TableCell>
                      <TableCell>{item.supplier}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.estimatedCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Room transformation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground">{result.roomTransformation}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cost estimate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Low</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(result.estimatedCost.low)}</p>
                </div>
                <div className="rounded-lg border border-teal-400/60 bg-teal-500/15 p-3">
                  <p className="text-xs uppercase tracking-wide text-teal-200">Typical</p>
                  <p className="text-lg font-semibold text-teal-100">
                    {formatCurrency(result.estimatedCost.typical)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">High</p>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(result.estimatedCost.high)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-inside list-decimal space-y-1 text-sm text-foreground">
                {result.nextSteps.map((step, index) => (
                  <li key={`${index}-${step}`}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Button type="button" onClick={handleSaveToGallery} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save to Gallery"
            )}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
