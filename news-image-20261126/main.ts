import { copyFileSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

const targetDirectory = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const sourceImage = join(import.meta.dirname, "entry.png");
const destinationImage = join(targetDirectory, "entry.png");

if (!existsSync(sourceImage)) {
  console.error(`Error: source entry.png missing at ${sourceImage}`);
  process.exit(1);
}

copyFileSync(sourceImage, destinationImage);
chmodSync(destinationImage, 0o644);
console.log(`Successfully copied entry.png to ${destinationImage} (mode 0644)`);
