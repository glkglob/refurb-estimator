import { X } from "lucide-react";
import NextImage from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImagePreviewGridProps = {
  previewUrls: string[];
  fileNames: string[];
  altPrefix: string;
  onRemove: (index: number) => void;
  gridClassName?: string;
  cardClassName?: string;
  imageWrapperClassName?: string;
  fileNameClassName?: string;
};

export default function ImagePreviewGrid({
  previewUrls,
  fileNames,
  altPrefix,
  onRemove,
  gridClassName,
  cardClassName,
  imageWrapperClassName,
  fileNameClassName
}: ImagePreviewGridProps) {
  if (previewUrls.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", gridClassName)}>
      {previewUrls.map((url, index) => (
        <div key={`${url}-${index}`} className={cn("rounded-md border border-border bg-muted/20 p-2", cardClassName)}>
          <div className={cn("relative h-32 w-full overflow-hidden rounded", imageWrapperClassName)}>
            <NextImage
              src={url}
              alt={`${altPrefix} ${index + 1}`}
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 33vw"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className={cn("truncate text-xs text-muted-foreground", fileNameClassName)}>
              {fileNames[index] ?? `Photo ${index + 1}`}
            </p>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => onRemove(index)}>
              <X className="size-4" />
              <span className="sr-only">Remove photo {index + 1}</span>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
