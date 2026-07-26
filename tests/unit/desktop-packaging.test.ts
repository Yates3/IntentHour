import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readDesktopTestRuntime } from "../../desktop/test-runtime";

type ForgeConfiguration = {
  outDir: string;
  packagerConfig: {
    appCopyright: string;
    asar: boolean;
    executableName: string;
    extraResource: string[];
    ignore: (path: string) => boolean;
    name: string;
    prune: boolean;
    win32metadata: {
      CompanyName: string;
      ProductName: string;
    };
  };
  makers: Array<{
    config: {
      name: string;
      noMsi: boolean;
      nuspecTemplate: string;
      setupExe: string;
      setupIcon: string;
    };
    name: string;
    platforms: string[];
  }>;
};

const require = createRequire(import.meta.url);
const forgeConfig = require("../../forge.config.cjs") as ForgeConfiguration;

describe("Desktop release packaging", () => {
  it("uses one local-icon Squirrel installer and an ASAR package", () => {
    expect(forgeConfig.outDir).toBe("out");
    expect(forgeConfig.packagerConfig).toMatchObject({
      appCopyright: "Copyright © 2026 IntentHour",
      asar: true,
      executableName: "IntentHour",
      name: "IntentHour",
      prune: false,
      win32metadata: {
        CompanyName: "IntentHour",
        ProductName: "IntentHour",
      },
    });
    expect(forgeConfig.packagerConfig.extraResource).toContain(
      resolve("desktop/assets"),
    );
    expect(forgeConfig.makers).toHaveLength(1);
    expect(forgeConfig.makers[0]).toMatchObject({
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "IntentHour",
        noMsi: true,
        nuspecTemplate: resolve(
          "desktop/packaging/template.nuspectemplate",
        ),
        setupExe: "IntentHour-Setup-1.0.0.exe",
        setupIcon: resolve("desktop/assets/intenthour.ico"),
      },
    });
    expect(forgeConfig.makers[0]?.config).not.toHaveProperty("iconUrl");
  });

  it("excludes development and test-only files from the packaged app", () => {
    const ignored = forgeConfig.packagerConfig.ignore;

    expect(ignored("/.dev.vars")).toBe(true);
    expect(ignored("/.env.local")).toBe(true);
    expect(ignored("/tests/desktop/example.spec.ts")).toBe(true);
    expect(ignored("/playwright.config.ts")).toBe(true);
    expect(ignored("/dist/desktop/test-runtime.js")).toBe(true);
    expect(ignored("/dist/intenthour/.dev.vars")).toBe(true);
    expect(ignored("/dist/desktop/main.js")).toBe(false);
    expect(ignored("/dist/desktop-renderer/index.html")).toBe(false);
    expect(ignored("/node_modules/electron-squirrel-startup/index.js"))
      .toBe(false);
    expect(ignored("/node_modules/better-auth/dist/index.mjs")).toBe(true);
    expect(ignored("/.wrangler/state/v3/local.sqlite")).toBe(true);
    expect(ignored("/.github/workflows/ci.yml")).toBe(true);
  });

  it("keeps E2E profile and timer overrides in the unpackaged test runtime", () => {
    expect(readDesktopTestRuntime(
      ["electron", "main.js", "--smoke-test"],
      {
        INTENTHOUR_DESKTOP_E2E_NOTIFICATION_DELAY_MS: "500",
        INTENTHOUR_DESKTOP_E2E_PROFILE: "C:\\测试 用户\\IntentHour Profile",
      },
    )).toEqual({
      isSmokeTest: true,
      notificationDelayMs: 500,
      userDataPath: resolve("C:\\测试 用户\\IntentHour Profile"),
    });
  });
});
