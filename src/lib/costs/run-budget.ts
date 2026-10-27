/**
 * Per-run crawl budget (#6 S2). Every discovery run carries a finite, positive
 * USD budget; the run stops making paid calls once its in-memory spend
 * (`currentRunSpend()`) reaches it.
 */

/** Budget for a run when neither the caller nor `CRON_RUN_BUDGET_USD` sets one. */
export const DEFAULT_RUN_BUDGET_USD = 5;

/** Ceiling on any run budget; a larger request is clamped to it with a warning. */
export const MAX_RUN_BUDGET_USD = 100;

function usableBudget(value: unknown): number | null {
  const n = typeof value === 'string' ? (value.trim() === '' ? Number.NaN : Number(value)) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Why: tripbot.tours turned a missing budget into Infinity, so its runs never
 * tripped. A run here is never unbudgeted.
 * What: Returns the first finite, positive value of `param`, then `envValue`
 * (default `process.env.CRON_RUN_BUDGET_USD`), else `DEFAULT_RUN_BUDGET_USD`,
 * clamped to `MAX_RUN_BUDGET_USD` (logged), so it always fits numeric(12,6).
 * Test: `resolveRunBudget falls back to the default for unusable values`,
 * `resolveRunBudget prefers the parameter, then the env var`,
 * `resolveRunBudget clamps a budget above MAX_RUN_BUDGET_USD and warns`
 */
export function resolveRunBudget(
  param?: number | null,
  envValue: string | undefined = process.env.CRON_RUN_BUDGET_USD
): number {
  const budget = usableBudget(param) ?? usableBudget(envValue) ?? DEFAULT_RUN_BUDGET_USD;
  if (budget > MAX_RUN_BUDGET_USD) {
    console.warn(
      `[RunBudget] Requested budget $${budget} exceeds MAX_RUN_BUDGET_USD; clamping to $${MAX_RUN_BUDGET_USD}`
    );
    return MAX_RUN_BUDGET_USD;
  }
  return budget;
}

/**
 * True once `spentUsd` has reached `budgetUsd`. Checked before each paid step,
 * so a run overshoots by at most the cost of one step.
 */
export function isBudgetExhausted(spentUsd: number, budgetUsd: number): boolean {
  return spentUsd >= budgetUsd;
}

/** The `errors[]` entry a budget-stopped run carries. */
export function formatBudgetExceeded(spentUsd: number, budgetUsd: number): string {
  return `budget exceeded: $${spentUsd.toFixed(4)} of $${budgetUsd.toFixed(2)}`;
}
