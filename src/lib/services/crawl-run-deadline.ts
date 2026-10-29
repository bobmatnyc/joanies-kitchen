/**
 * Crawl-run time budget (#6). A Vercel function killed at `maxDuration` never
 * reaches its `finally`, so the run must stop and finalize on its own clock
 * before the platform limit.
 */

/** The cron route's `maxDuration` in ms. Must equal `maxDuration` in the route file. */
export const CRON_FUNCTION_LIMIT_MS = 300 * 1000;

/** Time reserved after the deadline for the ledger SUM and the finalize UPDATE. */
export const FINALIZE_SAFETY_MARGIN_MS = 30 * 1000;

/** Sentinel a deadline race resolves to when the budget runs out first. */
export const DEADLINE_HIT: unique symbol = Symbol('crawl-run-deadline');

/** Epoch ms at which a run started at `startedAt` must stop work and finalize. */
export function crawlRunDeadline(
  startedAt: number,
  limitMs: number = CRON_FUNCTION_LIMIT_MS,
  marginMs: number = FINALIZE_SAFETY_MARGIN_MS
): number {
  if (!(limitMs > marginMs) || marginMs < 0) {
    throw new RangeError(
      `crawlRunDeadline: need limitMs > marginMs >= 0, got ${limitMs}/${marginMs}`
    );
  }
  return startedAt + limitMs - marginMs;
}

/**
 * Why: an in-flight extraction can outlast the function limit; awaiting it
 * would let the platform kill the run before finalize.
 * What: Resolves to `work`'s value, or to `DEADLINE_HIT` once `deadlineAt`
 * (epoch ms) passes, whichever is first. A rejection of `work` before the
 * deadline propagates. `deadlineAt` undefined means no deadline.
 * Test: `a run that hits the deadline mid-crawl is finalized partial with item counters and ledger cost`
 */
export async function raceDeadline<T>(
  work: Promise<T>,
  deadlineAt: number | undefined
): Promise<T | typeof DEADLINE_HIT> {
  if (deadlineAt === undefined) return work;
  // An abandoned `work` that rejects later must not surface as an unhandled rejection.
  work.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hit = new Promise<typeof DEADLINE_HIT>((resolve) => {
    timer = setTimeout(() => resolve(DEADLINE_HIT), Math.max(0, deadlineAt - Date.now()));
  });
  try {
    return await Promise.race([work, hit]);
  } finally {
    clearTimeout(timer);
  }
}
