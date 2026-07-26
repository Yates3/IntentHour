import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/desktop-installed",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  timeout: 90_000,
  use: {
    trace: "retain-on-failure",
  },
});
