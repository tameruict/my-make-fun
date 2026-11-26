// Second-turn revision: strengthens verifyHearthAndSkewerDeliverables pre-flight
// with index.html size, total game/ byte cap, and game/ path length guards.
import { cpSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const EXPECTED_SCREENSHOTS = [
  '1-service-rush.jpg',
  '2-prep-chop.jpg',
  '3-combo-rush.jpg',
  '4-shift-end.jpg',
] as const;

const EXPECTED_GAME_FILES = [
  'index.html',
  'src/main.js',
  'src/config.js',
  'src/random.js',
  'src/recipes.js',
  'src/kitchen.js',
  'src/orders.js',
  'src/chef.js',
  'src/audio.js',
  'src/render.js',
  'src/shots.js',
] as const;

const MAX_SCREENSHOT_BYTES = 262144;
const MAX_INDEX_HTML_BYTES = 1048576;
const MAX_GAME_TOTAL_BYTES = 50331648;
const MAX_GAME_PATH_BYTES = 1000;
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: MAX_SCREENSHOT_BYTES },
  game_max_files: 993,
  game_max_bytes: MAX_GAME_TOTAL_BYTES,
  game_path_max_bytes: MAX_GAME_PATH_BYTES,
} as const;

function hasPngOrJpegMagic(bytes: Uint8Array): boolean {
  const isPng =
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isJpeg =
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff;
  return isPng || isJpeg;
}

function inspectTreeForSymlinksAndSize(
  dirPath: string,
  labelPrefix: string,
  relPrefix = '',
  checkGameCaps = false,
): number {
  let totalBytes = 0;
  const entries = readdirSync(dirPath, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const relLabel = `${labelPrefix}/${entry.name}`;
    const relGamePath = relPrefix === '' ? entry.name : `${relPrefix}/${entry.name}`;
    if (checkGameCaps) {
      const pathBytes = Buffer.byteLength(relGamePath, 'utf8');
      if (pathBytes > MAX_GAME_PATH_BYTES) {
        throw new Error(
          `Hearth & Skewer pre-flight failed: game/${relGamePath} path length ${pathBytes} bytes exceeds ${MAX_GAME_PATH_BYTES}`,
        );
      }
    }
    const stat = lstatSync(fullPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Hearth & Skewer pre-flight failed: symlink disallowed at ${relLabel}`);
    }
    if (stat.isDirectory()) {
      totalBytes += inspectTreeForSymlinksAndSize(fullPath, relLabel, relGamePath, checkGameCaps);
    } else if (stat.isFile()) {
      totalBytes += stat.size;
    } else {
      throw new Error(`Hearth & Skewer pre-flight failed: special file disallowed at ${relLabel}`);
    }
  }
  return totalBytes;
}

export function verifyHearthAndSkewerDeliverables(outDir: string): void {
  const gameDir = join(outDir, 'game');
  const screenshotsDir = join(outDir, 'screenshots');

  const totalGameBytes = inspectTreeForSymlinksAndSize(gameDir, 'game', '', true);
  if (totalGameBytes > MAX_GAME_TOTAL_BYTES) {
    throw new Error(
      `Hearth & Skewer pre-flight failed: total bytes under game/ is ${totalGameBytes} bytes (max ${MAX_GAME_TOTAL_BYTES})`,
    );
  }
  inspectTreeForSymlinksAndSize(screenshotsDir, 'screenshots', '', false);

  const indexPath = join(gameDir, 'index.html');
  let indexStat;
  try {
    indexStat = lstatSync(indexPath);
  } catch {
    throw new Error('Hearth & Skewer pre-flight failed: missing game/index.html');
  }
  if (!indexStat.isFile()) {
    throw new Error('Hearth & Skewer pre-flight failed: game/index.html must be a regular file');
  }
  if (indexStat.size > MAX_INDEX_HTML_BYTES) {
    throw new Error(
      `Hearth & Skewer pre-flight failed: game/index.html is ${indexStat.size} bytes (max ${MAX_INDEX_HTML_BYTES})`,
    );
  }

  for (const relPath of EXPECTED_GAME_FILES) {
    const fullPath = join(gameDir, relPath);
    let stat;
    try {
      stat = lstatSync(fullPath);
    } catch {
      throw new Error(`Hearth & Skewer pre-flight failed: missing game file game/${relPath}`);
    }
    if (!stat.isFile()) {
      throw new Error(`Hearth & Skewer pre-flight failed: game/${relPath} must be a regular file`);
    }
  }

  for (const shotName of EXPECTED_SCREENSHOTS) {
    const shotPath = join(screenshotsDir, shotName);
    let stat;
    try {
      stat = lstatSync(shotPath);
    } catch {
      throw new Error(`Hearth & Skewer pre-flight failed: missing screenshot screenshots/${shotName}`);
    }
    if (!stat.isFile()) {
      throw new Error(`Hearth & Skewer pre-flight failed: screenshots/${shotName} must be a regular file`);
    }
    if (stat.size <= 0 || stat.size > MAX_SCREENSHOT_BYTES) {
      throw new Error(
        `Hearth & Skewer pre-flight failed: screenshots/${shotName} is ${stat.size} bytes (allowed 1..${MAX_SCREENSHOT_BYTES})`,
      );
    }
    const raw = readFileSync(shotPath);
    if (!hasPngOrJpegMagic(raw)) {
      throw new Error(
        `Hearth & Skewer pre-flight failed: screenshots/${shotName} does not start with valid PNG or JPEG magic bytes`,
      );
    }
  }
}

function handInEntry(): void {
  const repoRoot = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  mkdirSync(outDir, { recursive: true });
  rmSync(join(outDir, 'game'), { recursive: true, force: true });
  rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
  rmSync(join(outDir, 'dossier.json'), { force: true });

  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

  verifyHearthAndSkewerDeliverables(outDir);

  const dossierBytes = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossierBytes);
}

handInEntry();
