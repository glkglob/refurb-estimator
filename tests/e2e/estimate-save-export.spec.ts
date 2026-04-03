import { expect, test, devices, type Download, type Locator, type Page, type Response as PlaywrightResponse } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { generateQuotePdf, type QuotePdfInput } from "../../src/lib/generateQuotePdf";

type FlowResult = {
  propertyDescription: string;
  purchasePrice: number;
  gdv: number;
  scenarioName: string;
  totalTypicalText: string;
};

type MobileMatrixEntry = {
  name: string;
  use: Omit<(typeof devices)["iPhone 12"], "defaultBrowserType">;
};

const pdfFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const hasRealPdfAuthEnv = Boolean(
  process.env.E2E_TRADESPERSON_EMAIL && process.env.E2E_TRADESPERSON_PASSWORD,
);

const mobileMatrix: MobileMatrixEntry[] = [
  { name: "iPhone 12 portrait", use: mobileDevice("iPhone 12") },
  { name: "iPhone 12 landscape", use: landscapeDevice("iPhone 12") },
  { name: "iPhone 13 Pro portrait", use: mobileDevice("iPhone 13 Pro") },
  { name: "iPhone 13 Pro landscape", use: landscapeDevice("iPhone 13 Pro") },
  { name: "iPhone SE portrait", use: mobileDevice("iPhone SE") },
  { name: "iPhone SE landscape", use: landscapeDevice("iPhone SE") },
];

function mobileDevice(name: keyof typeof devices): MobileMatrixEntry["use"] {
  const { defaultBrowserType: _defaultBrowserType, ...device } = devices[name];
  return device;
}

function landscapeDevice(name: keyof typeof devices): MobileMatrixEntry["use"] {
  const device = mobileDevice(name);

  return {
    ...device,
    viewport: {
      width: device.viewport.height,
      height: device.viewport.width,
    },
  };
}

function normalizePdfText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function extractPdfText(filePath: string): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: await fs.readFile(filePath) });

  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function clearState(page: Page): Promise<void> {
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function maybeCleanupSupabase(): Promise<void> {
  const email = process.env.E2E_TRADESPERSON_EMAIL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!email || !supabaseUrl || !serviceRoleKey) {
    return;
  }

  const { createAdminSupabaseClient } = await import("../../src/lib/supabase/admin");
  const supabase = createAdminSupabaseClient();
  const profileQuery = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle<{ id: string }>();

  if (profileQuery.error || !profileQuery.data?.id) {
    return;
  }

  await supabase.from("scenarios").delete().eq("user_id", profileQuery.data.id);
}

async function getControlByLabel(page: Page, labelText: string): Promise<Locator> {
  const label = page.locator("label", { hasText: new RegExp(`^${escapeRegExp(labelText)}$`, "i") }).first();
  const controlId = await label.getAttribute("for");

  if (!controlId) {
    throw new Error(`Unable to resolve control id for label: ${labelText}`);
  }

  return page.locator(`#${controlId}`);
}

async function selectOption(page: Page, labelText: string, optionText: string): Promise<void> {
  const trigger = await getControlByLabel(page, labelText);
  await trigger.click();
  await page.getByRole("option", { name: optionText, exact: true }).click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loginForRealPdf(page: Page): Promise<void> {
  await page.goto("/auth/login");
  await page.getByLabel(/^Email$/i).fill(process.env.E2E_TRADESPERSON_EMAIL ?? "");
  await page.getByLabel(/^Password$/i).fill(process.env.E2E_TRADESPERSON_PASSWORD ?? "");
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL(/\/scenarios$/);
}

async function runEstimateFlow(page: Page): Promise<FlowResult> {
  const scenarioName = `E2E Scenario ${Date.now()}`;
  const purchasePrice = 175_000;
  const gdv = 250_000;

  await page.goto("/");
  await selectOption(page, "Region", "London");
  await selectOption(page, "Property Type", "Terraced House");
  await page.getByLabel(/Total Area \(m²\)/i).fill("75");
  await selectOption(page, "Current Condition", "Fair");
  await selectOption(page, "Finish Level", "Standard");
  await page.getByRole("button", { name: /Calculate Estimate/i }).click();

  await expect(page.getByRole("heading", { name: "Your Estimate" })).toBeVisible();
  await expect(page.getByText(/75m² Terraced House in london/i)).toBeVisible();
  await expect(page.getByText(/fair condition/i)).toBeVisible();
  await expect(page.getByText(/standard finish/i)).toBeVisible();
  await expect(page.getByText(/^Low$/)).toBeVisible();
  await expect(page.getByText(/^Typical$/)).toBeVisible();
  await expect(page.getByText(/^High$/)).toBeVisible();
  await expect(page.getByText(/Cost per m²:/i).first()).toBeVisible();

  const totalTypicalText = await page
    .locator("section#results")
    .getByText(/^£[\d,]+$/)
    .nth(1)
    .textContent();

  await page.getByRole("button", { name: /^Save Scenario$/i }).click();
  await expect(page.getByRole("dialog", { name: /^Save Scenario$/i })).toBeVisible();
  await page.getByLabel(/Scenario name/i).fill(scenarioName);
  await page.getByLabel(/Purchase price/i).fill(String(purchasePrice));
  await page.getByLabel(/GDV/i).fill(String(gdv));
  await page.getByRole("dialog", { name: /^Save Scenario$/i }).getByRole("button", { name: /^Save$/i }).click();

  await expect(page.getByText(/Scenario saved/i)).toBeVisible();

  await page.goto("/scenarios");
  await expect(page.getByRole("heading", { name: /Scenario Comparison/i })).toBeVisible();

  const row = page.locator("tr").filter({ hasText: scenarioName }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(pdfFormatter.format(purchasePrice));
  await expect(row).toContainText(pdfFormatter.format(gdv));

  if (totalTypicalText) {
    await expect(row).toContainText(totalTypicalText.trim());
  }

  return {
    propertyDescription: "75m² Terraced House in london, fair condition, standard finish",
    purchasePrice,
    gdv,
    scenarioName,
    totalTypicalText: totalTypicalText?.trim() ?? "",
  };
}

async function mockPdfRoute(page: Page): Promise<void> {
  await page.route("**/api/v1/estimate/pdf", async (route) => {
    const body = route.request().postDataJSON() as { input: QuotePdfInput };
    const pdfBytes = await generateQuotePdf(body.input, {
      companyName: "Canonical Test Harness",
      generatedAt: new Date("2026-04-02T10:00:00.000Z"),
    });

    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="property-estimate.pdf"',
      },
      body: Buffer.from(pdfBytes),
    });
  });
}

async function downloadAndAssertPdf(
  page: Page,
  expectedText: string[],
  outputDir: string,
): Promise<void> {
  const [download, response] = await Promise.all([
    page.waitForEvent("download"),
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes("/api/v1/estimate/pdf") &&
        candidate.request().method() === "POST",
    ),
    page.getByRole("button", { name: /^Download PDF$/i }).click(),
  ]);

  await assertPdfDownload(download, response, expectedText, outputDir);
}

async function assertPdfDownload(
  download: Download,
  response: PlaywrightResponse,
  expectedText: string[],
  outputDir: string,
): Promise<void> {
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toContain('attachment; filename="property-estimate.pdf"');

  const targetPath = path.join(outputDir, await download.suggestedFilename());
  await download.saveAs(targetPath);

  const stats = await fs.stat(targetPath);
  expect(stats.size).toBeGreaterThan(0);

  const text = normalizePdfText(await extractPdfText(targetPath));
  for (const expected of expectedText) {
    expect(text).toContain(expected);
  }
}

test.beforeEach(async ({ page }) => {
  await clearState(page);
  await maybeCleanupSupabase();
});

test.describe("Estimate -> Save -> Export PDF", () => {
  test("Desktop flow", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop", "Desktop-only flow");

    await mockPdfRoute(page);
    const flow = await runEstimateFlow(page);

    await downloadAndAssertPdf(
      page,
      [
        "Project Summary",
        "Cost Breakdown",
        "Additional Costs",
        "Assumptions & Disclaimers",
        flow.propertyDescription,
        flow.totalTypicalText,
      ],
      testInfo.outputDir,
    );
  });

  test("Desktop flow with real PDF endpoint", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop", "Desktop-only flow");
    test.skip(!hasRealPdfAuthEnv, "Requires E2E_TRADESPERSON_EMAIL and E2E_TRADESPERSON_PASSWORD");

    await loginForRealPdf(page);
    const flow = await runEstimateFlow(page);

    await downloadAndAssertPdf(
      page,
      [
        "Project Summary",
        "Cost Breakdown",
        "Assumptions & Disclaimers",
        "Terraced House",
        flow.totalTypicalText,
      ],
      testInfo.outputDir,
    );
  });

  for (const device of mobileMatrix) {
    test.describe(device.name, () => {
      test.use(device.use);

      test(device.name, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== "Mobile", "Mobile-only flow");

        await mockPdfRoute(page);
        const flow = await runEstimateFlow(page);

        await downloadAndAssertPdf(
          page,
          [
            "Project Summary",
            "Cost Breakdown",
            flow.propertyDescription,
            flow.totalTypicalText,
          ],
          testInfo.outputDir,
        );
      });
    });
  }
});
