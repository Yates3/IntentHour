import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const publicDirectory = process.env.PUBLIC || process.env.TEMP;

if (!publicDirectory) {
  throw new Error("A Windows Public or temporary directory is required.");
}

await mkdir(publicDirectory, { recursive: true });
const packagingDirectory = await mkdtemp(
  join(publicDirectory, "IntentHour-Forge-"),
);
const stagingOutput = join(packagingDirectory, "out");
const stagingIcon = join(packagingDirectory, "intenthour.ico");
const forgeCli = join(
  repositoryRoot,
  "node_modules",
  "@electron-forge",
  "cli",
  "dist",
  "electron-forge.js",
);

try {
  await copyFile(
    join(repositoryRoot, "desktop", "assets", "intenthour.ico"),
    stagingIcon,
  );

  const child = spawn(
    process.execPath,
    [
      forgeCli,
      "make",
      "--platform=win32",
      "--arch=x64",
    ],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        INTENTHOUR_FORGE_ICON_PATH: stagingIcon,
        INTENTHOUR_FORGE_OUT_DIR: stagingOutput,
        TEMP: packagingDirectory,
        TMP: packagingDirectory,
      },
      stdio: "inherit",
      windowsHide: true,
    },
  );

  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
  } else {
    const releaseOutput = join(repositoryRoot, "out");
    const relativeOutput = relative(repositoryRoot, releaseOutput)
      .replaceAll("\\", "/");
    if (relativeOutput !== "out") {
      throw new Error(`Refusing to replace unexpected output: ${releaseOutput}`);
    }
    await rm(releaseOutput, { recursive: true, force: true });
    await cp(stagingOutput, releaseOutput, { recursive: true });

    const packageJson = JSON.parse(
      await readFile(join(repositoryRoot, "package.json"), "utf8"),
    );
    const releaseDirectory = join(
      releaseOutput,
      "make",
      "squirrel.windows",
      "x64",
    );
    const installerName =
      `IntentHour-Setup-${packageJson.version}.exe`;
    const installerPath = join(releaseDirectory, installerName);
    const installerHash = createHash("sha256")
      .update(await readFile(installerPath))
      .digest("hex")
      .toUpperCase();

    await copyFile(
      join(
        repositoryRoot,
        "desktop",
        "packaging",
        "RELEASE_NOTES.md",
      ),
      join(releaseDirectory, "RELEASE_NOTES.md"),
    );
    await writeFile(
      join(releaseDirectory, "SHA256SUMS.txt"),
      `${installerHash}  ${installerName}\n`,
      "utf8",
    );
  }
} finally {
  const resolvedPackagingDirectory = resolve(packagingDirectory);
  const resolvedPublicDirectory = resolve(publicDirectory);
  if (
    dirname(resolvedPackagingDirectory) === resolvedPublicDirectory &&
    resolvedPackagingDirectory.includes("IntentHour-Forge-")
  ) {
    await rm(resolvedPackagingDirectory, { recursive: true, force: true });
  }
}
