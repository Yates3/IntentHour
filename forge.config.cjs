const path = require("node:path");

const { copyright, version } = require("./package.json");

const desktopIcon = process.env.INTENTHOUR_FORGE_ICON_PATH || path.join(
    __dirname,
    "desktop",
    "assets",
    "intenthour.ico",
  );

function ignoreNonRuntimeFile(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const squirrelRoot = "/node_modules/electron-squirrel-startup";
  const squirrelRuntimeFiles = new Set([
    squirrelRoot,
    `${squirrelRoot}/index.js`,
    `${squirrelRoot}/LICENSE`,
    `${squirrelRoot}/package.json`,
    `${squirrelRoot}/node_modules`,
    `${squirrelRoot}/node_modules/debug`,
    `${squirrelRoot}/node_modules/debug/LICENSE`,
    `${squirrelRoot}/node_modules/debug/node.js`,
    `${squirrelRoot}/node_modules/debug/package.json`,
    `${squirrelRoot}/node_modules/debug/src`,
    `${squirrelRoot}/node_modules/ms`,
    `${squirrelRoot}/node_modules/ms/index.js`,
    `${squirrelRoot}/node_modules/ms/license.md`,
    `${squirrelRoot}/node_modules/ms/package.json`,
  ]);
  const isSquirrelRuntimeFile = squirrelRuntimeFiles.has(normalized) ||
    normalized.startsWith(`${squirrelRoot}/node_modules/debug/src/`);
  const isRequiredRuntimeFile = normalized === "" ||
    normalized === "/package.json" ||
    normalized === "/dist" ||
    normalized === "/dist/desktop" ||
    normalized.startsWith("/dist/desktop/") ||
    normalized === "/dist/desktop-renderer" ||
    normalized.startsWith("/dist/desktop-renderer/") ||
    normalized === "/node_modules" ||
    isSquirrelRuntimeFile;

  if (normalized === "/dist/desktop/test-runtime.js") return true;
  return !isRequiredRuntimeFile;
}

module.exports = {
  outDir: process.env.INTENTHOUR_FORGE_OUT_DIR || "out",
  packagerConfig: {
    appCopyright: copyright,
    name: "IntentHour",
    executableName: "IntentHour",
    asar: true,
    prune: false,
    icon: path.join(__dirname, "desktop", "assets", "intenthour"),
    extraResource: [
      path.join(__dirname, "desktop", "assets"),
    ],
    ignore: ignoreNonRuntimeFile,
    win32metadata: {
      CompanyName: "IntentHour",
      FileDescription: "IntentHour local-first focus client",
      InternalName: "IntentHour",
      OriginalFilename: "IntentHour.exe",
      ProductName: "IntentHour",
    },
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        name: "IntentHour",
        authors: "Yates3",
        description: "IntentHour",
        noMsi: true,
        nuspecTemplate: path.join(
          __dirname,
          "desktop",
          "packaging",
          "template.nuspectemplate",
        ),
        setupExe: `IntentHour-Setup-${version}.exe`,
        setupIcon: desktopIcon,
      },
    },
  ],
};
