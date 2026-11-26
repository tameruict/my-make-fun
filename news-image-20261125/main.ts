import { copyFileSync, chmodSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

function exportEntry(): void {
  const sourceImage = resolve(currentDir, "entry.png");
  if (!existsSync(sourceImage)) {
    throw new Error(`Source entry.png does not exist at ${sourceImage}`);
  }

  const destinationDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  if (!existsSync(destinationDir)) {
    mkdirSync(destinationDir, { recursive: true });
  }

  const destinationFile = join(destinationDir, "entry.png");
  copyFileSync(sourceImage, destinationFile);
  chmodSync(destinationFile, 0o644);
  console.log(`Exported ${sourceImage} to ${destinationFile} with mode 0644`);
}

exportEntry();

