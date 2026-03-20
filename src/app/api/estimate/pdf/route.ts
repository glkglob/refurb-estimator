import { NextResponse } from "next/server";
import {
  generateQuotePdf,
  type QuotePdfInput,
  type QuotePdfOptions
} from "@/lib/generateQuotePdf";

type PdfRequestBody = {
  input: QuotePdfInput;
  options?: QuotePdfOptions;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PdfRequestBody;

    if (!body.input) {
      return NextResponse.json({ error: "Estimate input is required" }, { status: 400 });
    }

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
    const message = error instanceof Error ? error.message : "Failed to generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
