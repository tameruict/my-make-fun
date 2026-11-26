// PALMERA KEYS: GOLDEN HOUR — gta6-01 ("Make GTA 6") competition entry
// 100% original-IP, 100% offline-only 3D coastal open-world action-driving & heist browser game.
// Copies game/ and screenshots/ to MAKEFUN_OUTPUT_DIR (or /output) and builds /output/dossier.json.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

const dossierBytes = buildDossier(out, CAPS);
writeFileSync(join(out, 'dossier.json'), dossierBytes);
console.log(`Palmera Keys: Golden Hour packaged to ${out} (dossier: ${dossierBytes.length} bytes)`);

