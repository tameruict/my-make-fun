// Token Radar v4 build entrypoint (Node 22, standard library only).
// Reads snapshot.json, runs the fitted valuation & token-odds model + farm engine,
// writes board.json, data.js, dashboard/, screenshots/, and dossier.json.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBoard } from './lib/validate.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const requireHere = createRequire(import.meta.url);

const farmEngine = requireHere('./dashboard/farm.js');
(globalThis as { RadarFarm?: unknown }).RadarFarm = farmEngine;
const model = requireHere('./dashboard/model.js');

const PLAIN_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
const TEXT_MAX_BYTES = 65_536;
const BOARD_MAX_BYTES = 8_388_608;
const DASH_MAX_FILES = 400;
const DASH_MAX_BYTES = 4_194_304;
const SHOT_MAX_BYTES = 524_288;
const DOSSIER_MAX_BYTES = 1_572_864;

function fail(msg: string, code = 1): never {
  process.stderr.write(`token-radar-v4: ${msg}\n`);
  process.exit(code);
}

function getArg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : null;
}

function copyPlainDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    if (!statSync(src).isFile()) continue;
    if (!PLAIN_NAME.test(name)) fail(`invalid filename: ${src}`);
    copyFileSync(src, join(to, name));
    names.push(name);
  }
  return names;
}

const rawInput = getArg('input') ?? (existsSync('/input/snapshot.json') ? '/input/snapshot.json' : null);
if (!rawInput) fail('missing --input <snapshot.json>', 2);
const inputFile = rawInput.endsWith('.json') ? rawInput : join(rawInput, 'snapshot.json');
if (!existsSync(inputFile)) fail(`snapshot not found: ${inputFile}`, 2);

const outDir = getArg('output') ?? process.env.MAKEFUN_OUTPUT_DIR ?? (existsSync('/output') ? '/output' : null);
if (!outDir) fail('missing --output <dir> or MAKEFUN_OUTPUT_DIR', 2);

const snapshot = JSON.parse(readFileSync(inputFile, 'utf8'));
const { rows, radar } = model.buildRadar(snapshot);
if (radar.evidence?.farm) {
  radar.evidence.farm.farmer_participation_fraction = farmEngine.FARMER_PARTICIPATION;
}

const boardErr: string | null = validateBoard(rows, snapshot);
if (boardErr) fail(`board validation failed: ${boardErr}`);

const boardJson = `${JSON.stringify({ rows })}\n`;
if (Buffer.byteLength(boardJson, 'utf8') > BOARD_MAX_BYTES) fail('board.json exceeds 8 MiB');

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), boardJson);
writeFileSync(join(outDir, 'data.js'), `window.RADAR = ${JSON.stringify(radar)};\n`);

const dash = copyPlainDir(join(here, 'dashboard'), join(outDir, 'dashboard'));
const hasFullDash =
  dash.includes('index.html') &&
  dash.some((f) => f.endsWith('.css')) &&
  dash.some((f) => f.endsWith('.js'));

if (!hasFullDash) fail('dashboard/ must contain index.html, at least one .css file, and at least one .js file');
if (dash.length > DASH_MAX_FILES) fail(`dashboard/ exceeds ${DASH_MAX_FILES} files`);

let dashBytes = 0;
for (const f of dash) {
  const full = join(outDir, 'dashboard', f);
  dashBytes += statSync(full).size;
  if (/https?:\/\//i.test(readFileSync(full, 'utf8'))) fail(`dashboard/${f} contains forbidden URL`);
}
if (dashBytes > DASH_MAX_BYTES) fail(`dashboard/ is ${dashBytes} bytes (> ${DASH_MAX_BYTES})`);

const shots = copyPlainDir(join(here, 'screenshots'), join(outDir, 'screenshots'));
if (shots.length < 3 || shots.length > 4) fail(`screenshots/ must hold 3-4 images (found ${shots.length})`);
for (const s of shots) {
  const sz = statSync(join(outDir, 'screenshots', s)).size;
  if (sz > SHOT_MAX_BYTES) fail(`screenshots/${s} is ${sz} bytes (> ${SHOT_MAX_BYTES})`);
}

const dossier = buildDossier(outDir, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: { max: 4, max_bytes: SHOT_MAX_BYTES },
  dashboard: { max_files: DASH_MAX_FILES, max_bytes: DASH_MAX_BYTES }
});
if (dossier.byteLength > DOSSIER_MAX_BYTES) fail(`dossier.json is ${dossier.byteLength} bytes (> ${DOSSIER_MAX_BYTES})`);
writeFileSync(join(outDir, 'dossier.json'), dossier);

const valEv = radar.evidence.value_model;
const oddsEv = radar.evidence.token_odds;
process.stdout.write(
  `token-radar-v4: ${snapshot.protocols.length} protocols, ${rows.length} ranked ` +
  `(${radar.evidence.watchlist_covered} watchlist, ${radar.evidence.early_count} early, ${radar.evidence.off_list_count} off-list), ` +
  `${radar.evidence.comparable_count} comps, LOO x${valEv.loo_miss_fold} (med x${valEv.loo_med_fold}), ` +
  `WF x${valEv.wf_miss_fold} (med x${valEv.wf_med_fold}), odds Brier CV10 ${oddsEv.cv10_brier} / WF ${oddsEv.wf_brier}, ` +
  `dossier ${dossier.byteLength} bytes\n`
);
