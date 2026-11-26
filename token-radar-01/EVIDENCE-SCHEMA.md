# Token Radar v4 — Evidence & Data Schema (`EVIDENCE-SCHEMA.md`)

Locked contract between **Worker A2** (`dashboard/model.js` + `main.ts`), **Worker B2** (`dashboard/farm.js`), and **Worker C** (`dashboard/index.html` + `app.css` + `app.js`).

Outputs emitted by `main.ts`:
- `/output/board.json` — `{ rows: BoardRow[] }`
- `/output/data.js` — `window.RADAR = RadarPayload;` (written outside `dashboard/`)
- `/output/dossier.json` — canonical dossier via `vendor/makefun-board.ts` (`text_max_bytes: 65536`)

---

## 1. `BoardRow` (`board.json.rows` and `window.RADAR.rows`)

### 1.1 Identity, Snapshot & Census Fields (Owner: `dashboard/model.js`)
- `rank`: `number` (dense `1..N`, strictly non-rising `implied_value_usd`, tie-break `slug` ascending)
- `slug`, `name`, `category`, `chains`, `tvl_usd`, `change_7d`, `listed_at`, `age_days`
- `token_status`: `'pre-token'`
- `is_watchlist`: `boolean` (`40` rows)
- `watchlist_tier`: `'watchlist' | 'early' | 'off-list-parent'` (`40` / `138` / `20` = `198` rows)
- `off_list_reason`: `null | 'slug-prefix-sibling-has-token' | 'prefix-match-no-sibling'`
- `off_list_sibling`: `string` (optional)
- `parent_factor`: `number` (`1.0`, `0.5`, or `0.25`)

### 1.2 Valuation, Token Odds, Uncertainty & Peers (Owner: `dashboard/model.js`)
- `implied_value_usd`: `number` (`clamp(round(if_launches_usd * token_odds * parent_factor), 1, 1e14)`, safe integer)
- `if_launches_usd`: `number` (`clamp(round(tvl_usd * multiple_used), 1, 1e14)`, `|if_launches_usd - round(tvl_usd * multiple_used)| <= 1` for all 198 rows)
- `intercept_multiple` (alias `base_multiple`): `number` (`exp(beta_0)`, 4 decimals)
- `size_curve_factor`: `number` (`exp(beta_tvl * (log(tvl) - meanLogTvl))`, 4 decimals)
- `category_effect_factor`: `number` (`exp(beta_cat)`, 4 decimals; looked up via `valModel.nCont + valModel.catIdx.get(cat)`)
- `chains_factor` (alias `chain_effect_factor`): `number` (`exp(beta_chains * (log1p(chains.length) - meanCh))`, 4 decimals)
- `growth_factor`: `number` (`exp(gLog(p, activeOpts)) = 1 + 0.08 * tanh(clamp(change_7d, -50, 100) / 50)`, 4 decimals; strictly increasing in `change_7d`)
- `multiple_used`: `number` (`rN(exp(predictLogRatio(p)), 6)`, 6 decimals; equals `intercept_multiple * size_curve_factor * category_effect_factor * chains_factor * growth_factor` up to 4-decimal factor rounding)
- `category_n`: `number` (count of clean usable-cap comparables in exact `category`, `0` when none)
- `token_odds`: `number` (fitted structural peer probability in `(0, 1)` from `Years listed`, `Ridge category effects`, `log(1 + chain count)`, 4 decimals; excludes `change_7d`)
- `implied_p10_usd`, `implied_p25_usd`, `implied_p75_usd`, `implied_p90_usd`: bootstrap quantiles `[0.06, 0.25, 0.75, 0.94]` (`BOOT_B = 300`, `BOOT_SEED = 20261114`) scaled by `token_odds * parent_factor`
- `if_launches_p25_usd`, `if_launches_p75_usd`: bootstrap quantiles before `token_odds * parent_factor`
- `rank_low`, `rank_high`: min/max rank across `B=300` bootstrap refits
- `same_cat_peers`: `PeerRef[]` (up to 5 clean usable-cap comparables in exact `category` sorted by `tvl_usd` desc)

### 1.3 Farm Plan & Netted Verdict Fields (Owner: `dashboard/farm.js`)
Dual-environment UMD module (`globalThis.RadarFarm` and `module.exports`, `<= 5,600` B, zero `http(s)://`).
`main.ts` requires `./dashboard/farm.js` and binds `globalThis.RadarFarm = farmEngine`.
`model.js` calls `RadarFarm.planRow(row, { as_of, floor_usd })` and merges its returned fields (UI overrides pass `{ deposit_usd, horizon_days, drop_share, farmer_participation, skip_tiers: true }`, skipping `precomputeDepositTiers` when `deposit_usd` or `skip_tiers` is set):
- `farm_steps`: `string[]` (3-12 strings, 20-600 chars trimmed; dated per-protocol steps with $ cost & minutes, 0 tx / $0.00 on Hold, exit step retains 50% of `farm_capital_usd`)
- `farm_summary`: `string`
- `farm_verdict`: `'FARM' | 'MARGINAL' | 'SKIP'` (`FARM` if `net_per_hour_usd >= 25`, `MARGINAL` if `net_usd > 0`, else `SKIP`)
- `farm_capital_usd`: default TVL-tiered deposit capital in USD
- `farm_pure_gas_usd`: pure transaction gas total in USD (`sum(step.gas)`)
- `farm_fees_usd`: pure protocol/swap/mint/hedge fees total in USD (`sum(step.fee)`)
- `farm_gas_usd`: combined execution gas + protocol fees (`round2(farm_pure_gas_usd + farm_fees_usd)`)
- `farm_capital_charge_usd`: 2.0%/yr annualized capital charge over `farm_counted_dollar_days`
- `farm_total_cost_usd`: `round2(farm_pure_gas_usd + farm_fees_usd + farm_capital_charge_usd)` (`= round2(farm_gas_usd + farm_capital_charge_usd)`)
- `farm_expected_drop_usd`: `round2(drop_share * implied_value_usd * farm_dollar_days_share)`
- `net_usd`, `farm_hours`, `net_per_hour_usd`
- `expected_drop_p25_usd`: `round2(drop_share * (implied_p25_usd || implied_value_usd) * farm_dollar_days_share)` (P25 stress-test drop)
- `net_p25_usd`: `round2(expected_drop_p25_usd - farm_total_cost_usd)`
- `net_p25_per_hour_usd`: `farm_hours > 0 ? round2(net_p25_usd / farm_hours) : 0`
- `verdict_p25`: `'FARM' | 'MARGINAL' | 'SKIP'` (using `$25/h` threshold on `net_p25_per_hour_usd` and `net_p25_usd > 0`)
- `farm_robust`: `boolean` (`net_p25_usd > 0`)
- `farm_days`: active campaign horizon (`base_horizon = tvl_usd >= 1e8 ? 45 : 30`; supports `horizon_days` override `30 / 45 / 60`; step start days scale from `[0, 14, 21, 30, 45]` (5 steps) or `[0, 14, 21, 30]` (4 steps); exit step `daysDeployed = round(horizon_days * 0.5)`)
- `farm_counted_dollar_days`, `farm_dollar_days_share` (`counted_dollar_days / (participation * tvl_usd * denom_days)`, where `denom_days = opts.season_days || base_horizon` so longer `horizon_days` increases `expected_drop_usd` linearly)
- `farm_chain`, `farm_gas_tier`, `farm_per_tx_gas_usd`, `farm_gas_source`, `farm_deposit_tiers` (`[]` when `deposit_usd` or `skip_tiers` is passed), `farm_placeholder: false`
- Removed dead payload: `farm_arithmetic`, `stepDetails`, `resolveAgeDays`, and duplicate keys (`farm_deposit_usd`, `farm_net_usd`, `farm_net_per_hour_usd`).

---

## 2. `window.RADAR` (`data.js`)
- `as_of`, `floor_usd`, `rows`
- `ledger` (`total: 758`, 9 exhaustive groups summing to `758`: `ranked_watchlist: 40`, `ranked_early: 138`, `ranked_offlist: 20`, `priced_comp: 76`, `bridge: 87`, `liquid_staking: 90`, `exchange: 56`, `versioned_wrapped: 83`, `token_no_usable_cap: 168`)
- `evidence`:
  - `total_protocols: 758`, `ranked_count: 198`, `watchlist_covered: 40`, `watchlist_total: 40`, `early_count: 138`, `off_list_count: 20`, `comparable_count: 76`, `dated_comparable_count: 60`, `raw92_check`
  - `value_model`: `loo_miss_fold`, `loo_flat_fold`, `loo_med_fold`, `loo_flat_med_fold`, `wf_miss_fold`, `wf_flat_fold`, `wf_med_fold`, `wf_flat_med_fold`, `sz5_geo_fold`, `sz5_flat_geo_fold`, `sz5_med_fold`, `sz5_flat_med_fold`, `terms_kept: 4`, `terms_tested: 6`, `log_tvl_slope`, `ridge_lambda_cat: 6`, `bootstrap_draws: 300`, `raw92_check` (`n: 92`, `loo_geo_fold: 4.289`, `loo_med_fold: 3.349`, `wf_geo_fold: 4.389`, `wf_med_fold: 2.150`), `off_list_check`, `lambda_sensitivity`
  - `range_honesty`: `p25_p75_pct: 56.7`, `p25_p75_hits: 17`, `p10_p90_pct: 83.3`, `p10_p90_hits: 25`, `eval_n: 30`, `outer_quantiles: [0.06, 0.94]`
  - `token_odds`: `pool_n: 758`, `recorded_token_n: 416`, `base_rate: 0.5488`, `cv10_brier: 0.2011`, `cv10_base_brier: 0.2484`, `wf_brier: 0.2205`, `wf_base_brier: 0.3207`, `terms_kept: 3`, `terms_tested: 5`
  - `farm`: `worth_farming_count`, `marginal_count`, `skip_count`, `robust_count`, `verdict_threshold_per_hour`, `farm_engine_active`, `farm_engine_placeholder`, `farmer_participation_fraction`
  - `integrity`: `rows_count`, `ranks_contiguous`, `values_non_increasing`, `watchlist_complete`, `ledger_sum`, `board_checksum`
- `evidence_tables`: `{ value_terms, odds_terms, range_honesty_rows }` (`value_terms` includes Steps 0..6 plus Step `'92'` unfiltered 92-comparable benchmark sensitivity row)
- `benchmarks`, `comparables` (`76` clean usable-cap comparables), `snapshot_facts`
