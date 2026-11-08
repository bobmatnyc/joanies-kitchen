/**
 * Per-stage timing for the daily recipe cron (#302).
 *
 * Why: Vercel runtime log lines carry no per-line timestamp and arrive out of
 * order, so the logs alone cannot show where a run's 270s goes. This module
 * measures each stage with a monotonic clock and writes self-contained lines.
 * What: `RunTiming` times discovery and the inter-URL delays, and runs each
 * URL in its own `UrlTimer` scope (AsyncLocalStorage, so no call signature
 * changes and an abandoned URL keeps writing to its own timer). It logs one
 * `url-timing` line per URL and sums the stages into the run totals.
 * `startTier`/`endTier`/`timeStage` time the extraction tiers, the structuring
 * step and the store inside that scope. Measurement only: every wrapped call
 * returns and throws exactly as it would unwrapped, and outside a scope each
 * helper only calls through.
 * Test: `src/lib/services/__tests__/ingestion-timing-302.test.ts`,
 * `src/lib/services/__tests__/run-accounting.test.ts` (#302 block)
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { IngestionRunResult, RunMetrics } from './autonomous-ingestion-store';
import { DEADLINE_HIT } from './crawl-run-deadline';

/** The clock every timing reads; tests replace `now` to get exact numbers. */
export const timingClock = { now: (): number => performance.now() };

export type TierName = 'firecrawl' | 'jina' | 'tavily';
type UrlStageKey = 'firecrawlMs' | 'jinaMs' | 'tavilyMs' | 'llmMs' | 'storeMs';
const URL_STAGES: readonly UrlStageKey[] = [
  'firecrawlMs',
  'jinaMs',
  'tavilyMs',
  'llmMs',
  'storeMs',
];

/**
 * Raw milliseconds one URL spent in each stage. A tier's time excludes the
 * structuring step it ran (`llmMs`), so the stages never overlap.
 */
export type StageTimings = Record<UrlStageKey, number> & { tiers: TierName[] };

/** Run totals, in whole ms; also returned in the cron JSON as `stageMs`. */
export interface RunStageMs {
  discoveryMs: number;
  firecrawlMs: number;
  jinaMs: number;
  tavilyMs: number;
  llmMs: number;
  storeMs: number;
  delayMs: number;
  urlTimed: number;
  /** Time inside URLs not in any stage above (dedup checks, chef lookup, item writes). */
  otherMs: number;
  runMs: number;
}

export function newStageTimings(): StageTimings {
  return { firecrawlMs: 0, jinaMs: 0, tavilyMs: 0, llmMs: 0, storeMs: 0, tiers: [] };
}

/** One URL's attempt: its stages and the outcome its run item recorded. */
export class UrlTimer {
  readonly stages = newStageTimings();
  readonly start = timingClock.now();
  /** The item outcome; `unrecorded` when no row was written (a dry-run store). */
  outcome = 'unrecorded';

  constructor(
    readonly url: string,
    readonly runStart: number
  ) {}
}

const urlScope = new AsyncLocalStorage<UrlTimer>();

/** The timer of the URL whose work is running, if any. */
export function currentUrlTimer(): UrlTimer | undefined {
  return urlScope.getStore();
}

/** Notes the item outcome on the current URL's timer, for its `url-timing` line. */
export function noteUrlOutcome(outcome: string): void {
  const ut = urlScope.getStore();
  if (ut) ut.outcome = outcome;
}

/**
 * Awaits `fn` and adds its elapsed ms to `key` of `stages` (default: the
 * current URL's). With no stages it only calls `fn`.
 */
export async function timeStage<T>(
  key: UrlStageKey,
  fn: () => Promise<T>,
  stages: StageTimings | undefined = urlScope.getStore()?.stages
): Promise<T> {
  if (!stages) return fn();
  const start = timingClock.now();
  try {
    return await fn();
  } finally {
    stages[key] += timingClock.now() - start;
  }
}

interface TierHandle {
  stages: StageTimings;
  tier: TierName;
  start: number;
  llmBefore: number;
}

/** Opens a tier's timer on the current URL; pair with `endTier` in the tier's `finally`. */
export function startTier(
  tier: TierName,
  stages: StageTimings | undefined = urlScope.getStore()?.stages
): TierHandle | null {
  if (!stages) return null;
  stages.tiers.push(tier);
  return { stages, tier, start: timingClock.now(), llmBefore: stages.llmMs };
}

/** Adds the tier's elapsed ms, less the structuring time it spent, to its stage. */
export function endTier(h: TierHandle | null): void {
  if (!h) return;
  const llmSpent = h.stages.llmMs - h.llmBefore;
  h.stages[`${h.tier}Ms`] += timingClock.now() - h.start - llmSpent;
}

/**
 * Host and path of a URL, never its query or fragment, which can carry
 * tokens (#302). An unparseable URL logs as `host=invalid`.
 */
export function urlHostPath(url: string): { host: string; path: string } {
  try {
    const u = new URL(url);
    return { host: u.host || 'none', path: u.pathname || '/' };
  } catch {
    return { host: 'invalid', path: '-' };
  }
}

export class RunTiming {
  private readonly start = timingClock.now();
  private discoveryMs = 0;
  private delayMs = 0;
  private otherMs = 0;
  private urlTimed = 0;
  private readonly sums: Record<UrlStageKey, number> = {
    firecrawlMs: 0,
    jinaMs: 0,
    tavilyMs: 0,
    llmMs: 0,
    storeMs: 0,
  };

  /** Awaits `fn` and adds its elapsed ms to the run's discovery or delay total. */
  async time<T>(key: 'discoveryMs' | 'delayMs', fn: () => Promise<T>): Promise<T> {
    const start = timingClock.now();
    try {
      return await fn();
    } finally {
      this[key] += timingClock.now() - start;
    }
  }

  /**
   * Runs one URL's work in its own timer scope and logs its `url-timing` line
   * when `fn` settles. A `DEADLINE_HIT` result reads `outcome=abandoned`.
   */
  async timeUrl<T>(url: string, fn: () => Promise<T>): Promise<T> {
    const ut = new UrlTimer(url, this.start);
    let abandoned = false;
    try {
      const result = await urlScope.run(ut, fn);
      abandoned = result === DEADLINE_HIT;
      return result;
    } finally {
      this.endUrl(ut, abandoned);
    }
  }

  /**
   * Logs the URL's `url-timing` line and adds its stages to the run totals.
   * Values are rounded here, once, so the run sums equal the sum of the lines.
   */
  endUrl(ut: UrlTimer, abandoned: boolean): void {
    const totalMs = Math.round(timingClock.now() - ut.start);
    const ms = URL_STAGES.map((k) => [k, Math.max(0, Math.round(ut.stages[k]))] as const);
    const otherMs = Math.max(0, totalMs - ms.reduce((s, [, v]) => s + v, 0));
    for (const [k, v] of ms) this.sums[k] += v;
    this.otherMs += otherMs;
    this.urlTimed++;
    const { host, path } = urlHostPath(ut.url);
    console.log(
      `[AutonomousIngestion] url-timing host=${host} path=${path} ` +
        `outcome=${abandoned ? 'abandoned' : ut.outcome} ` +
        `startOffsetMs=${Math.round(ut.start - ut.runStart)} totalMs=${totalMs} ` +
        `${ms.map(([k, v]) => `${k}=${v}`).join(' ')} otherMs=${otherMs} ` +
        `tiers=${ut.stages.tiers.join(',') || 'none'}`
    );
  }

  totals(): RunStageMs {
    return {
      discoveryMs: Math.round(this.discoveryMs),
      ...this.sums,
      delayMs: Math.round(this.delayMs),
      urlTimed: this.urlTimed,
      otherMs: this.otherMs,
      runMs: Math.round(timingClock.now() - this.start),
    };
  }
}

/**
 * #300: the one `Completed —` summary line every run path writes. #302 appends
 * the stage totals after `dupUrls=`; no earlier field is renamed or moved.
 */
export function logRunCompleted(m: RunMetrics, result: IngestionRunResult): void {
  const s = result.stageMs;
  console.log(
    `[AutonomousIngestion] Completed — stored=${m.recipesStored}, extracted=${m.recipesExtracted}, ` +
      `skipped=${m.recipesSkipped}, errors=${m.errors.length}, status=${result.status}, ` +
      `stop=${result.stopReason}, nonRecipe=${m.nonRecipeSkipped}, dupUrls=${m.urlsDeduped}` +
      (s
        ? `, discoveryMs=${s.discoveryMs}, firecrawlMs=${s.firecrawlMs}, jinaMs=${s.jinaMs}, ` +
          `tavilyMs=${s.tavilyMs}, llmMs=${s.llmMs}, storeMs=${s.storeMs}, delayMs=${s.delayMs}, ` +
          `urlTimed=${s.urlTimed}, otherMs=${s.otherMs}, runMs=${s.runMs}`
        : '')
  );
}
