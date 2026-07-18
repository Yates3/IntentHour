import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:41739",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npx.cmd vite --host 127.0.0.1 --port 41739 --strictPort",
    url: "http://127.0.0.1:41739/api/health",
    reuseExistingServer: false,
    timeout: 120000
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } }
  ]
});
