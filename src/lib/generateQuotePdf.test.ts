import { PDFDocument } from "pdf-lib";
import { generateQuotePdf, type QuotePdfInput } from "./generateQuotePdf";

const minimalInput: QuotePdfInput = {
  propertyDescription: "75m² terraced house in London",
  categories: [
    { category: "kitchen", low: 5000, typical: 8000, high: 12000 },
    { category: "bathroom", low: 3000, typical: 5000, high: 8000 },
    { category: "electrics", low: 2000, typical: 3500, high: 5500 },
  ],
  totalLow: 10000,
  totalTypical: 16500,
  totalHigh: 25500,
  costPerM2: { low: 133, typical: 220, high: 340 },
};

describe("generateQuotePdf", () => {
  it("generates a valid PDF (non-empty Uint8Array with %PDF magic bytes)", async () => {
    const result = await generateQuotePdf(minimalInput);

    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);

    const magic = Buffer.from(result.slice(0, 5)).toString("ascii");
    expect(magic.startsWith("%PDF-")).toBe(true);
  });

  it("works with minimal input (no options)", async () => {
    const result = await generateQuotePdf(minimalInput);

    expect(result.length).toBeGreaterThan(0);
  });

  it("works with full input (all optional fields populated)", async () => {
    const fullInput: QuotePdfInput = {
      ...minimalInput,
      adjustments: [
        {
          label: "Pre-1919 surcharge",
          amount: 12500,
          reason: "Lime mortar, lath-and-plaster, solid walls",
        },
      ],
      additionalFeatures: [
        { label: "Loft conversion", low: 15000, typical: 22000, high: 30000 },
      ],
      metadata: {
        postcodeDistrict: "SW1",
        renovationScope: "Full refurbishment",
        qualityTier: "High",
        yearBuilt: 1900,
        listedBuilding: true,
      },
      contingencyPercent: 10,
      feesPercent: 8,
    };

    const options = {
      companyName: "Custom Company",
      disclaimer: "Custom disclaimer text.",
      generatedAt: new Date("2026-03-20T00:00:00Z"),
    };

    const result = await generateQuotePdf(fullInput, options);

    expect(result.length).toBeGreaterThan(0);

    const pdf = await PDFDocument.load(result);
    expect(pdf.getTitle()).toBe("Custom Company");
    expect(pdf.getAuthor()).toBe("Custom Company");
    expect(pdf.getProducer()).toBe("Custom Company");
    expect(pdf.getCreator()).toBe("Custom Company");
    expect(pdf.getSubject()).toBe("Property refurbishment estimate");
  });

  it("uses default company name in PDF metadata when not provided", async () => {
    const result = await generateQuotePdf(minimalInput);
    const pdf = await PDFDocument.load(result);

    expect(pdf.getTitle()).toBe("UK Property Refurb Estimator");
    expect(pdf.getAuthor()).toBe("UK Property Refurb Estimator");
  });

  it("includes custom company name in PDF metadata when provided", async () => {
    const result = await generateQuotePdf(minimalInput, {
      companyName: "My Test Company",
    });
    const pdf = await PDFDocument.load(result);

    expect(pdf.getTitle()).toBe("My Test Company");
    expect(pdf.getAuthor()).toBe("My Test Company");
    expect(pdf.getProducer()).toBe("My Test Company");
    expect(pdf.getCreator()).toBe("My Test Company");
  });

  it("uses a stable subject value", async () => {
    const result = await generateQuotePdf(minimalInput, {
      disclaimer: "Custom disclaimer for testing.",
    });
    const pdf = await PDFDocument.load(result);

    expect(pdf.getSubject()).toBe("Property refurbishment estimate");
  });

  it("handles empty categories and zero totals without error", async () => {
    const input: QuotePdfInput = {
      ...minimalInput,
      categories: [],
      totalLow: 0,
      totalTypical: 0,
      totalHigh: 0,
      costPerM2: { low: 0, typical: 0, high: 0 },
    };

    const result = await generateQuotePdf(input);

    expect(result.length).toBeGreaterThan(0);
  });
});
