"use client";

import NextImage from "next/image";
import {
  ImagePlus,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, isApiFetchError } from "@/lib/apiClient";
import type { GalleryItem, ProjectType } from "@/lib/platform-types";

const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  kitchen: "Kitchen",
  bathroom: "Bathroom",
  full_refurb: "Full Refurb",
  extension: "Extension",
  new_build: "New Build",
  other: "Other",
};

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type GalleryApiResponse = {
  data: GalleryItem[];
  total: number;
  page: number;
  limit: number;
};

type GalleryFormState = {
  title: string;
  description: string;
  projectType: ProjectType | "";
  locationCity: string;
  estimatedCost: string;
  imageUrl: string;
  beforeImageUrl: string;
};

const INITIAL_FORM: GalleryFormState = {
  title: "",
  description: "",
  projectType: "",
  locationCity: "",
  estimatedCost: "",
  imageUrl: "",
  beforeImageUrl: "",
};

type UploadPresignResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};

type UploadConfirmResponse = {
  url: string;
};

function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPG, PNG, or WebP images are allowed.";
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return "Image must be smaller than 5MB.";
  }

  return null;
}

export default function DashboardGalleryPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [itemPendingDelete, setItemPendingDelete] = useState<GalleryItem | null>(
    null,
  );

  const [form, setForm] = useState<GalleryFormState>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [beforeImageFile, setBeforeImageFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const imagePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : form.imageUrl || null),
    [imageFile, form.imageUrl],
  );

  const beforePreview = useMemo(
    () =>
      beforeImageFile
        ? URL.createObjectURL(beforeImageFile)
        : form.beforeImageUrl || null,
    [beforeImageFile, form.beforeImageUrl],
  );

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  useEffect(() => {
    return () => {
      if (beforePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(beforePreview);
      }
    };
  }, [beforePreview]);

  useEffect(() => {
    let isActive = true;

    async function fetchMyGallery() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await apiFetch("/api/v1/gallery/my?page=1&limit=100");
        const payload = (await response.json()) as GalleryApiResponse;

        if (!isActive) {
          return;
        }

        setItems(payload.data ?? []);
        setTotal(payload.total ?? 0);
      } catch (error) {
        if (!isActive) {
          return;
        }

        if (isApiFetchError(error) && error.status === 401) {
          router.replace("/auth/login");
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load gallery.",
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void fetchMyGallery();

    return () => {
      isActive = false;
    };
  }, [router]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setImageFile(null);
    setBeforeImageFile(null);
    setEditingItem(null);
    setIsDragOver(false);
  }

  function openCreateDialog() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(item: GalleryItem) {
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      projectType: item.projectType ?? "",
      locationCity: item.locationCity ?? "",
      estimatedCost: item.estimatedCost === null ? "" : String(item.estimatedCost),
      imageUrl: item.imageUrl,
      beforeImageUrl: item.beforeImageUrl ?? "",
    });
    setFormErrors({});
    setImageFile(null);
    setBeforeImageFile(null);
    setIsDragOver(false);
    setIsDialogOpen(true);
  }

  function setField<K extends keyof GalleryFormState>(
    field: K,
    value: GalleryFormState[K],
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setFormErrors((previous) => ({ ...previous, [field]: "" }));
  }

  function validateForm(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (form.title.trim().length === 0) {
      errors.title = "Title is required.";
    }

    if (!editingItem && !imageFile) {
      errors.image = "Please upload an image.";
    }

    if (form.estimatedCost.trim().length > 0) {
      const parsed = Number(form.estimatedCost);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        errors.estimatedCost = "Estimated cost must be a positive number.";
      }
    }

    return errors;
  }

  async function uploadImage(file: File): Promise<string> {
    const presignResponse = await apiFetch("/api/v1/upload", {
      method: "POST",
      body: JSON.stringify({
        action: "presign",
        bucket: "gallery",
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    });

    const presignPayload =
      (await presignResponse.json()) as UploadPresignResponse;

    const putResponse = await fetch(presignPayload.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!putResponse.ok) {
      throw new Error("Failed to upload image directly to storage.");
    }

    const confirmResponse = await apiFetch("/api/v1/upload", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm",
        bucket: "gallery",
        key: presignPayload.key,
      }),
    });

    const confirmPayload =
      (await confirmResponse.json()) as UploadConfirmResponse;

    if (
      typeof confirmPayload.url !== "string" ||
      confirmPayload.url.trim().length === 0
    ) {
      throw new Error("Upload succeeded but no file URL was returned.");
    }

    return confirmPayload.url;
  }

  async function resolveUploadedImage(
    file: File | null,
    existingUrl: string,
  ): Promise<string> {
    if (!file) {
      return existingUrl;
    }

    return await uploadImage(file);
  }

  async function refreshGallery() {
    try {
      const response = await apiFetch("/api/v1/gallery/my?page=1&limit=100");
      const payload = (await response.json()) as GalleryApiResponse;
      setItems(payload.data ?? []);
      setTotal(payload.total ?? 0);
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login");
        return;
      }
      throw error;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateForm();
    setFormErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const imageUrl = await resolveUploadedImage(imageFile, form.imageUrl);
      const beforeImageUrl = await resolveUploadedImage(
        beforeImageFile,
        form.beforeImageUrl,
      );

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        imageUrl,
        thumbnailUrl: imageUrl,
        projectType: form.projectType || undefined,
        beforeImageUrl: beforeImageUrl || undefined,
        locationCity: form.locationCity.trim() || undefined,
        estimatedCost:
          form.estimatedCost.trim().length > 0
            ? Number(form.estimatedCost)
            : undefined,
      };

      const endpoint = editingItem
        ? `/api/v1/gallery/${editingItem.id}`
        : "/api/v1/gallery";
      const method = editingItem ? "PATCH" : "POST";

      await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      await refreshGallery();
      setIsDialogOpen(false);
      resetForm();

      toast({
        title: editingItem ? "Project updated" : "Project added",
        description: editingItem
          ? "Your gallery item was updated successfully."
          : "Your new gallery item has been published.",
      });
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login");
        return;
      }

      toast({
        title: "Unable to save project",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!itemPendingDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      await apiFetch(`/api/v1/gallery/${itemPendingDelete.id}`, {
        method: "DELETE",
      });

      await refreshGallery();
      setItemPendingDelete(null);
      setIsDeleteOpen(false);

      toast({
        title: "Project deleted",
        description: "The gallery item was removed.",
      });
    } catch (error) {
      if (isApiFetchError(error) && error.status === 401) {
        router.replace("/auth/login");
        return;
      }

      toast({
        title: "Unable to delete project",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function onImageDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);

    const file = event.dataTransfer.files[0];
    if (!file) {
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setFormErrors((previous) => ({ ...previous, image: validationError }));
      return;
    }

    setImageFile(file);
    setFormErrors((previous) => ({ ...previous, image: "" }));
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      setFormErrors((previous) => ({ ...previous, image: validationError }));
      return;
    }

    setImageFile(file);
    setFormErrors((previous) => ({ ...previous, image: "" }));
  }

  function onBeforeImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setBeforeImageFile(null);
      return;
    }

    const validationError = validateImageFile(file);
    if (validationError) {
      toast({
        title: "Invalid before image",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setBeforeImageFile(file);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Showcase your finished projects with before and after photos.
          </p>
        </div>

        <Button type="button" onClick={openCreateDialog} disabled={isLoading}>
          <ImagePlus className="size-4" />
          Add Project Photo
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <Card key={item} className="overflow-hidden">
              <CardContent className="space-y-3 p-3">
                <div className="h-28 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : errorMessage ? (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center gap-3 text-center">
            <ImagePlus className="size-8 text-muted-foreground" />
            <p className="text-base font-medium text-foreground">
              No project photos yet. Upload your first project to build your
              portfolio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="group relative overflow-hidden rounded-lg bg-card bp-card-border"
            >
              <div className="relative h-36 w-full bg-input">
                <NextImage
                  src={item.thumbnailUrl ?? item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              <div className="space-y-1 p-3">
                <p className="line-clamp-1 text-sm font-medium text-foreground">
                  {item.title}
                </p>

                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="truncate">
                    {item.projectType
                      ? PROJECT_TYPE_LABELS[item.projectType]
                      : "Uncategorised"}
                  </Badge>

                  {item.estimatedCost !== null ? (
                    <span className="text-xs font-mono text-primary">
                      £{item.estimatedCost.toLocaleString("en-GB")}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isDeleting}
                  onClick={() => openEditDialog(item)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={() => {
                    setItemPendingDelete(item);
                    setIsDeleteOpen(true);
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Total gallery items: <span className="font-mono">{total}</span>
      </p>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (isSubmitting) return;
          setIsDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit project photo" : "Add project photo"}
            </DialogTitle>
            <DialogDescription>
              Upload images and details to showcase your latest work.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div
              className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
                isDragOver ? "border-primary" : "border-primary/40"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onImageDrop}
            >
              <Label className="text-foreground">Project image *</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Drag and drop an image, or choose a file.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() =>
                    document.getElementById("gallery-image-input")?.click()
                  }
                >
                  <Upload className="size-4" />
                  Upload image
                </Button>

                <input
                  id="gallery-image-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onImageChange}
                />

                {imagePreview ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded border border-border">
                    <NextImage
                      src={imagePreview}
                      alt="Project preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
              </div>

              {formErrors.image ? (
                <p className="mt-2 text-xs text-destructive">
                  {formErrors.image}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="before-image">Before photo (optional)</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="before-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={isSubmitting}
                  onChange={onBeforeImageChange}
                />

                {beforePreview ? (
                  <div className="relative h-16 w-16 overflow-hidden rounded border border-border">
                    <NextImage
                      src={beforePreview}
                      alt="Before preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={form.title}
                  disabled={isSubmitting}
                  onChange={(event) => setField("title", event.target.value)}
                  placeholder="e.g. Kitchen renovation"
                />
                {formErrors.title ? (
                  <p className="text-xs text-destructive">{formErrors.title}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Project type</Label>
                <Select
                  value={form.projectType || "unset"}
                  onValueChange={(value) =>
                    setField(
                      "projectType",
                      value === "unset" ? "" : (value as ProjectType),
                    )
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={form.description}
                disabled={isSubmitting}
                onChange={(event) => setField("description", event.target.value)}
                className="bp-focus-ring min-h-24 w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60"
                placeholder="Brief project details"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location-city">Location</Label>
                <Input
                  id="location-city"
                  value={form.locationCity}
                  disabled={isSubmitting}
                  onChange={(event) => setField("locationCity", event.target.value)}
                  placeholder="e.g. Leeds"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estimated-cost">Estimated cost</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    £
                  </span>
                  <Input
                    id="estimated-cost"
                    type="number"
                    min={1}
                    className="pl-7 font-mono"
                    value={form.estimatedCost}
                    disabled={isSubmitting}
                    onChange={(event) => setField("estimatedCost", event.target.value)}
                    placeholder="12000"
                  />
                </div>

                {formErrors.estimatedCost ? (
                  <p className="text-xs text-destructive">
                    {formErrors.estimatedCost}
                  </p>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {editingItem ? "Save changes" : "Add project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setIsDeleteOpen(open);
          if (!open) {
            setItemPendingDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project photo?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. The selected gallery item will be
              removed permanently.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setItemPendingDelete(null);
                setIsDeleteOpen(false);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="size-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
