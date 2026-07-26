import { defineConfig, devices } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: externalBaseURL ?? "http://127.0.0.1:41739",
    trace: "retain-on-failure"
  },
  webServer: externalBaseURL ? undefined : {
    command: "npm.cmd exec --yes --package=node@22.23.1 -- node tests/e2e/vite-server.mjs",
    url: "http://127.0.0.1:41739/api/health",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      ...process.env,
      INTENTHOUR_E2E: "1",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
