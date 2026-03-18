"use client";

import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

type ToastOptions = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

export function useToast() {
  const toast = ({ title, description, variant = "default" }: ToastOptions) => {
    if (variant === "destructive") {
      sonnerToast.error(title, { description });
      return;
    }

    sonnerToast.success(title, { description });
  };

  return { toast };
}
