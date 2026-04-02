import { chromium } from "playwright";
import type { SupplierPrice, SupplierUnit } from "../src/types/supplier";

const PRICE_SELECTORS = [
  '[data-test-id="productPrice"]',
  '[data-testid="productPrice"]',
  ".price",
  ".ProductPrice"
];

function parseGbpPrice(rawText: string): number | null {
  const cleaned = rawText.replace(/,/g, "");
  const match = cleaned.match(/£\s*(\d+(?:\.\d{1,2})?)/);
  if (!match) {
    return null;
  }

  const price = Number(match[1]);
  if (!Number.isFinite(price)) {
    return null;
  }

  return Math.round(price * 100) / 100;
}

function extractCoverage(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)\s*(?:m2|m²|sqm)/i);
  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function extractSize(text: string): number | undefined {
  const packMatch = text.match(/(?:pack\s*of|x)\s*(\d+)/i);
  if (packMatch) {
    const value = Number(packMatch[1]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return undefined;
}

function toExternalId(productUrl: string): string {
  try {
    const parsed = new URL(productUrl);
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => part.trim().toLowerCase());
    const candidate = parts.at(-1);

    if (candidate && candidate.length > 0) {
      return `bq-${candidate.replace(/[^a-z0-9-]/g, "-")}`;
    }
  } catch {
    // no-op fallback below
  }

  return `bq-${Date.now()}`;
}

async function getFirstAvailableText(
  page: import("playwright").Page,
  selectors: string[]
): Promise<string | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const count = await locator.count();
    if (count === 0) {
      continue;
    }

    const text = (await locator.textContent())?.trim();
    if (text) {
      return text;
    }
  }

  return null;
}

function inferUnit(coverage?: number): SupplierUnit {
  return typeof coverage === "number" && coverage > 0 ? "m2" : "item";
}

function simplifyErrorMessage(message: string): string {
  const withoutCallLog = message.split("Call log:")[0];
  const withoutBrowserLogs = withoutCallLog.split("Browser logs:")[0];
  return withoutBrowserLogs.replace(/\s+/g, " ").trim();
}

/**
 * Scrapes a B&Q product page and returns normalized supplier pricing fields.
 */
export async function scrapeBqProduct(
  productUrl: string,
  externalIdOverride?: string
): Promise<SupplierPrice> {
  let browser: import("playwright").Browser | undefined;

  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(productUrl, {
      timeout: 45_000,
      waitUntil: "domcontentloaded"
    });

    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

    const productName = (await getFirstAvailableText(page, ["h1", '[data-test-id="productTitle"]']))
      ?.replace(/\s+/g, " ")
      .trim();

    if (!productName) {
      throw new Error("Unable to find product name on B&Q page.");
    }

    const priceText = await getFirstAvailableText(page, PRICE_SELECTORS);
    if (!priceText) {
      throw new Error("Unable to find product price on B&Q page.");
    }

    const price = parseGbpPrice(priceText);
    if (price === null) {
      throw new Error(`Unable to parse GBP price from text: ${priceText}`);
    }

    const bodyText = (await page.locator("body").innerText().catch(() => "")) ?? "";
    const descriptorText = `${productName} ${bodyText}`;
    const coverage = extractCoverage(descriptorText);
    const size = extractSize(descriptorText);

    return {
      supplier: "bq",
      externalId: externalIdOverride ?? toExternalId(productUrl),
      productName,
      price,
      unit: inferUnit(coverage),
      coverage,
      size,
      url: productUrl,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scraping error";
    throw new Error(`B&Q scrape failed for ${productUrl}: ${simplifyErrorMessage(message)}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function runCli() {
  const productUrl = process.argv[2];
  if (!productUrl) {
    process.stderr.write("Usage: ts-node scripts/bqScraper.ts <bq-product-url>\n");
    process.exitCode = 1;
    return;
  }

  try {
    const result = await scrapeBqProduct(productUrl);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scraper error";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runCli();
}
