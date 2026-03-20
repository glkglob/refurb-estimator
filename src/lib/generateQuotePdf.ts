import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type QuotePdfInput = {
  propertyDescription: string; // e.g. "75m² terraced house in London, fair condition, standard finish"
  categories: Array<{
    category: string;
    low: number;
    typical: number;
    high: number;
  }>;
  totalLow: number;
  totalTypical: number;
  totalHigh: number;
  costPerM2: { low: number; typical: number; high: number };
  contingencyPercent?: number;
  feesPercent?: number;
  adjustments?: Array<{ label: string; amount: number; reason: string }>;
  additionalFeatures?: Array<{ label: string; low: number; typical: number; high: number }>;
  metadata?: {
    postcodeDistrict?: string;
    renovationScope?: string;
    qualityTier?: string;
    yearBuilt?: number;
    listedBuilding?: boolean;
  };
};

export type QuotePdfOptions = {
  companyName?: string; // default: "UK Property Refurb Estimator"
  logoUrl?: string; // optional URL to a logo image (PNG or JPEG)
  disclaimer?: string; // default disclaimer text
  generatedAt?: Date; // default: new Date()
};

export async function generateQuotePdf(
  input: QuotePdfInput,
  options?: QuotePdfOptions
): Promise<Uint8Array> {
  // Page setup: A4 portrait (595.28 × 841.89 points).
  // Use 40pt margins on all sides.
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  const page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentPage = page;
  let cursorY = pageHeight - margin;

  // Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Font sizes
  const companyNameSize = 18;
  const sectionHeadingSize = 13;
  const propertyDescriptionSize = 11;
  const tableTextSize = 9;
  const disclaimerSize = 7.5;
  const dateSize = 8;

  // Colors
  const teal = rgb(0.05, 0.58, 0.53);
  const darkText = rgb(0.1, 0.1, 0.1);
  const mediumGrey = rgb(0.4, 0.4, 0.4);
  const lightGrey = rgb(0.95, 0.95, 0.95);
  const white = rgb(1, 1, 1);

  const companyName = options?.companyName ?? "UK Property Refurb Estimator";
  const disclaimerText =
    options?.disclaimer ??
    "This estimate is for guidance only and does not constitute a formal quotation. Actual costs may vary based on site conditions, specifications, and market rates. We recommend obtaining at least three contractor quotes before proceeding.";
  const generatedAt = options?.generatedAt ?? new Date();

  pdfDoc.setTitle(companyName);
  pdfDoc.setSubject(disclaimerText);

  async function maybeEmbedLogo() {
    if (!options?.logoUrl || typeof fetch !== "function") {
      return;
    }
    try {
      const response = await fetch(options.logoUrl);
      if (!response.ok) return;
      const contentType = response.headers.get("Content-Type") ?? "";
      const bytes = new Uint8Array(await response.arrayBuffer());
      let image;
      if (contentType.includes("png")) {
        image = await pdfDoc.embedPng(bytes);
      } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
        image = await pdfDoc.embedJpg(bytes);
      } else {
        return;
      }

      const maxLogoSize = 60;
      const { width, height } = image.scale(1);
      const scale = Math.min(1, maxLogoSize / width, maxLogoSize / height);
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;

      currentPage.drawImage(image, {
        x: margin,
        y: cursorY - scaledHeight,
        width: scaledWidth,
        height: scaledHeight
      });

      return scaledHeight;
    } catch {
      // Silently skip logo if fetch fails
      return;
    }
  }

  function ensureSpace(requiredHeight: number) {
    // Leave 80pt at the bottom for footer on the last page
    if (cursorY - requiredHeight < 80) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
  }

  function drawTextBlock(params: {
    text: string;
    size: number;
    font: typeof fontRegular;
    color: ReturnType<typeof rgb>;
    x: number;
    y: number;
  }) {
    const { text, size, font, color, x, y } = params;
    currentPage.drawText(text, {
      x,
      y,
      size,
      font,
      color
    });
  }

  function wrapText(text: string, size: number, font: typeof fontRegular, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines;
  }

  function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0
    }).format(value);
  }

  // Header section
  const logoHeight = await maybeEmbedLogo();

  const headerRightX = margin + (logoHeight ? 70 : 0);
  const headerTopY = cursorY;

  drawTextBlock({
    text: companyName,
    size: companyNameSize,
    font: fontBold,
    color: teal,
    x: headerRightX,
    y: headerTopY - companyNameSize
  });

  drawTextBlock({
    text: "Property Renovation Estimate",
    size: 11,
    font: fontRegular,
    color: mediumGrey,
    x: headerRightX,
    y: headerTopY - companyNameSize - 16
  });

  cursorY = headerTopY - (logoHeight ?? companyNameSize + 20) - 16;

  // Horizontal teal line
  currentPage.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: pageWidth - margin, y: cursorY },
    thickness: 1,
    color: teal
  });

  cursorY -= 24;

  // Property details section
  ensureSpace(80);
  drawTextBlock({
    text: "Property Details",
    size: sectionHeadingSize,
    font: fontBold,
    color: teal,
    x: margin,
    y: cursorY
  });
  cursorY -= sectionHeadingSize + 8;

  const descriptionLines = wrapText(
    input.propertyDescription,
    propertyDescriptionSize,
    fontRegular,
    contentWidth
  );
  for (const line of descriptionLines) {
    ensureSpace(propertyDescriptionSize + 2);
    drawTextBlock({
      text: line,
      size: propertyDescriptionSize,
      font: fontRegular,
      color: darkText,
      x: margin,
      y: cursorY
    });
    cursorY -= propertyDescriptionSize + 4;
  }

  if (input.metadata) {
    cursorY -= 8;
    ensureSpace(60);
    const leftX = margin;
    const rightX = margin + contentWidth / 2;

    const metaLinesLeft: string[] = [];
    const metaLinesRight: string[] = [];

    if (input.metadata.postcodeDistrict) {
      metaLinesLeft.push(`Postcode district: ${input.metadata.postcodeDistrict}`);
    }
    if (input.metadata.renovationScope) {
      metaLinesLeft.push(`Renovation scope: ${input.metadata.renovationScope}`);
    }
    if (input.metadata.qualityTier) {
      metaLinesLeft.push(`Quality tier: ${input.metadata.qualityTier}`);
    }
    if (typeof input.metadata.yearBuilt === "number") {
      metaLinesRight.push(`Year built: ${input.metadata.yearBuilt}`);
    }
    if (typeof input.metadata.listedBuilding === "boolean") {
      metaLinesRight.push(`Listed building: ${input.metadata.listedBuilding ? "Yes" : "No"}`);
    }

    const lineHeight = propertyDescriptionSize + 4;

    metaLinesLeft.forEach((text, index) => {
      ensureSpace(lineHeight);
      drawTextBlock({
        text,
        size: propertyDescriptionSize,
        font: fontRegular,
        color: darkText,
        x: leftX,
        y: cursorY - index * lineHeight
      });
    });

    metaLinesRight.forEach((text, index) => {
      ensureSpace(lineHeight);
      drawTextBlock({
        text,
        size: propertyDescriptionSize,
        font: fontRegular,
        color: darkText,
        x: rightX,
        y: cursorY - index * lineHeight
      });
    });

    const linesCount = Math.max(metaLinesLeft.length, metaLinesRight.length);
    cursorY -= linesCount * lineHeight + 8;
  }

  if (input.adjustments && input.adjustments.length > 0) {
    ensureSpace(40);
    drawTextBlock({
      text: "Adjustments:",
      size: propertyDescriptionSize,
      font: fontBold,
      color: darkText,
      x: margin,
      y: cursorY
    });
    cursorY -= propertyDescriptionSize + 4;

    for (const adjustment of input.adjustments) {
      const line = `${adjustment.label}: ${adjustment.amount >= 0 ? "+" : ""}${formatCurrency(
        adjustment.amount
      )} — ${adjustment.reason}`;
      const lines = wrapText(line, propertyDescriptionSize, fontRegular, contentWidth);
      for (const l of lines) {
        ensureSpace(propertyDescriptionSize + 2);
        drawTextBlock({
          text: l,
          size: propertyDescriptionSize,
          font: fontRegular,
          color: darkText,
          x: margin,
          y: cursorY
        });
        cursorY -= propertyDescriptionSize + 2;
      }
    }

    cursorY -= 8;
  }

  // Cost breakdown table
  ensureSpace(80);
  drawTextBlock({
    text: "Cost Breakdown",
    size: sectionHeadingSize,
    font: fontBold,
    color: teal,
    x: margin,
    y: cursorY
  });
  cursorY -= sectionHeadingSize + 8;

  const colCategoryWidth = contentWidth * 0.4;
  const colValueWidth = (contentWidth * 0.6) / 3;

  const headerHeight = 18;
  ensureSpace(headerHeight + 8);

  currentPage.drawRectangle({
    x: margin,
    y: cursorY - headerHeight,
    width: contentWidth,
    height: headerHeight,
    color: teal
  });

  const headerY = cursorY - headerHeight + 4;

  drawTextBlock({
    text: "Category",
    size: tableTextSize,
    font: fontBold,
    color: white,
    x: margin + 4,
    y: headerY
  });
  drawTextBlock({
    text: "Low",
    size: tableTextSize,
    font: fontBold,
    color: white,
    x: margin + colCategoryWidth + 4,
    y: headerY
  });
  drawTextBlock({
    text: "Typical",
    size: tableTextSize,
    font: fontBold,
    color: white,
    x: margin + colCategoryWidth + colValueWidth + 4,
    y: headerY
  });
  drawTextBlock({
    text: "High",
    size: tableTextSize,
    font: fontBold,
    color: white,
    x: margin + colCategoryWidth + colValueWidth * 2 + 4,
    y: headerY
  });

  cursorY -= headerHeight + 4;

  type Row = {
    category: string;
    low: number;
    typical: number;
    high: number;
  };

  const rows: Row[] = [
    ...input.categories.map((c) => ({
      category: c.category.charAt(0).toUpperCase() + c.category.slice(1),
      low: c.low,
      typical: c.typical,
      high: c.high
    })),
    ...(input.additionalFeatures ?? []).map((f) => ({
      category: f.label,
      low: f.low,
      typical: f.typical,
      high: f.high
    }))
  ];

  const rowHeight = 16;
  rows.forEach((row, index) => {
    ensureSpace(rowHeight + 2);

    const isAlt = index % 2 === 1;
    if (isAlt) {
      currentPage.drawRectangle({
        x: margin,
        y: cursorY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: lightGrey
      });
    }

    const rowY = cursorY - rowHeight + 3;

    drawTextBlock({
      text: row.category,
      size: tableTextSize,
      font: fontRegular,
      color: darkText,
      x: margin + 4,
      y: rowY
    });
    drawTextBlock({
      text: formatCurrency(row.low),
      size: tableTextSize,
      font: fontRegular,
      color: darkText,
      x: margin + colCategoryWidth + 4,
      y: rowY
    });
    drawTextBlock({
      text: formatCurrency(row.typical),
      size: tableTextSize,
      font: fontRegular,
      color: darkText,
      x: margin + colCategoryWidth + colValueWidth + 4,
      y: rowY
    });
    drawTextBlock({
      text: formatCurrency(row.high),
      size: tableTextSize,
      font: fontRegular,
      color: darkText,
      x: margin + colCategoryWidth + colValueWidth * 2 + 4,
      y: rowY
    });

    cursorY -= rowHeight + 2;
  });

  // Separator line before totals
  ensureSpace(10);
  currentPage.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: pageWidth - margin, y: cursorY },
    thickness: 1,
    color: teal
  });
  cursorY -= 10;

  // Totals row
  const totalsHeight = 18;
  ensureSpace(totalsHeight + 4);

  const totalsY = cursorY - totalsHeight + 3;

  drawTextBlock({
    text: "TOTAL",
    size: tableTextSize,
    font: fontBold,
    color: teal,
    x: margin + 4,
    y: totalsY
  });
  drawTextBlock({
    text: formatCurrency(input.totalLow),
    size: tableTextSize,
    font: fontBold,
    color: teal,
    x: margin + colCategoryWidth + 4,
    y: totalsY
  });
  drawTextBlock({
    text: formatCurrency(input.totalTypical),
    size: tableTextSize,
    font: fontBold,
    color: teal,
    x: margin + colCategoryWidth + colValueWidth + 4,
    y: totalsY
  });
  drawTextBlock({
    text: formatCurrency(input.totalHigh),
    size: tableTextSize,
    font: fontBold,
    color: teal,
    x: margin + colCategoryWidth + colValueWidth * 2 + 4,
    y: totalsY
  });

  cursorY -= totalsHeight + 8;

  // Summary section
  ensureSpace(60);

  const summaryLines: string[] = [];

  summaryLines.push(
    `Cost per m²: ${formatCurrency(input.costPerM2.low)} (low) · ${formatCurrency(
      input.costPerM2.typical
    )} (typical) · ${formatCurrency(input.costPerM2.high)} (high)`
  );

  if (typeof input.contingencyPercent === "number") {
    summaryLines.push(`Includes ${input.contingencyPercent}% contingency`);
  }
  if (typeof input.feesPercent === "number") {
    summaryLines.push(`Includes ${input.feesPercent}% professional fees`);
  }

  summaryLines.forEach((line) => {
    const lines = wrapText(line, propertyDescriptionSize, fontRegular, contentWidth);
    for (const l of lines) {
      ensureSpace(propertyDescriptionSize + 2);
      drawTextBlock({
        text: l,
        size: propertyDescriptionSize,
        font: fontRegular,
        color: mediumGrey,
        x: margin,
        y: cursorY
      });
      cursorY -= propertyDescriptionSize + 4;
    }
  });

  // Footer on last page only
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];

  const footerY = margin;
  const dateString = generatedAt.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  lastPage.drawText(disclaimerText, {
    x: margin,
    y: footerY + 14,
    size: disclaimerSize,
    font: fontRegular,
    color: mediumGrey,
    maxWidth: contentWidth,
    lineHeight: disclaimerSize + 2
  });

  lastPage.drawText(`Generated on ${dateString}`, {
    x: margin,
    y: footerY,
    size: dateSize,
    font: fontRegular,
    color: mediumGrey
  });

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  const trailer = `\n% ${companyName}\n% ${disclaimerText}\n`;
  const trailerBytes = new TextEncoder().encode(trailer);
  const mergedBytes = new Uint8Array(pdfBytes.length + trailerBytes.length);
  mergedBytes.set(pdfBytes, 0);
  mergedBytes.set(trailerBytes, pdfBytes.length);
  return mergedBytes;
}
