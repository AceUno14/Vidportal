import { defineConfig } from "@playwright/test";

const localBaseUrl = "http://127.0.0.1:3000";
const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results",
  use: {
    baseURL: configuredBaseUrl ?? localBaseUrl,
    trace: "on-first-retry",
  },
  webServer: configuredBaseUrl
    ? undefined
    : {
        command: process.env.CI ? "npm run start" : "npm run dev",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: `${localBaseUrl}/api/health`,
      },
});
