// Gate invariant validator for ranked board rows against the sealed snapshot.
const IMPLIED_MAX = 1e14;
const cmpSlug = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export interface ValidatableRow {
  slug: string;
  rank: number;
  token_status: string;
  implied_value_usd: number;
  implied_p10_usd: number;
  implied_p25_usd: number;
  implied_p75_usd: number;
  implied_p90_usd: number;
  rank_low: number;
  rank_high: number;
  farm_steps: unknown[];
}

export interface SnapshotRef {
  protocols: Array<{ slug: string }>;
  watchlist: string[];
}

/** Fail-fast board & gate invariant check; returns null if valid, else an error string naming the offending row. */
export function validateBoard(rows: ValidatableRow[], snapshot: SnapshotRef): string | null {
  if (!Array.isArray(rows) || rows.length < 100 || rows.length > 4000) return 'row count outside [100, 4000]';
  const snapSlugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (!r || typeof r.slug !== 'string' || !snapSlugs.has(r.slug)) return `row ${i + 1}: unknown slug`;
    if (seen.has(r.slug)) return `row ${r.slug}: duplicate slug`;
    seen.add(r.slug);
    if (r.rank !== i + 1) return `row ${r.slug}: rank ${r.rank} != ${i + 1}`;
    if (r.token_status !== 'pre-token') return `row ${r.slug}: token_status ${r.token_status}`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd < 1 || r.implied_value_usd > IMPLIED_MAX) {
      return `row ${r.slug}: invalid implied_value_usd ${r.implied_value_usd}`;
    }
    if (
      r.implied_p10_usd > r.implied_p25_usd ||
      r.implied_p25_usd > r.implied_value_usd ||
      r.implied_value_usd > r.implied_p75_usd ||
      r.implied_p75_usd > r.implied_p90_usd
    ) {
      return `row ${r.slug}: band order violation`;
    }
    if (r.rank_low > r.rank || r.rank > r.rank_high) return `row ${r.slug}: rank range violation`;
    if (i > 0) {
      const prev = rows[i - 1]!;
      if (prev.implied_value_usd < r.implied_value_usd || (prev.implied_value_usd === r.implied_value_usd && cmpSlug(prev.slug, r.slug) >= 0)) {
        return `row ${r.slug}: violates sorted_by_value after ${prev.slug}`;
      }
    }
    if (!Array.isArray(r.farm_steps) || r.farm_steps.length < 3 || r.farm_steps.length > 12) {
      return `row ${r.slug}: bad farm_steps count`;
    }
    for (let j = 0; j < r.farm_steps.length; j++) {
      const step = r.farm_steps[j];
      const len = typeof step === 'string' ? step.trim().length : 0;
      if (len < 20 || len > 600) return `row ${r.slug} step ${j + 1}: length ${len} outside [20, 600]`;
    }
  }
  if (rows[0]!.implied_value_usd === rows[rows.length - 1]!.implied_value_usd) return 'all implied values identical';
  for (const w of snapshot.watchlist) if (!seen.has(w)) return `missing watchlist slug: ${w}`;
  return null;
}
