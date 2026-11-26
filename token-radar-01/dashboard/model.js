// Token Launch Radar v4 model (EGM 2.1). Compacted form (terser -c -m, 1-space indent) to meet the 23,500 B budget; math, factors, exports and outputs identical to the pre-compaction revision. Full source in git history.
"use strict";

const {abs, exp, log, log1p, max, min, round, floor, ceil, tanh} = Math, DAY_MS = 864e5, IMPLIED_MAX = 1e14, LAM_CONT = .5, LAM_CAT = 6, OLAM_CONT = 2, OLAM_CAT = 8, BOOT_B = 300, BOOT_SEED = 20261114, Q10 = .06, Q25 = .25, Q75 = .75, Q90 = .94, EXCL_CATS = new Set([ "Bridge", "Canonical Bridge", "Liquid Staking", "Liquid Restaking", "Restaked BTC", "CEX" ]), BR_CATS = new Set([ "Bridge", "Canonical Bridge" ]), STK_CATS = new Set([ "Liquid Staking", "Liquid Restaking", "Restaked BTC" ]), WRAP_RE = /\b(wrapped|staked|staking)\b/i, VER_RE = /\s(?:V\d+(?:\.\d+)?|v\d+(?:\.\d+)?|\d+\.\d+)$/, EXCH_RE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i, clamp = (e, t, o) => e < t ? t : e > o ? o : e, cUsd = e => clamp(round(e), 1, IMPLIED_MAX), rN = (e, t) => {
 const o = 10 ** t;
 return round(e * o) / o;
}, cmpSlug = (e, t) => e < t ? -1 : e > t ? 1 : 0, sig = e => e > 30 ? 1 : e < -30 ? 0 : 1 / (1 + exp(-e)), avg = (e, t) => e.reduce((e, o) => e + t(o), 0) / e.length, zeros = e => new Array(e).fill(0), zMat = e => Array.from({
 length: e
}, () => zeros(e));

function quantile(e, t) {
 if (!e.length) return 0;
 const o = (e.length - 1) * t, l = floor(o), a = ceil(o);
 return e[l] + (e[a] - e[l]) * (o - l);
}

function median(e) {
 if (!e.length) return 0;
 const t = e.slice().sort((e, t) => e - t), o = floor(t.length / 2);
 return t.length % 2 ? t[o] : (t[o - 1] + t[o]) / 2;
}

function makePrng(e) {
 let t = e >>> 0;
 return () => {
  t = t + 1831565813 >>> 0;
  let e = Math.imul(t ^ t >>> 15, 1 | t);
  return e = e + Math.imul(e ^ e >>> 7, 61 | e) ^ e, ((e ^ e >>> 14) >>> 0) / 4294967296;
 };
}

function solveLinear(e, t) {
 const o = e.length, l = e.map((e, o) => e.concat([ t[o] ]));
 for (let e = 0; e < o; e++) {
  let t = e;
  for (let a = e + 1; a < o; a++) abs(l[a][e]) > abs(l[t][e]) && (t = a);
  [l[e], l[t]] = [ l[t], l[e] ];
  const a = l[e][e];
  if (!(abs(a) < 1e-12)) {
   for (let t = e; t <= o; t++) l[e][t] /= a;
   for (let t = 0; t < o; t++) {
    if (t === e || 0 === l[t][e]) continue;
    const a = l[t][e];
    for (let s = e; s <= o; s++) l[t][s] -= a * l[e][s];
   }
  }
 }
 return l.map(e => e[o]);
}

function dot(e, t) {
 let o = 0;
 for (let l = 0; l < e.length; l++) o += e[l] * t[l];
 return o;
}

function computeAgeDays(e, t) {
 if ("string" != typeof t) return null;
 const o = Date.parse(e + "T00:00:00Z"), l = Date.parse(t + "T00:00:00Z");
 return Number.isFinite(o) && Number.isFinite(l) ? max(0, floor((o - l) / DAY_MS)) : null;
}

const isPreToken = e => null === e.mcap_usd && null === e.gecko_id && null === e.symbol, isCleanName = e => !WRAP_RE.test(e) && !VER_RE.test(e) && !EXCH_RE.test(e), isUsableCap = e => "number" == typeof e.mcap_usd && e.mcap_usd >= 1e6 && e.mcap_usd / e.tvl_usd >= .005 && e.mcap_usd / e.tvl_usd <= 25, isRawComparable = e => "number" == typeof e.mcap_usd && e.mcap_usd > 0 && "number" == typeof e.tvl_usd && e.tvl_usd > 0 && !EXCL_CATS.has(e.category) && isCleanName(e.name), isCleanComparable = e => "number" == typeof e.tvl_usd && e.tvl_usd > 0 && isUsableCap(e) && !EXCL_CATS.has(e.category) && isCleanName(e.name), isPreTokenClean = e => isPreToken(e) && "number" == typeof e.tvl_usd && e.tvl_usd > 0 && !EXCL_CATS.has(e.category) && isCleanName(e.name), gLog = (e, t) => t && t.growth ? log(1 + .08 * tanh((null === e.change_7d ? 0 : clamp(e.change_7d, -50, 100)) / 50)) : 0;

function buildFeatureExtractor(e, t, o, l) {
 const a = avg(e, e => log(e.tvl_usd)), s = e.filter(e => null !== e.listed_at), r = s.length ? avg(s, e => computeAgeDays(t, e.listed_at) / 365) : l, n = avg(e, e => log1p(Array.isArray(e.chains) ? e.chains.length : 0)), i = [ "intercept" ];
 for (const e of [ "logTvl", "chains", "logTvlSq", "years", "ageLog" ]) o[e] && i.push(e);
 const d = new Map(i.map((e, t) => [ e, t ])), c = i.length, _ = o.cat ? [ ...new Set(e.map(e => e.category).filter(Boolean)) ].sort(cmpSlug) : [], u = new Map(_.map((e, t) => [ e, t ]));
 return {
  feats: e => {
   const l = log(e.tvl_usd) - a, s = computeAgeDays(t, e.listed_at), i = null === s ? r : s / 365, d = [ 1 ];
   o.logTvl && d.push(l), o.chains && d.push(log1p(Array.isArray(e.chains) ? e.chains.length : 0) - n), 
   o.logTvlSq && d.push(l * l), o.years && d.push(i - r), o.ageLog && d.push(log1p(i) - log1p(r));
   const c = zeros(_.length);
   return o.cat && e.category && u.has(e.category) && (c[u.get(e.category)] = 1), d.concat(c);
  },
  meanLT: a,
  meanYr: r,
  meanCh: n,
  keys: i,
  keyIdx: d,
  nCont: c,
  cats: _,
  catIdx: u,
  dim: c + _.length
 };
}

function fitValueModel(e, t, o, l = .5, a = 6) {
 const s = o || {}, r = buildFeatureExtractor(e, t, s, 1.5), n = zMat(r.dim), i = zeros(r.dim);
 for (const t of e) {
  const e = log(t.mcap_usd / t.tvl_usd) - gLog(t, s), o = r.feats(t);
  for (let t = 0; t < r.dim; t++) {
   i[t] += o[t] * e;
   for (let e = 0; e < r.dim; e++) n[t][e] += o[t] * o[e];
  }
 }
 for (let e = 1; e < r.nCont; e++) n[e][e] += l;
 for (let e = r.nCont; e < r.dim; e++) n[e][e] += a;
 const d = solveLinear(n, i);
 return {
  beta: d,
  meanLogTvl: r.meanLT,
  meanCh: r.meanCh,
  meanYr: r.meanYr,
  nCont: r.nCont,
  keyIdx: r.keyIdx,
  cats: r.cats,
  catIdx: r.catIdx,
  predictLogRatio: e => dot(r.feats(e), d) + gLog(e, s)
 };
}

function fitOddsModel(e, t, o) {
 const l = buildFeatureExtractor(e, t, o || {}, 2), a = zeros(l.dim);
 let s = 0;
 for (const t of e) isPreToken(t) || s++;
 a[0] = log((s + .5) / (e.length - s + .5));
 for (let t = 0; t < 22; t++) {
  const t = zMat(l.dim), o = zeros(l.dim);
  for (const s of e) {
   const e = isPreToken(s) ? 0 : 1, r = l.feats(s), n = sig(dot(r, a)), i = max(1e-6, n * (1 - n)), d = e - n;
   for (let e = 0; e < l.dim; e++) {
    o[e] += r[e] * d;
    for (let o = 0; o < l.dim; o++) t[e][o] += i * r[e] * r[o];
   }
  }
  for (let e = 1; e < l.nCont; e++) t[e][e] += 2, o[e] -= 2 * a[e];
  for (let e = l.nCont; e < l.dim; e++) t[e][e] += 8, o[e] -= 8 * a[e];
  const s = solveLinear(t, o);
  let r = 0;
  for (let e = 0; e < l.dim; e++) a[e] += s[e], r = max(r, abs(s[e]));
  if (r < 1e-6) break;
 }
 return {
  beta: a,
  predictProb: e => sig(dot(l.feats(e), a))
 };
}

function selectValueModel(e, t, o) {
 const l = (e, t) => e.listed_at.localeCompare(t.listed_at) || cmpSlug(e.slug, t.slug), a = e.filter(e => null !== e.listed_at).sort(l), s = floor(a.length / 2), r = e => {
  const t = e.map(e => abs(log(e.pred / e.actual))), o = t.slice().sort((e, t) => e - t);
  return {
   geo: rN(exp(avg(t, e => e)), 3),
   med: rN(exp(quantile(o, .5)), 3)
  };
 }, n = (e, o, a = .5, s = 6) => {
  const n = e.filter(e => null !== e.listed_at).sort(l), i = floor(n.length / 2), d = e.slice().sort((e, t) => t.tvl_usd - e.tvl_usd || cmpSlug(e.slug, t.slug)), c = e.map((l, r) => ({
   actual: l.mcap_usd,
   pred: l.tvl_usd * exp(fitValueModel(e.filter((e, t) => t !== r), t, o, a, s).predictLogRatio(l))
  })), _ = fitValueModel(n.slice(0, i), t, o, a, s), u = n.slice(i).map(e => ({
   actual: e.mcap_usd,
   pred: e.tvl_usd * exp(_.predictLogRatio(e))
  })), g = [];
  for (let e = 0; e < 5; e++) {
   const l = fitValueModel(d.filter((t, o) => o % 5 !== e), t, o, a, s);
   for (const t of d.filter((t, o) => o % 5 === e)) g.push({
    actual: t.mcap_usd,
    pred: t.tvl_usd * exp(l.predictLogRatio(t))
   });
  }
  const p = r(c), f = r(u), m = r(g);
  return {
   loo_geo_fold: p.geo,
   loo_med_fold: p.med,
   wf_geo_fold: f.geo,
   wf_med_fold: f.med,
   sz5_geo_fold: m.geo,
   sz5_med_fold: m.med
  };
 }, i = [ [ "logTvl", "log(TVL) size curve" ], [ "cat", "Ridge category effects (lambda=6)" ], [ "chains", "log(1 + chain count)" ], [ "growth", "7d TVL momentum (tanh-bounded)" ], [ "logTvlSq", "log(TVL)^2 curvature" ], [ "years", "Years listed" ] ];
 let d = {}, c = n(e, d), _ = 0;
 const u = {
  ...c
 }, g = [ {
  step: 0,
  term: "Intercept only (flat multiple)",
  decision: "BASELINE",
  reason: "Flat mcap/TVL baseline",
  ...c
 } ];
 i.forEach(([t, o], l) => {
  const a = n(e, {
   ...d,
   [t]: !0
  }), s = a.loo_geo_fold < c.loo_geo_fold && a.wf_geo_fold < c.wf_geo_fold, r = a.loo_med_fold < c.loo_med_fold && a.sz5_med_fold < c.sz5_med_fold && a.wf_geo_fold < u.wf_geo_fold && a.wf_med_fold < u.wf_med_fold, i = s || r;
  i && (d = {
   ...d,
   [t]: !0
  }, c = a, _++), g.push({
   step: l + 1,
   term: o,
   decision: i ? "KEEP" : "DROP",
   reason: i ? s ? "Lowers LOO & WF geo miss" : "Lowers LOO & 5F-Size med" : "Fails 3-split holdout test",
   ...a
  });
 });
 const p = Array.isArray(o) && o.length ? o : e, f = n(p, {
  logTvl: !0,
  cat: !0,
  chains: !0
 }), m = {
  n: p.length,
  ...f
 };
 g.push({
  step: "92",
  term: "92-comp unfiltered pool (mcap > 0)",
  decision: "CHECK",
  reason: "16 stub/outlier caps (<$1M)",
  ...f
 });
 const h = [ 2, 6, 12 ].map(t => ({
  lambda_cat: t,
  ...n(e, d, .5, t)
 }));
 return {
  activeOpts: d,
  baseline: u,
  best: c,
  termsKept: _,
  termsTested: i.length,
  table: g,
  raw92Check: m,
  fullModel: fitValueModel(e, t, d),
  dated: a,
  half: s,
  lambdaSens: h
 };
}

function selectOddsModel(e, t) {
 const o = e.slice().sort((e, t) => cmpSlug(e.slug, t.slug)), l = e.filter(e => null !== e.listed_at).sort((e, t) => e.listed_at.localeCompare(t.listed_at) || cmpSlug(e.slug, t.slug)), a = floor(l.length / 2), s = e => {
  let s = 0;
  for (let l = 0; l < 10; l++) {
   const a = fitOddsModel(o.filter((e, t) => t % 10 !== l), t, e);
   for (const e of o.filter((e, t) => t % 10 === l)) {
    const t = a.predictProb(e) - (isPreToken(e) ? 0 : 1);
    s += t * t;
   }
  }
  const r = fitOddsModel(l.slice(0, a), t, e), n = l.slice(a);
  let i = 0;
  for (const e of n) {
   const t = r.predictProb(e) - (isPreToken(e) ? 0 : 1);
   i += t * t;
  }
  return {
   cv10_brier: rN(s / o.length, 4),
   wf_brier: rN(i / n.length, 4)
  };
 }, r = [ [ "years", "Years listed" ], [ "cat", "Ridge category effects" ], [ "chains", "log(1 + chain count)" ], [ "logTvl", "log(TVL)" ], [ "ageLog", "log(1 + years listed) curvature" ] ];
 let n = {}, i = s(n), d = 0;
 const c = {
  ...i
 }, _ = [ {
  step: 0,
  term: "Base rate (intercept only)",
  decision: "BASELINE",
  reason: "Historical token share",
  ...i
 } ];
 r.forEach(([e, t], o) => {
  const l = s({
   ...n,
   [e]: !0
  }), a = l.cv10_brier < i.cv10_brier && l.wf_brier < i.wf_brier;
  a && (n = {
   ...n,
   [e]: !0
  }, i = l, d++), _.push({
   step: o + 1,
   term: t,
   decision: a ? "KEEP" : "DROP",
   reason: a ? "Lowers CV10 & WF Brier" : "Does not lower both Briers",
   ...l
  });
 });
 const u = e.filter(e => !isPreToken(e)).length;
 return {
  activeOpts: n,
  baseline: c,
  best: i,
  termsKept: d,
  termsTested: r.length,
  table: _,
  fullModel: fitOddsModel(o, t, n),
  recordedN: u,
  baseRate: rN(u / e.length, 4)
 };
}

function runBootstrapUncertainty(e, t, o, l, a) {
 const s = makePrng(a), r = e.map((t, a) => log(t.mcap_usd) - (log(t.tvl_usd) + fitValueModel(e.filter((e, t) => t !== a), o, l).predictLogRatio(t))), n = Array.from({
  length: 300
 }, () => fitValueModel(Array.from({
  length: e.length
 }, () => e[floor(s() * e.length)]), o, l));
 return {
  bands: t.map(e => {
   const t = n.map(t => e.tvl_usd * exp(t.predictLogRatio(e) + r[floor(s() * r.length)])).sort((e, t) => e - t);
   return {
    p10: quantile(t, Q10),
    p25: quantile(t, Q25),
    p75: quantile(t, Q75),
    p90: quantile(t, Q90)
   };
  }),
  bootModels: n
 };
}

function buildLedger(e, t, o) {
 const l = [ [ "ranked_watchlist", "Ranked watchlist (pre-token >= $50M)", "Watchlist recording no token" ], [ "ranked_early", "Ranked early (pre-token < $50M)", "Clean pre-token below floor" ], [ "ranked_offlist", "Ranked off-list (above-floor pre-token excluded by the house rule)", "Pre-token >= $50M TVL not on house watchlist; 0.5x/0.25x assumption" ], [ "priced_comp", "Priced comparables (usable mcap)", "Clean tokenized comps (mcap >= $1M, ratio 0.005x-25x)" ], [ "bridge", "Bridge / Canonical Bridge", "Excluded bridge categories" ], [ "liquid_staking", "Liquid Staking / Restaking / BTC", "Excluded staking categories" ], [ "exchange", "CEX / Exchange-prefixed", "Exchanges and branded products" ], [ "versioned_wrapped", "Versioned / Wrapped / Staked names", "Versioned or wrapped/staked names" ], [ "token_no_usable_cap", "Token recorded, no usable cap", "Token recorded, null/zero or unusable cap (<$1M stub or ratio outside 0.005x-25x)" ] ].map(([e, t, o]) => ({
  key: e,
  label: t,
  count: 0,
  share_pct: 0,
  description: o
 })), a = new Map(l.map(e => [ e.key, e ]));
 for (const l of e) a.get(t.has(l.slug) ? "ranked_watchlist" : isPreTokenClean(l) ? l.tvl_usd >= o ? "ranked_offlist" : "ranked_early" : isCleanComparable(l) ? "priced_comp" : BR_CATS.has(l.category) ? "bridge" : STK_CATS.has(l.category) ? "liquid_staking" : "CEX" === l.category || EXCH_RE.test(l.name) ? "exchange" : isCleanName(l.name) ? "token_no_usable_cap" : "versioned_wrapped").count++;
 for (const t of l) t.share_pct = rN(t.count / e.length * 100, 1);
 return {
  total: e.length,
  groups: l
 };
}

function fnv1aHex(e) {
 let t = 2166136261;
 for (let o = 0; o < e.length; o++) t ^= e.charCodeAt(o), t = Math.imul(t, 16777619);
 return (t >>> 0).toString(16).padStart(8, "0");
}

function buildRadar(e) {
 const t = e.as_of, o = e.floor_usd, l = e.protocols, a = new Set(e.watchlist), s = new Map(l.map(e => [ e.slug, e ])), r = (e, t) => t.tvl_usd - e.tvl_usd || cmpSlug(e.slug, t.slug), n = l.filter(isRawComparable), i = l.filter(isCleanComparable), d = selectValueModel(i, t, n), c = d.fullModel, _ = c.keyIdx.has("logTvl") ? c.beta[c.keyIdx.get("logTvl")] : 0, u = c.keyIdx.has("chains") ? c.beta[c.keyIdx.get("chains")] : 0, g = selectOddsModel(l, t), p = g.fullModel, f = d.dated.slice(0, d.half), m = d.dated.slice(d.half), h = runBootstrapUncertainty(f, m, t, d.activeOpts, 20261114);
 let b = 0, v = 0;
 for (let e = 0; e < m.length; e++) {
  const t = m[e].mcap_usd, o = h.bands[e];
  t >= o.p25 && t <= o.p75 && b++, t >= o.p10 && t <= o.p90 && v++;
 }
 const k = Object.create(null);
 for (const e of i) null !== e.category && (k[e.category] ||= []).push(e);
 const y = Object.create(null);
 for (const e of Object.keys(k).sort(cmpSlug)) {
  const t = k[e].slice().sort(r), o = c.catIdx.has(e) ? c.beta[c.nCont + c.catIdx.get(e)] : 0;
  y[e] = {
   n: t.length,
   raw_median_ratio: rN(median(t.map(e => e.mcap_usd / e.tvl_usd)), 4),
   ridge_effect: rN(exp(o), 4),
   effective_multiple_at_100m: rN(exp(c.beta[0] + _ * (log(1e8) - c.meanLogTvl) + o), 4),
   top3: t.slice(0, 3).map(e => e.slug),
   peers: t.slice(0, 5).map(e => ({
    slug: e.slug,
    name: e.name,
    category: e.category,
    tvl_usd: e.tvl_usd,
    mcap_usd: e.mcap_usd,
    ratio: rN(e.mcap_usd / e.tvl_usd, 4),
    listed_at: e.listed_at
   }))
  };
 }
 const w = new Map;
 for (const t of e.watchlist) {
  const e = s.get(t);
  e && w.set(t, e);
 }
 const C = l.filter(e => !w.has(e.slug) && isPreTokenClean(e) && e.tvl_usd < o).sort(r);
 for (const e of C) w.set(e.slug, e);
 const T = l.filter(e => !w.has(e.slug) && isPreTokenClean(e) && e.tvl_usd >= o).sort(r);
 for (const e of T) w.set(e.slug, e);
 const x = l.filter(e => !isPreToken(e)).map(e => e.slug), L = [ ...w.values() ], M = runBootstrapUncertainty(i, L, t, d.activeOpts, 20261115), R = rN(exp(c.beta[0]), 4), E = e => ({
  slug: e.slug,
  name: e.name,
  category: e.category,
  chains: e.chains.slice(),
  tvl_usd: e.tvl_usd,
  listed_at: e.listed_at
 }), A = L.map((e, l) => {
  const s = a.has(e.slug), r = s ? "watchlist" : e.tvl_usd >= o ? "off-list-parent" : "early", n = e.slug.split("-")[0], i = "off-list-parent" === r && n.length >= 4 ? x.filter(t => t !== e.slug && t.startsWith(n + "-")) : [], g = "off-list-parent" === r ? i.length ? .25 : .5 : 1, f = "off-list-parent" === r ? i.length ? "slug-prefix-sibling-has-token" : "prefix-match-no-sibling" : null, m = exp(c.predictLogRatio(e)), h = rN(m, 6), b = e.category && c.catIdx.has(e.category) ? c.beta[c.nCont + c.catIdx.get(e.category)] : 0, v = log1p(Array.isArray(e.chains) ? e.chains.length : 0) - c.meanCh, k = rN(exp(_ * (log(e.tvl_usd) - c.meanLogTvl)), 4), w = rN(exp(b), 4), C = rN(exp(u * v), 4), T = rN(exp(gLog(e, d.activeOpts)), 4), A = e.category ? y[e.category] : null, S = cUsd(e.tvl_usd * h), P = rN(p.predictProb(e), 4), N = cUsd(S * P * g), O = M.bands[l], I = cUsd(min(O.p25, S)), B = cUsd(max(O.p75, S)), z = clamp(min(round(I * P * g), N), 1, IMPLIED_MAX), D = clamp(max(round(B * P * g), N), 1, IMPLIED_MAX), V = {
   _idx: l,
   rank: 0,
   ...E(e),
   change_7d: e.change_7d,
   age_days: computeAgeDays(t, e.listed_at),
   token_status: "pre-token",
   is_watchlist: s,
   watchlist_tier: r,
   off_list_reason: f,
   parent_factor: g,
   implied_value_usd: N,
   if_launches_usd: S,
   intercept_multiple: R,
   base_multiple: R,
   size_curve_factor: k,
   category_effect_factor: w,
   chains_factor: C,
   chain_effect_factor: C,
   growth_factor: T,
   multiple_used: h,
   category_n: A ? A.n : 0,
   token_odds: P,
   implied_p10_usd: clamp(min(round(O.p10 * P * g), z), 1, IMPLIED_MAX),
   implied_p25_usd: z,
   implied_p75_usd: D,
   implied_p90_usd: clamp(max(round(O.p90 * P * g), D), 1, IMPLIED_MAX),
   if_launches_p25_usd: I,
   if_launches_p75_usd: B,
   rank_low: L.length,
   rank_high: 1,
   same_cat_peers: A ? A.peers : []
  };
  return i.length && (V.off_list_sibling = i.join(", ")), V;
 }), S = new Array(L.length).fill(L.length), P = new Array(L.length).fill(1);
 for (const e of M.bootModels) {
  const t = A.map((t, o) => ({
   i: o,
   slug: t.slug,
   val: round(t.tvl_usd * exp(e.predictLogRatio(t)) * t.token_odds * t.parent_factor)
  })).sort((e, t) => t.val - e.val || cmpSlug(e.slug, t.slug));
  for (let e = 0; e < t.length; e++) {
   const o = t[e].i, l = e + 1;
   l < S[o] && (S[o] = l), l > P[o] && (P[o] = l);
  }
 }
 A.sort((e, t) => t.implied_value_usd - e.implied_value_usd || cmpSlug(e.slug, t.slug));
 const N = "undefined" != typeof globalThis && globalThis.RadarFarm && "function" == typeof globalThis.RadarFarm.planRow ? globalThis.RadarFarm : null, O = {
  as_of: t,
  floor_usd: o
 };
 let I = 0, B = 0, z = 0, D = 0;
 for (let e = 0; e < A.length; e++) {
  const t = A[e], o = t._idx;
  delete t._idx, t.rank = e + 1, t.rank_low = min(t.rank, S[o]), t.rank_high = max(t.rank, P[o]), 
  N && Object.assign(t, N.planRow(t, O)), "FARM" === t.farm_verdict ? I++ : "MARGINAL" === t.farm_verdict ? B++ : z++, 
  t.farm_robust && D++;
 }
 const V = buildLedger(l, a, o), q = [], X = [], H = i.slice().sort(r).map(e => {
  const t = cUsd(e.tvl_usd * exp(c.predictLogRatio(e))), o = e.slug.split("-")[0];
  return (o.length >= 4 && x.some(t => t !== e.slug && t.startsWith(o + "-")) ? q : X).push(t / e.mcap_usd), 
  {
   ...E(e),
   mcap_usd: e.mcap_usd,
   ratio: rN(e.mcap_usd / e.tvl_usd, 4),
   fitted_if_launches_usd: t,
   residual_fold: rN(max(t / e.mcap_usd, e.mcap_usd / t), 2)
  };
 }), U = {
  total_protocols: l.length,
  ranked_count: A.length,
  watchlist_covered: A.filter(e => e.is_watchlist).length,
  watchlist_total: e.watchlist.length,
  early_count: C.length,
  off_list_count: T.length,
  comparable_count: i.length,
  dated_comparable_count: d.dated.length,
  raw92_check: d.raw92Check,
  value_model: {
   loo_miss_fold: d.best.loo_geo_fold,
   loo_flat_fold: d.baseline.loo_geo_fold,
   loo_med_fold: d.best.loo_med_fold,
   loo_flat_med_fold: d.baseline.loo_med_fold,
   wf_miss_fold: d.best.wf_geo_fold,
   wf_flat_fold: d.baseline.wf_geo_fold,
   wf_med_fold: d.best.wf_med_fold,
   wf_flat_med_fold: d.baseline.wf_med_fold,
   sz5_geo_fold: d.best.sz5_geo_fold,
   sz5_flat_geo_fold: d.baseline.sz5_geo_fold,
   sz5_med_fold: d.best.sz5_med_fold,
   sz5_flat_med_fold: d.baseline.sz5_med_fold,
   terms_kept: d.termsKept,
   terms_tested: d.termsTested,
   log_tvl_slope: rN(_, 4),
   ridge_lambda_cat: 6,
   bootstrap_draws: 300,
   raw92_check: d.raw92Check,
   off_list_check: {
    prefix_sib_n: q.length,
    prefix_sib_med_fit_act: rN(median(q), 3),
    standalone_med_fit_act: rN(median(X), 3),
    assumption_kept: .5
   },
   lambda_sensitivity: d.lambdaSens
  },
  range_honesty: {
   p25_p75_pct: rN(b / m.length * 100, 1),
   p25_p75_hits: b,
   p10_p90_pct: rN(v / m.length * 100, 1),
   p10_p90_hits: v,
   eval_n: m.length,
   outer_quantiles: [ Q10, Q90 ]
  },
  token_odds: {
   pool_n: l.length,
   recorded_token_n: g.recordedN,
   base_rate: g.baseRate,
   cv10_brier: g.best.cv10_brier,
   cv10_base_brier: g.baseline.cv10_brier,
   wf_brier: g.best.wf_brier,
   wf_base_brier: g.baseline.wf_brier,
   terms_kept: g.termsKept,
   terms_tested: g.termsTested
  },
  farm: {
   worth_farming_count: I,
   marginal_count: B,
   skip_count: z,
   robust_count: D,
   verdict_threshold_per_hour: N && N.VERDICT_THRESHOLD_PER_HOUR ? N.VERDICT_THRESHOLD_PER_HOUR : 25,
   farm_engine_active: Boolean(N),
   farm_engine_placeholder: Boolean(N && N.IS_PLACEHOLDER)
  },
  integrity: {
   rows_count: A.length,
   ranks_contiguous: A.every((e, t) => e.rank === t + 1),
   values_non_increasing: A.every((e, t) => 0 === t || A[t - 1].implied_value_usd >= e.implied_value_usd),
   watchlist_complete: A.filter(e => e.is_watchlist).length === e.watchlist.length,
   ledger_sum: V.groups.reduce((e, t) => e + t.count, 0),
   board_checksum: fnv1aHex(A.map(e => `${e.rank}:${e.slug}:${e.implied_value_usd}`).join("|"))
  }
 };
 return {
  rows: A,
  radar: {
   as_of: t,
   floor_usd: o,
   rows: A,
   evidence: U,
   ledger: V,
   evidence_tables: {
    value_terms: d.table,
    odds_terms: g.table,
    range_honesty_rows: [ {
     band: "P25-P75",
     target_pct: 50,
     observed_hits: b,
     observed_pct: U.range_honesty.p25_p75_pct,
     eval_n: m.length
    }, {
     band: "P10-P90",
     target_pct: 80,
     observed_hits: v,
     observed_pct: U.range_honesty.p10_p90_pct,
     eval_n: m.length
    } ]
   },
   benchmarks: y,
   comparables: H,
   snapshot_facts: {
    as_of: t,
    floor_usd: o,
    total_protocols: l.length,
    watchlist_count: e.watchlist.length,
    no_token_recorded_count: l.filter(isPreToken).length,
    clean_comparables_count: i.length,
    raw_comparables_count: n.length
   }
  }
 };
}

const RadarModel = {
 isPreToken,
 isCleanName,
 isUsableCap,
 isRawComparable,
 isCleanComparable,
 isPreTokenClean,
 gLog,
 computeAgeDays,
 buildRadar,
 fnv1aHex
};

"undefined" != typeof globalThis && (globalThis.RadarModel = RadarModel), "undefined" != typeof module && module.exports && (module.exports = RadarModel);