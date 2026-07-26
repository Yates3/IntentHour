import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/desktop",
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  timeout: 45_000,
  use: {
    trace: "retain-on-failure",
  },
});
