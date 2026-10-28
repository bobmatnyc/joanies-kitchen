// #6: display helpers for the crawl-monitor dashboard (S4).

/**
 * Names for the two cost figures a run can carry. `runTotal` is the run row's
 * `cost_usd`, summed in memory during the run (S2). `ledger` is the sum of
 * `crawl_cost_events` rows, which is lower when ledger writes failed.
 */
export const COST_LABELS = { runTotal: 'run total', ledger: 'ledger' } as const;

/** Rows per run-history page. Lives here so the server page can import it. */
export const RUNS_PAGE_SIZE = 25;

/** Shown wherever a value is unknown (null), as distinct from zero. */
export const MISSING = '—';

/** A count, or `MISSING` for null/undefined; 0 renders as "0". */
export function formatCount(n: number | null | undefined): string {
  return n == null ? MISSING : n.toLocaleString('en-US');
}

/** USD with 4 decimals below $1 (crawl calls cost fractions of a cent), else 2. */
export function formatUsd(n: number | null | undefined): string {
  if (n == null) return MISSING;
  const digits = n !== 0 && Math.abs(n) < 1 ? 4 : 2;
  return `$${n.toFixed(digits)}`;
}

/** UTC timestamp `YYYY-MM-DD HH:MM`, or `MISSING`. Server and client render alike. */
export function formatUtc(d: Date | string | null | undefined): string {
  if (d == null) return MISSING;
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return MISSING;
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** Whole minutes and seconds since `start`, e.g. "3m 07s". */
export function formatElapsed(start: Date | string | null, now: number): string {
  if (start == null) return MISSING;
  const ms = Math.max(0, now - new Date(start).getTime());
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
