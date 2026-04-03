import { defineConfig, devices } from "@playwright/test";
import * as dotenv from "dotenv";

dotenv.config();

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ||
  process.env.API_BASE_URL ||
  "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 1,
  reporter: [["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "Desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile",
      use: { ...devices["iPhone 12"] },
    },
  ],
});
