import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateBoard } from '../lib/validate.ts';

const require = createRequire(import.meta.url);
const farmEngine = require('../dashboard/farm.js');
const model = require('../dashboard/model.js');
const REPO_ROOT = join(import.meta.dirname, '..');
const KIT_DIR = '/root/work/token-radar-kit3/token-radar-01-kit';
const SNAPSHOT_PATH = join(KIT_DIR, 'input/snapshot.json');
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));

function runLegacyEbModel(snap) {
  const DAY = 86400000;
  const EXCL_COMP = new Set(['CEX', 'Bridge', 'Canonical Bridge']);
  const EXCL_EARLY = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
  const WRAPPED_RE = /\b(wrapped|staked|staking)\b/i;
  const VER_V1_RE = /\s(?:[vV][2-9](?:\.\d+)?|[2-9]\.\d+)$/;
  const EXCH_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const round4 = (v) => Math.round(v * 1e4) / 1e4;
  const cmpSlug = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  const quantile = (sorted, q) => {
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  const median = (vals) => {
    const s = vals.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const cleanName = (n) => !WRAPPED_RE.test(n) && !VER_V1_RE.test(n) && !EXCH_RE.test(n);
  const preToken = (p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;

  const comps = snap.protocols.filter((p) =>
    typeof p.mcap_usd === 'number' && p.mcap_usd > 0 &&
    typeof p.tvl_usd === 'number' && p.tvl_usd > 0 &&
    !EXCL_COMP.has(p.category) && cleanName(p.name)
  );
  const rawSorted = comps.map((p) => p.mcap_usd / p.tvl_usd).sort((a, b) => a - b);
  const p05 = quantile(rawSorted, 0.05), p90 = quantile(rawSorted, 0.90);
  const winsor = comps.map((p) => ({ p, w: clamp(p.mcap_usd / p.tvl_usd, p05, p90) }));
  const globalMed = median(winsor.map((e) => e.w));

  const byCat = new Map();
  for (const e of winsor) if (e.p.category) {
    if (!byCat.has(e.p.category)) byCat.set(e.p.category, []);
    byCat.get(e.p.category).push(e.w);
  }
  const effByCat = new Map();
  for (const [cat, vals] of byCat) {
    effByCat.set(cat, round4((vals.length * median(vals) + 3 * globalMed) / (vals.length + 3)));
  }

  const bySlug = new Map(snap.protocols.map((p) => [p.slug, p]));
  const chosen = new Map();
  for (const s of snap.watchlist) chosen.set(s, bySlug.get(s));
  for (const p of snap.protocols) {
    if (!chosen.has(p.slug) && preToken(p) && p.tvl_usd < snap.floor_usd && !EXCL_EARLY.has(p.category) && cleanName(p.name)) {
      chosen.set(p.slug, p);
    }
  }
  const asOfMs = Date.parse(snap.as_of + 'T00:00:00Z');
  const rows = [...chosen.values()].map((p) => {
    const mEff = p.category && effByCat.has(p.category) ? effByCat.get(p.category) : round4(globalMed);
    const growth = p.change_7d === null ? 1.0 : 1 + (clamp(p.change_7d, -50, 100) / 100) * 0.5;
    const age = p.listed_at ? Math.max(0, Math.floor((asOfMs - Date.parse(p.listed_at + 'T00:00:00Z')) / DAY)) : null;
    const maturity = age === null ? 0.75 : 0.65 + (Math.min(age, 1095) / 1095) * 0.35;
    const implied = clamp(Math.round(p.tvl_usd * mEff * growth * maturity), 1, 100000000000000);
    return { slug: p.slug, implied_value_usd: implied, mEff };
  }).sort((a, b) => b.implied_value_usd - a.implied_value_usd || cmpSlug(a.slug, b.slug));

  return { comps: comps.length, p05: round4(p05), p90: round4(p90), globalMed: round4(globalMed), effByCat, rows };
}

test('legacy EB regression check matches v1 golden values and snapshot facts', () => {
  const legacy = runLegacyEbModel(snapshot);
  assert.equal(legacy.comps, 103);
  assert.equal(legacy.p05, 0.008);
  assert.equal(legacy.p90, 2.1769);
  assert.equal(legacy.globalMed, 0.2042);
  assert.equal(legacy.effByCat.get('Risk Curators'), 0.6974);
  assert.equal(legacy.rows.length, 181);
  assert.deepEqual(
    legacy.rows.slice(0, 5).map((r) => [r.slug, r.implied_value_usd]),
    [
      ['steakhouse-financial', 1564406586],
      ['gauntlet', 931722616],
      ['nonce-capital', 226466447],
      ['usdd', 164108226],
      ['veda', 163434543]
    ]
  );
});

test('board shape, watchlist 40/40, 76 usable-cap comps, exact 5-factor decomposition, and same-category peers', () => {
  const { rows, radar } = model.buildRadar(snapshot);
  if (!globalThis.RadarFarm) {
    for (const r of rows) r.farm_steps = ['Step 1: test farm step one for ' + r.slug, 'Step 2: test farm step two for ' + r.slug, 'Step 3: test farm step three for ' + r.slug];
  }
  assert.equal(validateBoard(rows, snapshot), null);
  assert.equal(rows.length, 198);
  assert.equal(radar.evidence.watchlist_covered, 40);
  assert.equal(radar.evidence.watchlist_total, 40);
  assert.equal(radar.evidence.early_count, 138);
  assert.equal(radar.evidence.off_list_count, 20);
  assert.equal(radar.evidence.comparable_count, 76);
  assert.equal(radar.evidence.dated_comparable_count, 60);
  assert.equal(radar.evidence.value_model.raw92_check.n, 92);

  const exclCats = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);
  const offRows = rows.filter((r) => r.watchlist_tier === 'off-list-parent');
  assert.equal(offRows.length, 20);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    assert.equal(r.rank, i + 1);
    assert.equal(r.token_status, 'pre-token');
    assert.ok(r.token_odds > 0 && r.token_odds < 1);
    assert.ok(r.if_launches_usd >= r.implied_value_usd);
    assert.ok(r.implied_p10_usd <= r.implied_p25_usd && r.implied_p25_usd <= r.implied_value_usd);
    assert.ok(r.implied_value_usd <= r.implied_p75_usd && r.implied_p75_usd <= r.implied_p90_usd);
    assert.ok(r.rank_low >= 1 && r.rank_low <= r.rank && r.rank <= r.rank_high && r.rank_high <= rows.length);
    if (i > 0) {
      assert.ok(rows[i - 1].implied_value_usd >= r.implied_value_usd);
    }
    const prod = r.intercept_multiple * r.size_curve_factor * r.category_effect_factor * r.chains_factor * r.growth_factor;
    assert.ok(Math.abs(r.multiple_used - prod) <= Math.max(1e-3, r.multiple_used * 2e-3), `${r.slug}: factor product ${prod} != ${r.multiple_used}`);
    assert.ok(Math.abs(r.if_launches_usd - Math.round(r.tvl_usd * r.multiple_used)) <= 1, `${r.slug}: if_launches_usd ${r.if_launches_usd} != round(${r.tvl_usd} * ${r.multiple_used})`);
    for (const peer of r.same_cat_peers) {
      assert.equal(peer.category, r.category);
      assert.ok(!exclCats.has(peer.category));
    }
  }
});

test('EGM Step 2 acceptance numbers: 76 comps, 3-split value model, 3/5 structural odds, range honesty, and 9-group 758 ledger', () => {
  const { rows, radar } = model.buildRadar(snapshot);
  const { value_model: vm, token_odds: to, range_honesty: rh, integrity: ig } = radar.evidence;

  assert.equal(radar.evidence.comparable_count, 76);
  assert.equal(radar.evidence.dated_comparable_count, 60);
  assert.equal(vm.raw92_check.n, 92);

  // Exact 9-group 758-protocol ledger census
  assert.equal(radar.ledger.total, 758);
  const expectedLedger = {
    ranked_watchlist: 40,
    ranked_early: 138,
    ranked_offlist: 20,
    priced_comp: 76,
    bridge: 87,
    liquid_staking: 90,
    exchange: 56,
    versioned_wrapped: 83,
    token_no_usable_cap: 168
  };
  const actualLedger = Object.fromEntries(radar.ledger.groups.map((g) => [g.key, g.count]));
  assert.deepEqual(actualLedger, expectedLedger);
  const ledgerSum = radar.ledger.groups.reduce((s, g) => s + g.count, 0);
  assert.equal(ledgerSum, 758);
  assert.equal(radar.comparables.length, 76);

  // Value model EGM Step 2 acceptance numbers
  assert.equal(vm.terms_kept, 4);
  assert.equal(vm.terms_tested, 6);
  assert.ok(vm.wf_miss_fold <= 2.55, `wf_miss_fold ${vm.wf_miss_fold} > 2.55`);
  assert.ok(vm.wf_med_fold <= 2.00, `wf_med_fold ${vm.wf_med_fold} > 2.00`);
  assert.ok(vm.loo_miss_fold <= 2.95, `loo_miss_fold ${vm.loo_miss_fold} > 2.95`);
  assert.ok(vm.loo_med_fold <= 2.46, `loo_med_fold ${vm.loo_med_fold} > 2.46`);
  assert.ok(vm.sz5_geo_fold <= 2.85, `sz5_geo_fold ${vm.sz5_geo_fold} > 2.85`);
  assert.ok(vm.sz5_med_fold <= 2.25, `sz5_med_fold ${vm.sz5_med_fold} > 2.25`);

  // Check explicit 92-comp sensitivity row in value_terms table
  const r92Row = radar.evidence_tables.value_terms.find((r) => String(r.step) === '92');
  assert.ok(r92Row, 'value_terms must contain the 92-comp benchmark sensitivity row');
  assert.equal(r92Row.loo_geo_fold, 4.289);
  assert.equal(r92Row.wf_geo_fold, 4.389);

  // Token odds EGM Step 2 acceptance numbers
  assert.equal(to.terms_kept, 3);
  assert.equal(to.terms_tested, 5);
  assert.ok(to.cv10_brier <= 0.202, `cv10_brier ${to.cv10_brier} > 0.202`);
  assert.ok(to.wf_brier <= 0.221, `wf_brier ${to.wf_brier} > 0.221`);
  assert.ok(to.cv10_brier < to.cv10_base_brier);
  assert.ok(to.wf_brier < to.wf_base_brier);

  // Range honesty EGM Step 2 acceptance numbers
  assert.equal(rh.eval_n, 30);
  assert.equal(rh.p25_p75_pct, 56.7);
  assert.equal(rh.p10_p90_pct, 83.3);

  // Integrity strip checks
  assert.equal(ig.rows_count, rows.length);
  assert.equal(ig.ranks_contiguous, true);
  assert.equal(ig.values_non_increasing, true);
  assert.equal(ig.watchlist_complete, true);
  assert.equal(ig.ledger_sum, 758);
  const recomputedChecksum = model.fnv1aHex(rows.map((r) => `${r.rank}:${r.slug}:${r.implied_value_usd}`).join('|'));
  assert.equal(ig.board_checksum, recomputedChecksum);
});

test('Criterion 2 growth monotonicity: implied_value_usd(change_7d = +100) > implied_value_usd(change_7d = -50) for every board protocol', () => {
  const evalAtPreTokenGrowth = (gVal) => {
    const cloned = structuredClone(snapshot);
    for (const p of cloned.protocols) {
      if (model.isPreToken(p)) p.change_7d = gVal;
    }
    return new Map(model.buildRadar(cloned).rows.map((r) => [r.slug, r]));
  };
  const atMinus50 = evalAtPreTokenGrowth(-50);
  const atPlus100 = evalAtPreTokenGrowth(100);
  assert.equal(atMinus50.size, 198);
  assert.equal(atPlus100.size, 198);

  for (const [slug, rLo] of atMinus50) {
    const rHi = atPlus100.get(slug);
    assert.ok(rHi, `missing ${slug} at +100%`);
    assert.ok(rHi.if_launches_usd > rLo.if_launches_usd, `${slug}: if_launches_usd(${rHi.if_launches_usd}) not > (${rLo.if_launches_usd})`);
    assert.ok(rHi.implied_value_usd > rLo.implied_value_usd, `${slug}: implied_value_usd(${rHi.implied_value_usd}) not > (${rLo.implied_value_usd})`);
  }
});

test('Polymarket & top-board integrity: rank #1 is house-watchlist and polymarket-international is not inflated by rain 400.2x outlier', () => {
  const { rows } = model.buildRadar(snapshot);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].is_watchlist, true);
  assert.equal(rows[0].slug, 'steakhouse-financial');

  const poly = rows.find((r) => r.slug === 'polymarket-international');
  assert.ok(poly, 'polymarket-international must be present on board');
  assert.equal(poly.category_n, 0);
  assert.equal(poly.category_effect_factor, 1.0000);
});

test('RadarFarm integration hook overrides placeholder steps and updates verdict counts', () => {
  const prevFarm = globalThis.RadarFarm;
  globalThis.RadarFarm = {
    VERDICT_THRESHOLD_PER_HOUR: 25,
    planRow: (row) => ({
      farm_steps: [
        `Day 0: deposit $5,000 into ${row.name} ($0.50 gas, 15 min).`,
        `Day 14: execute qualifying swap on ${row.name} ($0.50 gas, 10 min).`,
        `Day 30: exit 50% position from ${row.name} ($0.50 gas, 10 min).`
      ],
      farm_summary: 'FARM · $5,000 · $1.50 gas · 30d',
      farm_verdict: row.rank <= 12 ? 'FARM' : 'SKIP',
      farm_capital_usd: 5000, farm_gas_usd: 1.5, farm_capital_charge_usd: 8.22,
      farm_total_cost_usd: 9.72, farm_expected_drop_usd: 40, net_usd: 30.28,
      farm_hours: 0.6, net_per_hour_usd: 50.47, farm_days: 30,
      farm_chain: 'Base', farm_gas_tier: 'B', farm_deposit_tiers: []
    })
  };
  try {
    const { radar } = model.buildRadar(snapshot);
    assert.equal(radar.evidence.farm.farm_engine_active, true);
    assert.equal(radar.evidence.farm.worth_farming_count, 12);
    assert.equal(radar.evidence.farm.skip_count, 186);
  } finally {
    if (prevFarm !== undefined) globalThis.RadarFarm = prevFarm;
    else delete globalThis.RadarFarm;
  }
});

test('main.ts runs deterministically (byte-identical board.json, data.js, dossier.json) and recomputes evidence from board.json', () => {
  const out1 = mkdtempSync(join(tmpdir(), 'tr-v4-out1-'));
  const out2 = mkdtempSync(join(tmpdir(), 'tr-v4-out2-'));
  try {
    execFileSync(process.execPath, ['main.ts', '--input', SNAPSHOT_PATH, '--output', out1], { cwd: REPO_ROOT });
    execFileSync(process.execPath, ['main.ts', '--input', SNAPSHOT_PATH, '--output', out2], { cwd: REPO_ROOT });

    const b1 = readFileSync(join(out1, 'board.json'));
    const b2 = readFileSync(join(out2, 'board.json'));
    const d1 = readFileSync(join(out1, 'data.js'));
    const d2 = readFileSync(join(out2, 'data.js'));
    const dos1 = readFileSync(join(out1, 'dossier.json'));
    const dos2 = readFileSync(join(out2, 'dossier.json'));

    assert.deepEqual(b1, b2);
    assert.deepEqual(d1, d2);
    assert.deepEqual(dos1, dos2);
    assert.ok(dos1.byteLength <= 900_000, `dossier ${dos1.byteLength} > 900000`);

    const parsedBoard = JSON.parse(b1.toString('utf8'));
    const parsedRadar = JSON.parse(d1.toString('utf8').replace(/^window\.RADAR\s*=\s*/, '').replace(/;\s*$/, ''));
    assert.equal(parsedBoard.rows.length, 198);
    assert.equal(parsedRadar.evidence.integrity.board_checksum, model.fnv1aHex(parsedBoard.rows.map((r) => `${r.rank}:${r.slug}:${r.implied_value_usd}`).join('|')));

    // Verify zero dossier text truncation and RadarFarm/RadarModel included
    const dosObj = JSON.parse(dos1.toString('utf8'));
    const dosTextBytes = Buffer.byteLength(dosObj.text, 'utf8');
    assert.ok(dosTextBytes <= 65_536, `dossier text ${dosTextBytes} > 65536`);
    assert.equal(dosObj.text.includes('[Cut at'), false, 'dossier text must not truncate any dashboard file');
    assert.equal(dosObj.text.includes('RadarFarm'), true, 'dossier text must include dashboard/farm.js');
    assert.equal(dosObj.text.includes('RadarModel'), true, 'dossier text must include dashboard/model.js');
  } finally {
    rmSync(out1, { recursive: true, force: true });
    rmSync(out2, { recursive: true, force: true });
  }
});

test('security, URL hygiene across dashboard/, farm.js <= 5,600B & model.js <= 23,500B budgets, and vendor check', () => {
  const vendorEntry = readFileSync(join(REPO_ROOT, 'vendor/makefun-board.ts'));
  const vendorKit = readFileSync(join(KIT_DIR, 'starter/vendor/makefun-board.ts'));
  assert.equal(
    createHash('sha256').update(vendorEntry).digest('hex'),
    createHash('sha256').update(vendorKit).digest('hex'),
    'vendor/makefun-board.ts must match kit byte-for-byte'
  );

  const modelSrc = readFileSync(join(REPO_ROOT, 'dashboard/model.js'), 'utf8');
  const mainSrc = readFileSync(join(REPO_ROOT, 'main.ts'), 'utf8');
  const farmSrc = readFileSync(join(REPO_ROOT, 'dashboard/farm.js'), 'utf8');
  assert.ok(Buffer.byteLength(modelSrc, 'utf8') <= 23_500, `model.js size ${Buffer.byteLength(modelSrc, 'utf8')} exceeds 23,500B budget`);
  assert.ok(Buffer.byteLength(farmSrc, 'utf8') <= 5_600, `farm.js size ${Buffer.byteLength(farmSrc, 'utf8')} exceeds 5,600B budget`);

  for (const [name, src] of [['dashboard/model.js', modelSrc], ['main.ts', mainSrc], ['dashboard/farm.js', farmSrc]]) {
    assert.equal(/\beval\s*\(/.test(src), false, `${name} must not call eval(`);
    assert.equal(/\bFunction\s*\(/.test(src), false, `${name} must not call Function(`);
    assert.equal(/\bvm\./.test(src), false, `${name} must not reference vm.`);
    assert.equal(/\bimport\s*\(/.test(src), false, `${name} must not call dynamic import(`);
  }
  for (const f of readdirSync(join(REPO_ROOT, 'dashboard'))) {
    const src = readFileSync(join(REPO_ROOT, 'dashboard', f), 'utf8');
    assert.equal(/https?:\/\//i.test(src), false, `dashboard/${f} must not contain http(s)://`);
    assert.equal(/process\.env/.test(src), false, `dashboard/${f} must not read process.env`);
  }
});

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

test('farm-engine recomputes every row, separated fees, P25 robustness, dead-payload removal, tier scaling, zero-tx hold, and unique plans', () => {
  assert.equal(farmEngine.IS_PLACEHOLDER, false);
  assert.equal(farmEngine.VERDICT_THRESHOLD_PER_HOUR, 25);
  assert.equal(farmEngine.FARMER_PARTICIPATION, 0.10);
  assert.equal(farmEngine.resolveAgeDays, undefined, 'dead resolveAgeDays export must be removed');

  globalThis.RadarFarm = farmEngine;
  const { rows, radar } = model.buildRadar(snapshot);
  assert.equal(validateBoard(rows, snapshot), null);
  assert.equal(radar.evidence.farm.farm_engine_active, true);
  assert.equal(radar.evidence.farm.farm_engine_placeholder, false);

  const tierTotals = { 1000: { F: 0, M: 0, S: 0 }, 5000: { F: 0, M: 0, S: 0 }, 25000: { F: 0, M: 0, S: 0 }, 100000: { F: 0, M: 0, S: 0 } };
  let defF = 0, defM = 0, defS = 0, robustCnt = 0;
  const top15Sigs = new Set();

  for (const r of rows) {
    assert.equal(r.farm_placeholder, false);
    assert.equal(r.farm_arithmetic, undefined, `${r.slug}: dead farm_arithmetic must be removed`);
    assert.equal(r.farm_deposit_usd, undefined, `${r.slug}: duplicate farm_deposit_usd must be removed`);
    assert.equal(r.farm_net_usd, undefined, `${r.slug}: duplicate farm_net_usd must be removed`);
    assert.equal(r.farm_net_per_hour_usd, undefined, `${r.slug}: duplicate farm_net_per_hour_usd must be removed`);

    assert.equal(r.farm_chain, (r.chains && r.chains[0]) || 'Ethereum');
    assert.equal(r.farm_gas_source, 'chain-schedule', `${r.slug}: expected explicit gas entry for ${r.farm_chain}`);
    assert.ok(r.farm_per_tx_gas_usd > 0);
    assert.ok(r.farm_hours > 0 && r.farm_days >= 28);
    assert.equal(r.farm_days, r.tvl_usd >= 1e8 ? 45 : 30);

    // Every hold step charges 0 tx, $0.00 gas, $0.00 fee; every step length in [20, 600].
    assert.ok(r.farm_steps.length >= 3 && r.farm_steps.length <= 12);
    const holdSteps = r.farm_steps.filter((s) => /\(Hold\):/.test(s));
    assert.equal(holdSteps.length, 1, `${r.slug}: must have explicit Hold step`);
    assert.ok(holdSteps[0].includes('0 tx = $0.00 gas, $0.00 fee'), `${r.slug}: hold step must charge 0 tx / $0.00`);
    assert.ok(r.farm_steps.some((s) => /^Day 0 /.test(s)), `${r.slug}: must include Day 0 step`);
    assert.ok(r.farm_steps.some((s) => /^Weekly x\d+/.test(s)), `${r.slug}: must include Weekly xN step`);

    // Exact arithmetic recomputation for separated fees + total cost + implied net/verdict.
    assert.equal(r.farm_gas_usd, round2(r.farm_pure_gas_usd + r.farm_fees_usd), `${r.slug}: farm_gas_usd = pureGas + fees`);
    const expCapCharge = round2((r.farm_counted_dollar_days * farmEngine.CAPITAL_CHARGE_RATE) / 365);
    assert.ok(Math.abs(r.farm_capital_charge_usd - expCapCharge) <= 0.01, `${r.slug}: cap charge`);
    const expTotalCost = round2(r.farm_pure_gas_usd + r.farm_fees_usd + r.farm_capital_charge_usd);
    assert.ok(Math.abs(r.farm_total_cost_usd - expTotalCost) <= 0.01, `${r.slug}: total cost`);
    assert.ok(Math.abs(r.farm_total_cost_usd - round2(r.farm_gas_usd + r.farm_capital_charge_usd)) <= 0.01, `${r.slug}: cost = gas + capCharge`);
    const expDrop = round2(farmEngine.DROP_SHARE * r.implied_value_usd * r.farm_dollar_days_share);
    assert.ok(Math.abs(r.farm_expected_drop_usd - expDrop) <= 0.01, `${r.slug}: expected drop`);
    const expNet = round2(r.farm_expected_drop_usd - r.farm_total_cost_usd);
    assert.ok(Math.abs(r.net_usd - expNet) <= 0.01, `${r.slug}: net`);
    const expNph = round2(r.net_usd / r.farm_hours);
    assert.ok(Math.abs(r.net_per_hour_usd - expNph) <= 0.01, `${r.slug}: net/hr`);
    const expVerdict = r.net_per_hour_usd >= 25 ? 'FARM' : (r.net_usd > 0 ? 'MARGINAL' : 'SKIP');
    assert.equal(r.farm_verdict, expVerdict, `${r.slug}: verdict mismatch`);

    // P25 stress test fields + verdict_p25 consistency + farm_robust === (net_p25_usd > 0).
    const expDropP25 = round2(farmEngine.DROP_SHARE * (r.implied_p25_usd || r.implied_value_usd) * r.farm_dollar_days_share);
    assert.ok(Math.abs(r.expected_drop_p25_usd - expDropP25) <= 0.01, `${r.slug}: expected drop P25`);
    const expNetP25 = round2(r.expected_drop_p25_usd - r.farm_total_cost_usd);
    assert.ok(Math.abs(r.net_p25_usd - expNetP25) <= 0.01, `${r.slug}: net P25`);
    const expNphP25 = round2(r.net_p25_usd / r.farm_hours);
    assert.ok(Math.abs(r.net_p25_per_hour_usd - expNphP25) <= 0.01, `${r.slug}: net/hr P25`);
    const expVerdictP25 = r.net_p25_per_hour_usd >= 25 ? 'FARM' : (r.net_p25_usd > 0 ? 'MARGINAL' : 'SKIP');
    assert.equal(r.verdict_p25, expVerdictP25, `${r.slug}: verdict_p25 mismatch`);
    assert.equal(r.farm_robust, r.net_p25_usd > 0, `${r.slug}: farm_robust mismatch`);
    if (r.farm_robust) robustCnt++;

    if (r.farm_verdict === 'FARM') defF++;
    else if (r.farm_verdict === 'MARGINAL') defM++;
    else defS++;

    // Every deposit tier quote recomputes and obeys verdict threshold.
    assert.equal(r.farm_deposit_tiers.length, 4);
    for (const q of r.farm_deposit_tiers) {
      const qCost = round2(q.gas_usd + q.fees_usd + q.capital_charge_usd);
      assert.ok(Math.abs(q.total_cost_usd - qCost) <= 0.01);
      const qNet = round2(q.expected_drop_usd - q.total_cost_usd);
      assert.ok(Math.abs(q.net_usd - qNet) <= 0.01);
      const qNph = round2(q.net_usd / q.hours);
      assert.ok(Math.abs(q.net_per_hour_usd - qNph) <= 0.01);
      const qV = q.net_per_hour_usd >= 25 ? 'FARM' : (q.net_usd > 0 ? 'MARGINAL' : 'SKIP');
      assert.equal(q.verdict, qV);
      tierTotals[q.capital_usd][q.verdict[0]]++;
    }

    if (r.rank <= 15) {
      top15Sigs.add(r.farm_steps.map((s) => s.replaceAll(r.name, '{N}')).join(' || '));
    }
  }

  assert.equal(top15Sigs.size, 15, 'top 15 rows must each have distinct farm steps');
  assert.equal(radar.evidence.farm.worth_farming_count, defF);
  assert.equal(radar.evidence.farm.marginal_count, defM);
  assert.equal(radar.evidence.farm.skip_count, defS);
  assert.equal(radar.evidence.farm.robust_count, robustCnt);
  assert.equal(defF + defM + defS, 198);

  // Monotonic FARM counts across increasing deposit tiers.
  assert.ok(tierTotals[1000].F <= tierTotals[5000].F);
  assert.ok(tierTotals[5000].F <= tierTotals[25000].F);
  assert.ok(tierTotals[25000].F <= tierTotals[100000].F);
});

test('farm-engine honors participation/season overrides without horizon cancellation', () => {
  const sample = {
    slug: 'sample-vault', name: 'Sample Vault', category: 'Risk Curators',
    chains: ['Base', 'Ethereum'], tvl_usd: 100_000_000, implied_value_usd: 15_000_000,
    age_days: 300, change_7d: 2.0, watchlist_tier: 'watchlist'
  };
  const p90 = farmEngine.computeFarmPlan(sample, { season_days: 90, farmer_participation: 0.10 });
  const p180 = farmEngine.computeFarmPlan(sample, { season_days: 180, farmer_participation: 0.10 });
  const p20pct = farmEngine.computeFarmPlan(sample, { season_days: 90, farmer_participation: 0.20 });

  assert.ok(Math.abs(p90.expectedDropUsd / 2 - p180.expectedDropUsd) <= 0.02, '180d season halves share vs 90d season');
  assert.ok(Math.abs(p90.expectedDropUsd / 2 - p20pct.expectedDropUsd) <= 0.02, '20% participation halves share vs 10%');
});

test('EGM 2.2: exit-step daysDeployed, 50% retained capital, horizon growth (30 < 45 < 60), and skip_tiers', () => {
  const { rows } = model.buildRadar(snapshot);
  const sampleRows = [
    rows[0], // steakhouse-financial (tvl >= 1e8, 5 steps)
    rows.find((r) => r.tvl_usd < 1e8 && r.farm_steps.length === 5),
    rows.find((r) => r.farm_steps.length === 4) // compact L1 4-step row
  ];
  for (const sr of sampleRows) {
    assert.ok(sr, 'sample row must exist');
    const p30 = farmEngine.computeFarmPlan(sr, { horizon_days: 30 });
    const p45 = farmEngine.computeFarmPlan(sr, { horizon_days: 45 });
    const p60 = farmEngine.computeFarmPlan(sr, { horizon_days: 60 });
    assert.equal(p30.stepDetails, undefined);
    assert.equal(p30.exitDaysDeployed, Math.round(30 * 0.5));
    assert.equal(p45.exitDaysDeployed, Math.round(45 * 0.5));
    assert.equal(p60.exitDaysDeployed, Math.round(60 * 0.5));
    assert.ok(p30.expectedDropUsd < p45.expectedDropUsd && p45.expectedDropUsd < p60.expectedDropUsd,
      `${sr.slug}: expected_drop_usd must grow 30 (${p30.expectedDropUsd}) < 45 (${p45.expectedDropUsd}) < 60 (${p60.expectedDropUsd})`);
    for (const st of [...p30.steps, ...p45.steps, ...p60.steps]) {
      assert.ok(st.trim().length >= 20 && st.trim().length <= 600);
    }
  }

  // Worked example from EGM review section 4 step 1
  const sh = farmEngine.computeFarmPlan({
    tvl_usd: 2753981495, implied_value_usd: 28150713, implied_p25_usd: 8575421,
    name: 'Steakhouse Financial', category: 'Risk Curators', chains: ['Base']
  });
  assert.equal(sh.steps.length, 5);
  assert.equal(sh.exitDaysDeployed, 23);
  assert.ok(sh.steps[4].includes('retaining $12,500'), `Step 5 must retain $12,500: ${sh.steps[4]}`);

  // skip_tiers & deposit_usd skip precomputeDepositTiers
  assert.equal(farmEngine.planRow(rows[0], { skip_tiers: true }).farm_deposit_tiers.length, 0);
  assert.equal(farmEngine.planRow(rows[0], { deposit_usd: 5000 }).farm_deposit_tiers.length, 0);
});

test('EGM 2.2: UMD loads cleanly under both Node require and a globalThis-only ESM context', () => {
  assert.equal(typeof farmEngine.planRow, 'function');
  assert.equal(typeof globalThis.RadarFarm.planRow, 'function');

  const farmSrc = readFileSync(join(REPO_ROOT, 'dashboard/farm.js'), 'utf8');
  const probe = `${farmSrc}\n;const p=globalThis.RadarFarm.planRow({slug:'t',name:'Test',category:'Dexs',chains:['Base'],tvl_usd:2e8,implied_value_usd:1e7,implied_p25_usd:5e6},{skip_tiers:true});process.stdout.write(JSON.stringify({hasMod:typeof module!=='undefined',ok:typeof globalThis.RadarFarm.planRow==='function',verdict:p.farm_verdict,robust:p.farm_robust,tiers:p.farm_deposit_tiers.length}));`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-'], { input: probe, encoding: 'utf8' });
  const res = JSON.parse(out);
  assert.equal(res.hasMod, false, 'module must be undefined in globalThis-only ESM check');
  assert.equal(res.ok, true);
  assert.ok(['FARM', 'MARGINAL', 'SKIP'].includes(res.verdict));
  assert.equal(typeof res.robust, 'boolean');
  assert.equal(res.tiers, 0);
});
