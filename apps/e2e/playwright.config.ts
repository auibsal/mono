import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys against a local Supabase stack and the two apps in
 * dev mode (CI: .github/workflows/ci.yml, job "End-to-end"). Locally:
 * `bun run db:start`, then `bun run --cwd apps/e2e e2e` (the servers are
 * started here unless already running).
 */
const web = process.env.E2E_WEB_URL ?? "http://localhost:3001";
const app = process.env.E2E_APP_URL ?? "http://localhost:3000";

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  globalSetup: "./global-setup.ts",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
          : {},
      },
    },
  ],
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  retries: 0,
  testDir: "./tests",
  timeout: 120_000,
  use: { trace: "retain-on-failure" },
  webServer: [
    {
      command: "bun run --cwd ../app dev",
      reuseExistingServer: true,
      timeout: 240_000,
      url: `${app}/en/sign-in`,
    },
    {
      command: "bun run --cwd ../web dev",
      reuseExistingServer: true,
      timeout: 240_000,
      url: `${web}/en`,
    },
  ],
  workers: 1,
});

export const urls = { app, web };
