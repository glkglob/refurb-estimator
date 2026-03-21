import { NextResponse } from "next/server";
import { z } from "zod";
import {
  generateQuotePdf,
  type QuotePdfInput,
  type QuotePdfOptions
} from "@/lib/generateQuotePdf";
import { requireRole } from "@/lib/rbac";
import { AuthError, handleAuthError } from "@/lib/supabase/auth-helpers";
import { validateJsonRequest } from "@/lib/validate";

type PdfRequestBody = {
  input: QuotePdfInput;
  options?: QuotePdfOptions;
};

const quoteCategorySchema = z.object({
  category: z.string(),
  low: z.number(),
  typical: z.number(),
  high: z.number()
});

const quotePdfInputSchema = z.object({
  propertyDescription: z.string().min(1),
  categories: z.array(quoteCategorySchema),
  totalLow: z.number(),
  totalTypical: z.number(),
  totalHigh: z.number(),
  costPerM2: z.object({
    low: z.number(),
    typical: z.number(),
    high: z.number()
  }),
  contingencyPercent: z.number().optional(),
  feesPercent: z.number().optional(),
  adjustments: z
    .array(
      z.object({
        label: z.string(),
        amount: z.number(),
        reason: z.string()
      })
    )
    .optional(),
  additionalFeatures: z
    .array(
      z.object({
        label: z.string(),
        low: z.number(),
        typical: z.number(),
        high: z.number()
      })
    )
    .optional(),
  metadata: z
    .object({
      postcodeDistrict: z.string().optional(),
      renovationScope: z.string().optional(),
      qualityTier: z.string().optional(),
      yearBuilt: z.number().optional(),
      listedBuilding: z.boolean().optional()
    })
    .optional()
});

const quotePdfOptionsSchema = z
  .object({
    companyName: z.string().optional(),
    logoUrl: z.string().url().optional(),
    disclaimer: z.string().optional(),
    generatedAt: z.coerce.date().optional()
  })
  .optional();

const pdfRequestSchema = z.object({
  input: quotePdfInputSchema,
  options: quotePdfOptionsSchema
});

export async function POST(request: Request) {
  try {
    await requireRole(["TRADESPERSON", "ADMIN"]);

    const parsed = await validateJsonRequest(request, pdfRequestSchema, {
      errorMessage: "Invalid PDF request payload"
    });
    if (!parsed.success) {
      return parsed.response;
    }
    const body = parsed.data as PdfRequestBody;

    const pdfBytes = await generateQuotePdf(body.input, body.options);
    const pdfBytesArray = Uint8Array.from(pdfBytes);
    const pdfBlob = new Blob([pdfBytesArray], { type: "application/pdf" });

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="property-estimate.pdf"',
        "Content-Length": String(pdfBytes.length)
      }
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return handleAuthError(error);
    }

    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
