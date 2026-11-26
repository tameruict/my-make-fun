import { copyFileSync, mkdirSync, chmodSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Destination directory configured via environment or default container path
const scriptDir = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

mkdirSync(outputDir, { recursive: true });

const sourcePath = resolve(scriptDir, "entry.png");
const targetPath = resolve(outputDir, "entry.png");

if (!existsSync(sourcePath)) {
  console.error(`Error: Source entry image not found at ${sourcePath}`);
  process.exit(1);
}

copyFileSync(sourcePath, targetPath);
chmodSync(targetPath, 0o644);

console.log(`Successfully generated and verified entrypoint image: ${targetPath}`);

