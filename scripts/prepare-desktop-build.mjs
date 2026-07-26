import { rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const desktopOutputs = [
  join(repositoryRoot, "dist", "desktop"),
  join(repositoryRoot, "dist", "desktop-renderer"),
];

for (const outputPath of desktopOutputs) {
  const relativePath = relative(repositoryRoot, outputPath).replaceAll("\\", "/");
  if (
    relativePath !== "dist/desktop" &&
    relativePath !== "dist/desktop-renderer"
  ) {
    throw new Error(`Refusing to clean unexpected path: ${outputPath}`);
  }
  await rm(outputPath, { recursive: true, force: true });
}
