import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const EXPECTED_SCREENSHOTS = [
  '1-patrol-flight.jpg',
  '2-ridge-survey.jpg',
  '3-rescue-approach.jpg',
  '4-sortie-end.jpg'
];

const EXPECTED_GAME_FILES = [
  'index.html',
  'src/main.js',
  'src/config.js',
  'src/random.js',
  'src/terrain.js',
  'src/aircraft.js',
  'src/missions.js',
  'src/camera.js',
  'src/hud.js',
  'src/audio.js',
  'src/render.js',
  'src/shots.js'
];

const SCREENSHOT_BYTE_CAP = 262144;
const INDEX_HTML_BYTE_CAP = 1024 * 1024;
const GAME_MAX_ENTRIES = 993;
const GAME_TOTAL_BYTE_CAP = 48 * 1024 * 1024;
const GAME_PATH_BYTE_CAP = 1000;
const SCREENSHOT_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  resetOutput(OUTPUT_DIR);

  const gameSource = join(REPO_ROOT, 'game');
  if (!existsSync(gameSource)) {
    throw new Error(`main.ts: no game/ directory at ${gameSource}`);
  }
  cpSync(gameSource, join(OUTPUT_DIR, 'game'), { recursive: true });

  const screenshotSource = join(REPO_ROOT, 'screenshots');
  if (existsSync(screenshotSource)) {
    cpSync(screenshotSource, join(OUTPUT_DIR, 'screenshots'), { recursive: true });
  }

  verifyRidgelinePatrolDeliverables(OUTPUT_DIR);

  const dossier = buildDossier(OUTPUT_DIR, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: SCREENSHOT_BYTE_CAP },
    game_max_files: 993,
    game_max_bytes: GAME_TOTAL_BYTE_CAP,
    game_path_max_bytes: 1000
  });
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossier);
  process.stdout.write(`main.ts: wrote ${join(OUTPUT_DIR, 'dossier.json')} (${dossier.length} bytes)\n`);
}

export function verifyRidgelinePatrolDeliverables(outDir) {
  const problems = [];
  const screenshotDir = join(outDir, 'screenshots');

  if (!existsSync(screenshotDir)) {
    problems.push('screenshots/: directory is missing');
  } else if (!lstatSync(screenshotDir).isDirectory()) {
    problems.push('screenshots/: not a directory');
  } else {
    const presentShots = readdirSync(screenshotDir)
      .filter((entry) => !entry.startsWith('.'))
      .sort();
    if (presentShots.length < 3 || presentShots.length > 4) {
      problems.push(`screenshots/: expected 3-4 images, found ${presentShots.length}`);
    }
    for (const entry of presentShots) {
      if (!SCREENSHOT_NAME_RE.test(entry)) {
        problems.push(`screenshots/${entry}: invalid screenshot filename`);
      }
      if (!EXPECTED_SCREENSHOTS.includes(entry)) {
        problems.push(`screenshots/${entry}: unexpected extra screenshot file`);
      }
    }
  }

  for (const name of EXPECTED_SCREENSHOTS) {
    const full = join(screenshotDir, name);
    const label = `screenshots/${name}`;
    if (!existsSync(full)) {
      problems.push(`${label}: missing screenshot file`);
      continue;
    }
    const info = lstatSync(full);
    if (info.isSymbolicLink() || !info.isFile()) {
      problems.push(`${label}: not a regular file`);
      continue;
    }
    if (info.size === 0) {
      problems.push(`${label}: empty screenshot file (0 bytes)`);
      continue;
    }
    if (info.size > SCREENSHOT_BYTE_CAP) {
      problems.push(`${label}: ${info.size} bytes exceeds the ${SCREENSHOT_BYTE_CAP}-byte cap`);
    }
    const head = readFileSync(full).subarray(0, 8);
    if (!matchesMagic(head, PNG_MAGIC) && !matchesMagic(head, JPEG_MAGIC)) {
      problems.push(`${label}: not a PNG or JPEG by magic bytes`);
    }
  }

  const gameDir = join(outDir, 'game');
  if (!existsSync(gameDir)) {
    problems.push('game/: directory is missing');
  } else if (!lstatSync(gameDir).isDirectory()) {
    problems.push('game/: not a directory');
  } else {
    for (const rel of EXPECTED_GAME_FILES) {
      const full = join(gameDir, rel);
      const label = `game/${rel}`;
      if (!existsSync(full)) {
        problems.push(`${label}: missing required game file`);
        continue;
      }
      const info = lstatSync(full);
      if (info.isSymbolicLink() || !info.isFile()) {
        problems.push(`${label}: not a regular file`);
      } else if (info.size === 0) {
        problems.push(`${label}: empty game file (0 bytes)`);
      }
    }

    const entries = walk(gameDir);
    if (entries.length > GAME_MAX_ENTRIES) {
      problems.push(`game/: ${entries.length} entries exceeds the ${GAME_MAX_ENTRIES}-entry cap`);
    }
    let total = 0;
    for (const entry of entries) {
      const pathBytes = Buffer.byteLength(entry, 'utf8');
      if (pathBytes > GAME_PATH_BYTE_CAP) {
        problems.push(`game/${entry}: path is ${pathBytes} bytes, over the ${GAME_PATH_BYTE_CAP}-byte cap`);
      }
      const full = join(gameDir, entry);
      const info = lstatSync(full);
      if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory())) {
        problems.push(`game/${entry}: symbolic link or special file is not allowed`);
        continue;
      }
      if (info.isFile()) total += info.size;
    }
    const indexFile = join(gameDir, 'index.html');
    if (existsSync(indexFile) && lstatSync(indexFile).isFile()) {
      const indexSize = statSync(indexFile).size;
      if (indexSize > INDEX_HTML_BYTE_CAP) {
        problems.push(`game/index.html: ${indexSize} bytes exceeds the ${INDEX_HTML_BYTE_CAP}-byte cap`);
      }
    }
    if (total > GAME_TOTAL_BYTE_CAP) {
      problems.push(`game/: ${total} bytes exceeds the ${GAME_TOTAL_BYTE_CAP}-byte cap`);
    }
  }

  if (problems.length > 0) {
    throw new Error(
      'Ridgeline Patrol deliverable check failed:\n  - ' + problems.join('\n  - ')
    );
  }
  return true;
}

function resetOutput(outDir) {
  rmSync(join(outDir, 'game'), { recursive: true, force: true });
  rmSync(join(outDir, 'screenshots'), { recursive: true, force: true });
  rmSync(join(outDir, 'dossier.json'), { force: true });
}

function matchesMagic(bytes, magic) {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i += 1) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
}

function walk(root) {
  const results = [];
  const stack = [''];
  while (stack.length > 0) {
    const current = stack.pop();
    const dir = current === '' ? root : join(root, current);
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const rel = current === '' ? entry.name : `${current}/${entry.name}`;
      results.push(rel);
      if (entry.isDirectory()) stack.push(rel);
    }
  }
  return results.sort();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
