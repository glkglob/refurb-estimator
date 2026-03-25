import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type QuotePdfInput = {
  // Display fields
  propertyDescription: string; // kept for backwards compatibility (used as address if nothing else is provided)

  // Cost line items
  categories: Array<{
    category: string;
    low: number;
    typical: number;
    high: number;
  }>;  

  // Totals
  totalLow: number;
  totalTypical: number;
  totalHigh: number;

  // Other summary inputs
  costPerM2: { low: number; typical: number; high: number };
  contingencyPercent?: number;
  feesPercent?: number;

  adjustments?: Array<{ label: string; amount: number; reason: string }>;  
  additionalFeatures?: Array<{ label: string; low: number; typical: number; high: number }>;  

  metadata?: {
    postcodeDistrict?: string;
    renovationScope?: string; // project type
    qualityTier?: string; // finish level
    yearBuilt?: number;
    listedBuilding?: boolean;

    // Optional fields for the new PDF header
    propertyAddress?: string;
    postcode?: string;
    regionName?: string; // e.g. "London" / "South East" etc.
  };
};

export type QuotePdfOptions = {
  // New defaults
  companyName?: string; // default: "Refurb Estimator"
  logoUrl?: string; // optional URL to a logo image (PNG or JPEG)

  // Footer / disclaimer text (the PDF also prints some fixed lines)
  disclaimer?: string;
  generatedAt?: Date; // default: new Date()

  // Deterministic estimate reference (if not provided one will be generated)
  estimateReference?: string; // e.g. "RE-123456"
};

function formatCurrencyGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDateGB(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function wrapText(text: string, size: number, font: any, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
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
  if (currentLine) lines.push(currentLine);
  return lines;
}

function makeEstimateReference(input: QuotePdfInput, generatedAt: Date): string {
  // Stable-ish, non-cryptographic reference. Avoid pulling in additional deps.
  // Format required: RE-XXXXXX
  const seed = `${generatedAt.toISOString()}|${input.totalTypical}|${input.metadata?.postcodeDistrict ?? ""}|${
    input.metadata?.postcode ?? ""
  }|${input.metadata?.propertyAddress ?? input.propertyDescription ?? ""}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const six = (hash % 1_000_000).toString().padStart(6, "0");
  return `RE-${six}`;
}

export async function generateQuotePdf(
  input: QuotePdfInput,
  options?: QuotePdfOptions
): Promise<Uint8Array> {
  // Page setup: A4 portrait (595.28 × 841.89 points).
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  // Fonts
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Font sizes
  const wordmarkSize = 18;
  const sectionHeadingSize = 13;
  const bodySize = 10.5;
  const smallSize = 8.5;
  const tableTextSize = 9;

  // Colors
  const teal = rgb(0.05, 0.58, 0.53);
  const darkText = rgb(0.1, 0.1, 0.1);
  const mediumGrey = rgb(0.4, 0.4, 0.4);
  const lightGrey = rgb(0.95, 0.95, 0.95);
  const white = rgb(1, 1, 1);

  const companyName = options?.companyName ?? "Refurb Estimator";
  const generatedAt = options?.generatedAt ?? new Date();
  const estimateReference = options?.estimateReference ?? makeEstimateReference(input, generatedAt);

  const defaultDisclaimer =
    "This estimate is for guidance only and does not constitute a formal quotation. Actual costs may vary based on site conditions, specifications, and market rates. We recommend obtaining contractor quotations before proceeding.";
  const disclaimerText = options?.disclaimer ?? defaultDisclaimer;

  pdfDoc.setTitle(companyName);
  pdfDoc.setSubject(disclaimerText);

  async function maybeEmbedLogo() {
    if (!options?.logoUrl || typeof fetch !== "function") return;
    try {
      const response = await fetch(options.logoUrl);
      if (!response.ok) return;
      const contentType = response.headers.get("Content-Type") ?? "";
      const bytes = new Uint8Array(await response.arrayBuffer());
      let image;
      if (contentType.includes("png")) image = await pdfDoc.embedPng(bytes);
      else if (contentType.includes("jpeg") || contentType.includes("jpg")) image = await pdfDoc.embedJpg(bytes);
      else return;

      const maxLogoSize = 42;
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

      return { scaledWidth, scaledHeight };
    } catch {
      return;
    }
  }

  function ensureSpace(requiredHeight: number) {
    // Leave 90pt at the bottom for footer on the last page
    if (cursorY - requiredHeight < 90) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
  }

  function drawText(params: {
    text: string;
    size: number;
    font: any;
    color: ReturnType<typeof rgb>;
    x: number;
    y: number;
    maxWidth?: number;
    lineHeight?: number;
  }) {
    const { text, size, font, color, x, y, maxWidth, lineHeight } = params;
    currentPage.drawText(text, {
      x,
      y,
      size,
      font,
      color,
      ...(typeof maxWidth === "number" ? { maxWidth } : null),
      ...(typeof lineHeight === "number" ? { lineHeight } : null)
    });
  }

  function drawSectionHeading(title: string) {
    ensureSpace(sectionHeadingSize + 12);
    drawText({
      text: title,
      size: sectionHeadingSize,
      font: fontBold,
      color: teal,
      x: margin,
      y: cursorY
    });
    cursorY -= sectionHeadingSize + 8;
  }

  // -----------------------------
  // Header
  // -----------------------------

  const logoInfo = await maybeEmbedLogo();
  const headerLeftX = margin + (logoInfo ? logoInfo.scaledWidth + 10 : 0);
  const headerTopY = cursorY;

  // Wordmark
  drawText({
    text: companyName,
    size: wordmarkSize,
    font: fontBold,
    color: teal,
    x: headerLeftX,
    y: headerTopY - wordmarkSize
  });

  const addressText =
    input.metadata?.propertyAddress || input.metadata?.postcode
      ? [input.metadata?.propertyAddress, input.metadata?.postcode].filter(Boolean).join(", ")
      : input.propertyDescription;

  // Address / postcode (if provided)
  const addrLines = wrapText(addressText, bodySize, fontRegular, pageWidth - headerLeftX - margin);
  let addrY = headerTopY - wordmarkSize - 18;
  for (const line of addrLines.slice(0, 2)) {
    drawText({ text: line, size: bodySize, font: fontRegular, color: darkText, x: headerLeftX, y: addrY });
    addrY -= bodySize + 3;
  }

  // Date generated + estimate ref
  const dateStr = formatDateGB(generatedAt);
  drawText({
    text: `Date generated: ${dateStr}`,
    size: smallSize,
    font: fontRegular,
    color: mediumGrey,
    x: headerLeftX,
    y: addrY - 4
  });
  drawText({
    text: `Estimate reference: ${estimateReference}`,
    size: smallSize,
    font: fontRegular,
    color: mediumGrey,
    x: headerLeftX,
    y: addrY - 4 - (smallSize + 3)
  });

  cursorY = (logoInfo ? headerTopY - Math.max(logoInfo.scaledHeight, 76) : headerTopY - 76) - 12;

  // Divider
  currentPage.drawLine({
    start: { x: margin, y: cursorY },
    end: { x: pageWidth - margin, y: cursorY },
    thickness: 1,
    color: teal
  });
  cursorY -= 20;

  // -----------------------------
  // Project Summary
  // -----------------------------

  drawSectionHeading("Project Summary");

  const projectType = input.metadata?.renovationScope ?? "—";
  const finishLevel = input.metadata?.qualityTier ?? "—";
  const postcodeRegion = input.metadata?.postcodeDistrict ?? input.metadata?.postcode ?? "—";

  const summaryLine = `Project type: ${projectType}   |   Finish level: ${finishLevel}   |   Postcode region: ${postcodeRegion}`;
  const summaryLines = wrapText(summaryLine, bodySize, fontRegular, contentWidth);
  for (const line of summaryLines) {
    ensureSpace(bodySize + 2);
    drawText({ text: line, size: bodySize, font: fontRegular, color: darkText, x: margin, y: cursorY });
    cursorY -= bodySize + 4;
  }

  cursorY -= 6;
  ensureSpace(bodySize + 8);
  drawText({
    text: `Total: Low ${formatCurrencyGBP(input.totalLow)}   |   Typical ${formatCurrencyGBP(
      input.totalTypical
    )}   |   High ${formatCurrencyGBP(input.totalHigh)}`,
    size: bodySize,
    font: fontBold,
    color: teal,
    x: margin,
    y: cursorY
  });
  cursorY -= bodySize + 14;

  // -----------------------------
  // Cost Breakdown Table
  // -----------------------------

  drawSectionHeading("Cost Breakdown");

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

  const headerCells = [
    { text: "Category", x: margin + 4 },
    { text: "Low", x: margin + colCategoryWidth + 4 },
    { text: "Typical", x: margin + colCategoryWidth + colValueWidth + 4 },
    { text: "High", x: margin + colCategoryWidth + colValueWidth * 2 + 4 }
  ];
  for (const cell of headerCells) {
    drawText({ text: cell.text, size: tableTextSize, font: fontBold, color: white, x: cell.x, y: headerY });
  }

  cursorY -= headerHeight + 4;

  type Row = { category: string; low: number; typical: number; high: number };

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

    drawText({ text: row.category, size: tableTextSize, font: fontRegular, color: darkText, x: margin + 4, y: rowY });
    drawText({
      text: formatCurrencyGBP(row.low),
      size: tableTextSize,
      font: fontRegular,
      color: darkText,
      x: margin + colCategoryWidth + 4,
      y: rowY
    });
    drawText({
      text: formatCurrencyGBP(row.typical),
      size: tableTextSize,
      font: fontRegular,
      color: darkText,
      x: margin + colCategoryWidth + colValueWidth + 4,
      y: rowY
    });
    drawText({
      text: formatCurrencyGBP(row.high),
      size: tableTextSize,
      font: fontRegular,
      color: darkText,
      x: margin + colCategoryWidth + colValueWidth * 2 + 4,
      y: rowY
    });

    cursorY -= rowHeight + 2;
  });

  // -----------------------------
  // Additional Costs
  // -----------------------------

  cursorY -= 6;
  drawSectionHeading("Additional Costs");

  // Architect fees (estimate): £X–£Y
  // Planning: £258
  // Building control: £500–£1,200
  // Contingency (10%): £X

  const planningFee = 258;
  const buildingControlLow = 500;
  const buildingControlHigh = 1200;

  // Use feesPercent if provided (assume % of total typical), otherwise show a small default range.
  let architectLow: number | undefined;
  let architectHigh: number | undefined;
  if (isFiniteNumber(input.feesPercent)) {
    const pct = input.feesPercent / 100;
    // Provide a small range around the configured percent.
    architectLow = Math.round(input.totalTypical * Math.max(0, pct - 0.01));
    architectHigh = Math.round(input.totalTypical * (pct + 0.01));
  } else {
    architectLow = Math.round(input.totalTypical * 0.06);
    architectHigh = Math.round(input.totalTypical * 0.10);
  }

  const contingencyPct = isFiniteNumber(input.contingencyPercent) ? input.contingencyPercent : 10;
  const contingencyValue = Math.round(input.totalTypical * (contingencyPct / 100));

  const additionalLines = [
    `Architect fees (estimate): ${formatCurrencyGBP(architectLow)}–${formatCurrencyGBP(architectHigh)}`,
    `Planning: ${formatCurrencyGBP(planningFee)}`,
    `Building control: ${formatCurrencyGBP(buildingControlLow)}–${formatCurrencyGBP(buildingControlHigh)}`,
    `Contingency (${contingencyPct}%): ${formatCurrencyGBP(contingencyValue)}`
  ];

  for (const line of additionalLines) {
    const lines = wrapText(line, bodySize, fontRegular, contentWidth);
    for (const l of lines) {
      ensureSpace(bodySize + 2);
      drawText({ text: `• ${l}`, size: bodySize, font: fontRegular, color: darkText, x: margin, y: cursorY });
      cursorY -= bodySize + 4;
    }
  }

  cursorY -= 8;

  // -----------------------------
  // Assumptions & Disclaimers
  // -----------------------------

  drawSectionHeading("Assumptions & Disclaimers");

  const regionName = input.metadata?.regionName ?? input.metadata?.postcodeDistrict ?? "your area";

  const fixedLines = [
    disclaimerText,
    "This estimate was generated by Refurb Estimator (refurb-estimator.vercel.app)",
    `Prices based on UK regional averages for ${regionName}. Actual costs may vary.`
  ];

  for (const line of fixedLines) {
    const lines = wrapText(line, bodySize, fontRegular, contentWidth);
    for (const l of lines) {
      ensureSpace(bodySize + 2);
      drawText({ text: l, size: bodySize, font: fontRegular, color: mediumGrey, x: margin, y: cursorY });
      cursorY -= bodySize + 4;
    }
    cursorY -= 2;
  }

  // Footer on last page only
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];

  const footerY = margin;
  lastPage.drawText(`Generated on ${dateStr} • ${estimateReference}`, {
    x: margin,
    y: footerY,
    size: smallSize,
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
