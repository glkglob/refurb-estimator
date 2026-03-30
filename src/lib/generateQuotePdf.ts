import {
  PDFDocument,
  PDFFont,
  PDFImage,
  rgb,
  StandardFonts,
  // NOTE: Intentionally NOT importing PDFName/PDFString.
  // We avoid poking into pdf-lib internal trailer/info dictionaries.
} from "pdf-lib";

export type QuotePdfInput = {
  propertyDescription: string;

  categories: Array<{
    category: string;
    low: number;
    typical: number;
    high: number;
    refined?: boolean;
    scopeItems?: string[];
    notes?: string;
  }>;

  totalLow: number;
  totalTypical: number;
  totalHigh: number;

  costPerM2: {
    low: number;
    typical: number;
    high: number;
  };

  contingencyPercent?: number;
  feesPercent?: number;

  adjustments?: Array<{
    label: string;
    amount: number;
    reason: string;
  }>;

  additionalFeatures?: Array<{
    label: string;
    low: number;
    typical: number;
    high: number;
  }>;

  metadata?: {
    postcodeDistrict?: string;
    renovationScope?: string;
    qualityTier?: string;
    yearBuilt?: number;
    listedBuilding?: boolean;
    propertyAddress?: string;
    postcode?: string;
    regionName?: string;
  };
};

export type QuotePdfOptions = {
  companyName?: string;
  logoUrl?: string;
  disclaimer?: string;
  generatedAt?: Date;
  estimateReference?: string;
};

type CurrencyRow = {
  label: string;
  low: number;
  typical: number;
  high: number;
  refined?: boolean;
  scopeItems?: string[];
  notes?: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const SCOPE_INDENT = MARGIN + 12;
const FOOTER_RESERVED_HEIGHT = 90;

const COLORS = {
  teal: rgb(0.05, 0.58, 0.53),
  darkText: rgb(0.1, 0.1, 0.1),
  mediumGrey: rgb(0.4, 0.4, 0.4),
  lightGrey: rgb(0.95, 0.95, 0.95),
  amber: rgb(0.86, 0.56, 0.1),
  white: rgb(1, 1, 1),
};

const FONT_SIZES = {
  wordmark: 18,
  sectionHeading: 13,
  body: 10.5,
  small: 8.5,
  table: 9,
};

function formatCurrencyGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateGB(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function assertFiniteNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a finite non-negative number`);
  }
}

function normaliseSingleLineText(value: string | undefined, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\s+/g, " ") : fallback;
}

function titleCase(value: string): string {
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "—";
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function wrapText(text: string, size: number, font: PDFFont, maxWidth: number): string[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, size);

    if (width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) lines.push(currentLine);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      currentLine = word;
      continue;
    }

    // hard wrap a single long "word"
    let chunk = "";
    for (const char of word) {
      const nextChunk = `${chunk}${char}`;
      if (font.widthOfTextAtSize(nextChunk, size) <= maxWidth) {
        chunk = nextChunk;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    }
    currentLine = chunk;
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}

function truncateText(text: string, size: number, font: PDFFont, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;

  let result = text;
  while (result.length > 0 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return result ? `${result}…` : "…";
}

function makeEstimateReference(input: QuotePdfInput, generatedAt: Date): string {
  const seed = [
    generatedAt.toISOString(),
    input.totalTypical,
    input.metadata?.postcodeDistrict ?? "",
    input.metadata?.postcode ?? "",
    input.metadata?.propertyAddress ?? input.propertyDescription ?? "",
  ].join("|");

  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }

  const sixDigits = (hash % 1_000_000).toString().padStart(6, "0");
  return `RE-${sixDigits}`;
}

function validateInput(input: QuotePdfInput): void {
  if (!input.propertyDescription?.trim() && !input.metadata?.propertyAddress?.trim()) {
    throw new Error("Either propertyDescription or metadata.propertyAddress is required");
  }

  if (!Array.isArray(input.categories)) {
    throw new Error("categories must be an array");
  }

  for (const [index, category] of input.categories.entries()) {
    if (!category.category?.trim()) {
      throw new Error(`categories[${index}].category is required`);
    }
    assertFiniteNonNegative(category.low, `categories[${index}].low`);
    assertFiniteNonNegative(category.typical, `categories[${index}].typical`);
    assertFiniteNonNegative(category.high, `categories[${index}].high`);
  }

  for (const [index, feature] of (input.additionalFeatures ?? []).entries()) {
    if (!feature.label?.trim()) {
      throw new Error(`additionalFeatures[${index}].label is required`);
    }
    assertFiniteNonNegative(feature.low, `additionalFeatures[${index}].low`);
    assertFiniteNonNegative(feature.typical, `additionalFeatures[${index}].typical`);
    assertFiniteNonNegative(feature.high, `additionalFeatures[${index}].high`);
  }

  for (const [index, adjustment] of (input.adjustments ?? []).entries()) {
    if (!adjustment.label?.trim()) {
      throw new Error(`adjustments[${index}].label is required`);
    }
    if (!adjustment.reason?.trim()) {
      throw new Error(`adjustments[${index}].reason is required`);
    }
    if (!Number.isFinite(adjustment.amount)) {
      throw new Error(`adjustments[${index}].amount must be finite`);
    }
  }

  assertFiniteNonNegative(input.totalLow, "totalLow");
  assertFiniteNonNegative(input.totalTypical, "totalTypical");
  assertFiniteNonNegative(input.totalHigh, "totalHigh");

  assertFiniteNonNegative(input.costPerM2.low, "costPerM2.low");
  assertFiniteNonNegative(input.costPerM2.typical, "costPerM2.typical");
  assertFiniteNonNegative(input.costPerM2.high, "costPerM2.high");

  if (isFiniteNumber(input.contingencyPercent) && input.contingencyPercent < 0) {
    throw new Error("contingencyPercent must be non-negative");
  }

  if (isFiniteNumber(input.feesPercent) && input.feesPercent < 0) {
    throw new Error("feesPercent must be non-negative");
  }
}

async function embedLogoIfAvailable(
  pdfDoc: PDFDocument,
  logoUrl: string | undefined,
): Promise<PDFImage | undefined> {
  if (!logoUrl || typeof fetch !== "function") return undefined;

  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return undefined;

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const bytes = new Uint8Array(await response.arrayBuffer());

    if (contentType.includes("png")) return await pdfDoc.embedPng(bytes);
    if (contentType.includes("jpeg") || contentType.includes("jpg")) return await pdfDoc.embedJpg(bytes);

    return undefined;
  } catch {
    return undefined;
  }
}

export async function generateQuotePdf(
  input: QuotePdfInput,
  options?: QuotePdfOptions,
): Promise<Uint8Array> {
  validateInput(input);

  const pdfDoc = await PDFDocument.create();
  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let cursorY = PAGE_HEIGHT - MARGIN;
  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const companyName = normaliseSingleLineText(options?.companyName, "UK Property Refurb Estimator");
  const generatedAt = options?.generatedAt ?? new Date();
  const estimateReference = options?.estimateReference ?? makeEstimateReference(input, generatedAt);

  const defaultDisclaimer =
    "This estimate is for guidance only and does not constitute a formal quotation. Actual costs may vary based on site conditions, specifications, and market rates. We recommend obtaining contractor quotations before proceeding.";
  const disclaimerText = normaliseSingleLineText(options?.disclaimer, defaultDisclaimer);

  // Metadata (public pdf-lib API only)
  pdfDoc.setTitle(companyName);
  pdfDoc.setAuthor(companyName);
  pdfDoc.setProducer(companyName);
  pdfDoc.setCreator(companyName);
  pdfDoc.setSubject("Property refurbishment estimate");
  pdfDoc.setKeywords([
    "property refurbishment",
    "renovation estimate",
    "UK estimate",
    estimateReference,
  ]);

  function ensureSpace(requiredHeight: number): void {
    if (cursorY - requiredHeight < FOOTER_RESERVED_HEIGHT) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - MARGIN;
    }
  }

  function drawText(params: {
    text: string;
    size: number;
    font: PDFFont;
    color: ReturnType<typeof rgb>;
    x: number;
    y: number;
    maxWidth?: number;
    lineHeight?: number;
  }): void {
    const { text, size, font, color, x, y, maxWidth, lineHeight } = params;

    currentPage.drawText(text, {
      x,
      y,
      size,
      font,
      color,
      ...(typeof maxWidth === "number" ? { maxWidth } : {}),
      ...(typeof lineHeight === "number" ? { lineHeight } : {}),
    });
  }

  function drawSectionHeading(title: string): void {
    ensureSpace(FONT_SIZES.sectionHeading + 12);
    drawText({
      text: title,
      size: FONT_SIZES.sectionHeading,
      font: fontBold,
      color: COLORS.teal,
      x: MARGIN,
      y: cursorY,
    });
    cursorY -= FONT_SIZES.sectionHeading + 8;
  }

  function drawBodyLines(
    lines: string[],
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    size = FONT_SIZES.body,
    bullet = false,
  ): void {
    for (const line of lines) {
      ensureSpace(size + 4);
      drawText({
        text: bullet ? `• ${line}` : line,
        size,
        font,
        color,
        x: MARGIN,
        y: cursorY,
      });
      cursorY -= size + 4;
    }
  }

  const logo = await embedLogoIfAvailable(pdfDoc, options?.logoUrl);
  let logoWidth = 0;
  let logoHeight = 0;

  if (logo) {
    const maxLogoSize = 42;
    const scaled = logo.scale(1);
    const scale = Math.min(1, maxLogoSize / scaled.width, maxLogoSize / scaled.height);
    logoWidth = scaled.width * scale;
    logoHeight = scaled.height * scale;

    currentPage.drawImage(logo, {
      x: MARGIN,
      y: cursorY - logoHeight,
      width: logoWidth,
      height: logoHeight,
    });
  }

  const headerLeftX = MARGIN + (logo ? logoWidth + 10 : 0);
  const headerTopY = cursorY;

  drawText({
    text: companyName,
    size: FONT_SIZES.wordmark,
    font: fontBold,
    color: COLORS.teal,
    x: headerLeftX,
    y: headerTopY - FONT_SIZES.wordmark,
  });

  const addressText =
    input.metadata?.propertyAddress || input.metadata?.postcode
      ? [input.metadata?.propertyAddress, input.metadata?.postcode].filter(Boolean).join(", ")
      : normaliseSingleLineText(input.propertyDescription, "Property address not provided");

  const headerRightLimit = PAGE_WIDTH - MARGIN - headerLeftX;
  const addressLines = wrapText(addressText, FONT_SIZES.body, fontRegular, headerRightLimit);

  let headerMetaY = headerTopY - FONT_SIZES.wordmark - 18;
  for (const line of addressLines.slice(0, 2)) {
    drawText({
      text: line,
      size: FONT_SIZES.body,
      font: fontRegular,
      color: COLORS.darkText,
      x: headerLeftX,
      y: headerMetaY,
    });
    headerMetaY -= FONT_SIZES.body + 3;
  }

  const dateStr = formatDateGB(generatedAt);

  drawText({
    text: `Date generated: ${dateStr}`,
    size: FONT_SIZES.small,
    font: fontRegular,
    color: COLORS.mediumGrey,
    x: headerLeftX,
    y: headerMetaY - 4,
  });

  drawText({
    text: `Estimate reference: ${estimateReference}`,
    size: FONT_SIZES.small,
    font: fontRegular,
    color: COLORS.mediumGrey,
    x: headerLeftX,
    y: headerMetaY - 4 - (FONT_SIZES.small + 3),
  });

  cursorY = (logo ? headerTopY - Math.max(logoHeight, 76) : headerTopY - 76) - 12;

  currentPage.drawLine({
    start: { x: MARGIN, y: cursorY },
    end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
    thickness: 1,
    color: COLORS.teal,
  });
  cursorY -= 20;

  drawSectionHeading("Project Summary");

  const projectType = titleCase(input.metadata?.renovationScope ?? "—");
  const finishLevel = titleCase(input.metadata?.qualityTier ?? "—");
  const regionText = normaliseSingleLineText(
    input.metadata?.regionName ?? input.metadata?.postcodeDistrict ?? input.metadata?.postcode,
    "—",
  );

  const summaryLine = `Project type: ${projectType}   |   Finish level: ${finishLevel}   |   Region: ${regionText}`;
  drawBodyLines(wrapText(summaryLine, FONT_SIZES.body, fontRegular, contentWidth), fontRegular, COLORS.darkText);

  const propertyFacts: string[] = [];
  if (input.metadata?.postcodeDistrict?.trim()) {
    propertyFacts.push(`Postcode district: ${input.metadata.postcodeDistrict.trim()}`);
  }
  if (typeof input.metadata?.yearBuilt === "number") {
    propertyFacts.push(`Year built: ${input.metadata.yearBuilt}`);
  }
  if (typeof input.metadata?.listedBuilding === "boolean") {
    propertyFacts.push(`Listed building: ${input.metadata.listedBuilding ? "Yes" : "No"}`);
  }

  if (propertyFacts.length > 0) {
    drawBodyLines(
      wrapText(propertyFacts.join("   |   "), FONT_SIZES.body, fontRegular, contentWidth),
      fontRegular,
      COLORS.darkText,
    );
  }

  cursorY -= 4;
  ensureSpace(FONT_SIZES.body + 10);

  drawText({
    text: `Total: Low ${formatCurrencyGBP(input.totalLow)}   |   Typical ${formatCurrencyGBP(
      input.totalTypical,
    )}   |   High ${formatCurrencyGBP(input.totalHigh)}`,
    size: FONT_SIZES.body,
    font: fontBold,
    color: COLORS.teal,
    x: MARGIN,
    y: cursorY,
  });
  cursorY -= FONT_SIZES.body + 8;

  drawText({
    text: `Cost per m²: Low ${formatCurrencyGBP(input.costPerM2.low)}   |   Typical ${formatCurrencyGBP(
      input.costPerM2.typical,
    )}   |   High ${formatCurrencyGBP(input.costPerM2.high)}`,
    size: FONT_SIZES.body,
    font: fontRegular,
    color: COLORS.darkText,
    x: MARGIN,
    y: cursorY,
  });
  cursorY -= FONT_SIZES.body + 14;

  drawSectionHeading("Cost Breakdown");

  const tableCategoryWidth = contentWidth * 0.4;
  const tableValueWidth = (contentWidth - tableCategoryWidth) / 3;
  const tableHeaderHeight = 18;

  ensureSpace(tableHeaderHeight + 8);

  currentPage.drawRectangle({
    x: MARGIN,
    y: cursorY - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: COLORS.teal,
  });

  const tableHeaderY = cursorY - tableHeaderHeight + 4;

  const headerCells = [
    { text: "Category", x: MARGIN + 4 },
    { text: "Low", x: MARGIN + tableCategoryWidth + 4 },
    { text: "Typical", x: MARGIN + tableCategoryWidth + tableValueWidth + 4 },
    { text: "High", x: MARGIN + tableCategoryWidth + tableValueWidth * 2 + 4 },
  ];

  for (const cell of headerCells) {
    drawText({
      text: cell.text,
      size: FONT_SIZES.table,
      font: fontBold,
      color: COLORS.white,
      x: cell.x,
      y: tableHeaderY,
    });
  }

  cursorY -= tableHeaderHeight + 4;

  const rows: CurrencyRow[] = [
    ...input.categories.map((item) => ({
      label: titleCase(item.category),
      low: item.low,
      typical: item.typical,
      high: item.high,
      refined: item.refined,
      scopeItems: item.scopeItems?.filter((scopeItem) => scopeItem.trim().length > 0),
      notes: item.notes,
    })),
    ...(input.additionalFeatures ?? []).map((item) => ({
      label: titleCase(item.label),
      low: item.low,
      typical: item.typical,
      high: item.high,
    })),
  ];

  const rowHeight = 16;
  const scopeTextWidth = PAGE_WIDTH - MARGIN - SCOPE_INDENT;

  rows.forEach((row, index) => {
    ensureSpace(rowHeight + 2);

    if (index % 2 === 1) {
      currentPage.drawRectangle({
        x: MARGIN,
        y: cursorY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: COLORS.lightGrey,
      });
    }

    const rowY = cursorY - rowHeight + 3;
    const categoryText = truncateText(row.label, FONT_SIZES.table, fontRegular, tableCategoryWidth - 8);

    drawText({
      text: categoryText,
      size: FONT_SIZES.table,
      font: fontRegular,
      color: COLORS.darkText,
      x: MARGIN + 4,
      y: rowY,
    });

    const lowText = formatCurrencyGBP(row.low);
    const typicalText = formatCurrencyGBP(row.typical);
    const highText = formatCurrencyGBP(row.high);

    const lowX = MARGIN + tableCategoryWidth + 4;
    const typicalX = MARGIN + tableCategoryWidth + tableValueWidth + 4;
    const highX = MARGIN + tableCategoryWidth + tableValueWidth * 2 + 4;

    drawText({
      text: lowText,
      size: FONT_SIZES.table,
      font: fontRegular,
      color: COLORS.darkText,
      x: lowX,
      y: rowY,
    });

    drawText({
      text: typicalText,
      size: FONT_SIZES.table,
      font: fontRegular,
      color: COLORS.darkText,
      x: typicalX,
      y: rowY,
    });

    drawText({
      text: highText,
      size: FONT_SIZES.table,
      font: fontRegular,
      color: COLORS.darkText,
      x: highX,
      y: rowY,
    });

    if (row.refined === true) {
      drawText({
        text: " (Refined)",
        size: FONT_SIZES.table,
        font: fontRegular,
        color: COLORS.amber,
        x: typicalX + fontRegular.widthOfTextAtSize(typicalText, FONT_SIZES.table) + 2,
        y: rowY,
      });
    }

    cursorY -= rowHeight + 2;

    for (const scopeItem of row.scopeItems ?? []) {
      const scopeLines = wrapText(`• ${scopeItem}`, FONT_SIZES.small, fontRegular, scopeTextWidth);

      for (const scopeLine of scopeLines) {
        ensureSpace(FONT_SIZES.small + 3);
        drawText({
          text: scopeLine,
          size: FONT_SIZES.small,
          font: fontRegular,
          color: COLORS.mediumGrey,
          x: SCOPE_INDENT,
          y: cursorY,
        });
        cursorY -= FONT_SIZES.small + 3;
      }
    }

    const trimmedNotes = row.notes?.trim();
    if (trimmedNotes) {
      const noteLines = wrapText(`Note: ${trimmedNotes}`, FONT_SIZES.small, fontRegular, scopeTextWidth);

      for (const noteLine of noteLines) {
        ensureSpace(FONT_SIZES.small + 3);
        drawText({
          text: noteLine,
          size: FONT_SIZES.small,
          font: fontRegular,
          color: COLORS.mediumGrey,
          x: SCOPE_INDENT,
          y: cursorY,
        });
        cursorY -= FONT_SIZES.small + 3;
      }
    }

    if ((row.scopeItems?.length ?? 0) > 0 || trimmedNotes) {
      cursorY -= 2;
    }
  });

  cursorY -= 6;
  drawSectionHeading("Additional Costs");

  const planningFee = 258;
  const buildingControlLow = 500;
  const buildingControlHigh = 1200;

  let architectLow: number;
  let architectHigh: number;

  if (isFiniteNumber(input.feesPercent)) {
    const pct = input.feesPercent / 100;
    architectLow = Math.round(input.totalTypical * Math.max(0, pct - 0.01));
    architectHigh = Math.round(input.totalTypical * (pct + 0.01));
  } else {
    architectLow = Math.round(input.totalTypical * 0.06);
    architectHigh = Math.round(input.totalTypical * 0.1);
  }

  const contingencyPercent = isFiniteNumber(input.contingencyPercent) ? input.contingencyPercent : 10;
  const contingencyValue = Math.round(input.totalTypical * (contingencyPercent / 100));

  const additionalCostLines = [
    `Architect fees (estimate): ${formatCurrencyGBP(architectLow)}–${formatCurrencyGBP(architectHigh)}`,
    `Planning: ${formatCurrencyGBP(planningFee)}`,
    `Building control: ${formatCurrencyGBP(buildingControlLow)}–${formatCurrencyGBP(buildingControlHigh)}`,
    `Contingency (${contingencyPercent}%): ${formatCurrencyGBP(contingencyValue)}`,
  ];

  for (const line of additionalCostLines) {
    drawBodyLines(
      wrapText(line, FONT_SIZES.body, fontRegular, contentWidth),
      fontRegular,
      COLORS.darkText,
      FONT_SIZES.body,
      true,
    );
  }

  cursorY -= 8;

  if ((input.adjustments?.length ?? 0) > 0) {
    drawSectionHeading("Adjustments");

    for (const adjustment of input.adjustments ?? []) {
      const amountText =
        adjustment.amount >= 0
          ? `+${formatCurrencyGBP(adjustment.amount)}`
          : `-${formatCurrencyGBP(Math.abs(adjustment.amount))}`;

      const fullText = `${adjustment.label}: ${amountText} — ${adjustment.reason}`;
      drawBodyLines(wrapText(fullText, FONT_SIZES.body, fontRegular, contentWidth), fontRegular, COLORS.darkText);
    }

    cursorY -= 8;
  }

  drawSectionHeading("Assumptions & Disclaimers");

  const regionalPricingArea = normaliseSingleLineText(
    input.metadata?.regionName ?? input.metadata?.postcodeDistrict,
    "your area",
  );

  const disclaimerLines = [
    disclaimerText,
    "This estimate was generated by UK Property Refurb Estimator (refurb-estimator.vercel.app).",
    `Prices are based on UK regional averages for ${regionalPricingArea}. Actual costs may vary.`,
  ];

  for (const line of disclaimerLines) {
    drawBodyLines(wrapText(line, FONT_SIZES.body, fontRegular, contentWidth), fontRegular, COLORS.mediumGrey);
    cursorY -= 2;
  }

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const footerY = MARGIN;

  lastPage.drawText(`Generated on ${dateStr} • ${estimateReference}`, {
    x: MARGIN,
    y: footerY,
    size: FONT_SIZES.small,
    font: fontRegular,
    color: COLORS.mediumGrey,
  });

  return await pdfDoc.save({ useObjectStreams: false });
}
