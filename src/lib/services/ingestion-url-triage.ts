/**
 * URL triage and run outcome for `AutonomousRecipeIngestionService` (#300).
 *
 * Why: the 2026-11-07 cron run fetched one post three times through fragment
 * variants (`#`, `#subscribe`, `#respond`) and counted 16 hub and listicle
 * pages as errors, so `partial` was the normal result of a healthy run.
 * What: `triageDiscoveredUrls` drops in-run URL duplicates, then known URLs;
 * `nonRecipeSkipReason` says when an extraction miss is a page with no recipe
 * rather than a failure; `finalRunStatus` and `runStopReason` decide how the
 * run ended.
 * Test: `src/lib/services/__tests__/ingestion-url-triage.test.ts`,
 * `src/lib/services/__tests__/run-accounting.test.ts` (the `#300` blocks)
 */

import { canonicalizeSourceUrl } from '@/lib/recipes/dedup';
import { recordItem } from './autonomous-ingestion-run';
import {
  determineRunStatus,
  type RunMetrics,
  type RunStopReason,
} from './autonomous-ingestion-store';
import type { DiscoveryRunStatus, DiscoveryRunType } from './discovery-run-store';
import { nonRecipePathRule } from './ingestion-url-rules';
import { findKnownUrls } from './known-url-skip';
import { isListiclePage } from './recipe-discovery-url';
import type { ExtractionReport } from './recipe-extraction.types';

/** `url` without its fragment. The first `#` starts the fragment; nothing else changes. */
export function withoutFragment(url: string): string {
  const hash = url.indexOf('#');
  return hash === -1 ? url : url.slice(0, hash);
}

/**
 * Why: a fragment never reaches the server, so `/post#respond` and
 * `/post#subscribe` are one fetch of one page (#300).
 * What: keeps the first URL per `canonicalizeSourceUrl` key (the key recipe
 * inserts write, which already drops the fragment), with its fragment removed,
 * in discovery order. Returns the kept list and how many were dropped.
 * Test: `drops URLs that differ only by fragment, keeping the first without its fragment`
 */
export function dedupeDiscoveredUrls<T extends { url: string }>(
  discovered: T[]
): { unique: T[]; duplicates: number } {
  const seen = new Set<string>();
  const unique: T[] = [];
  for (const item of discovered) {
    const url = withoutFragment(item.url);
    const key = canonicalizeSourceUrl(url) ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(url === item.url ? item : { ...item, url });
  }
  return { unique, duplicates: discovered.length - unique.length };
}

/**
 * Why: a fetch spent on a URL fetched earlier in the run, or on a URL a live
 * recipe already holds, buys nothing (#142, #300).
 * What: drops in-run duplicates (`dedupeDiscoveredUrls`, counted into
 * `m.urlsDeduped`, no item row: the kept URL gets that row), then skips known
 * URLs as before — on the fragment-free URL — writing a `skipped_duplicate`
 * row each. #302: a URL whose path breaks a `nonRecipePathRule` gets a
 * `skipped_non_recipe` row and counts as a non-recipe skip, never an error.
 * Returns the URLs left to extract.
 * Test: `fragment variants of one post are fetched once, and a known URL is still skipped on the fragment-free URL`,
 * `run-accounting.test.ts` (`#302: cron tier speedups` block)
 */
export async function triageDiscoveredUrls<T extends { url: string }>(
  m: RunMetrics,
  runId: string,
  discovered: T[],
  runType: DiscoveryRunType
): Promise<T[]> {
  const { unique: deduped, duplicates } = dedupeDiscoveredUrls(discovered);
  m.urlsDeduped = duplicates;
  if (duplicates > 0) {
    console.log(
      `[AutonomousIngestion] #300: dropped ${duplicates} duplicate URL variant(s) before extraction`
    );
  }

  // #302: an index, media, forum or listicle path is a non-recipe skip before any tier runs.
  const unique: T[] = [];
  for (const item of deduped) {
    const rule = nonRecipePathRule(item.url);
    if (!rule) {
      unique.push(item);
      continue;
    }
    const reason = `non-recipe path (${rule})`;
    console.log(`[AutonomousIngestion] #302: skipped ${reason} without fetching: ${item.url}`);
    m.recipesSkipped++;
    m.nonRecipeSkipped++;
    await recordItem(m, {
      runId,
      url: item.url,
      extractionTier: 'none',
      outcome: 'skipped_non_recipe',
      error: reason,
    });
  }

  // #142 (D7c): only the cron run skips a known URL here; a manual run re-fetches.
  const existingUrls = await findKnownUrls(
    unique.map((d) => d.url),
    runType
  );
  for (const dup of unique.filter((d) => existingUrls.has(d.url))) {
    m.recipesSkipped++;
    await recordItem(m, {
      runId,
      url: dup.url,
      extractionTier: 'none',
      outcome: 'skipped_duplicate',
    });
  }
  const newUrls = unique.filter((d) => !existingUrls.has(d.url));
  if (newUrls.length < unique.length) {
    console.log(
      `[AutonomousIngestion] #142: skipped ${unique.length - newUrls.length} known URL(s) without fetching (${runType} run)`
    );
  }
  return newUrls;
}

/**
 * Why: a hub or listicle page has no recipe to extract, so a miss there is a
 * skip, not a failure; a recipe page that fails to parse, or a page no tier
 * could read, is still a failure (#300).
 * What: returns the skip reason when at least one tier gave a reliable
 * `no_recipe` verdict (a Firecrawl schema read with no Recipe, or an LLM that
 * ran and found nothing; see `recipe-extraction-verdict.ts`) and no tier saw
 * recipe evidence (`recipe_partial`). Tiers that threw or had no verdict
 * (`empty`) are allowed beside a `no_recipe` tier. Returns null — an error —
 * for anything else, including an empty report.
 * The listicle/hub URL detector only labels the reason.
 * Test: `src/lib/services/__tests__/ingestion-url-triage.test.ts`,
 * `src/lib/services/__tests__/recipe-extraction-report-300.test.ts`
 */
export function nonRecipeSkipReason(
  report: ExtractionReport,
  url: string,
  title?: string
): string | null {
  const { attempts } = report;
  if (attempts.some((a) => a.result === 'recipe_partial')) return null;
  const readBy = attempts.filter((a) => a.result === 'no_recipe').map((a) => a.tier);
  if (readBy.length === 0) return null;
  const kind = isListiclePage(url, title) ? 'hub/listicle page' : 'non-recipe page';
  // #302: a chain-stopping verdict names itself; no later tier ran to list.
  if (report.verdict) return `${kind}: ${report.verdict} verdict (read by ${readBy.join(', ')})`;
  const missed = attempts
    .filter((a) => a.result !== 'no_recipe')
    .map((a) => `${a.tier} ${a.result}`);
  return (
    `${kind}: no recipe schema, ingredients or instructions (read by ${readBy.join(', ')}` +
    `${missed.length > 0 ? `; ${missed.join(', ')}` : ''})`
  );
}

export interface RunEnd {
  /** The pipeline threw. */
  pipelineError: boolean;
  /** The deadline stopped the run (`stopAtDeadline` ran). */
  deadline: boolean;
  budgetStopped: boolean;
  recipesStored: number;
  maxRecipes: number;
  errors: string[];
}

/**
 * Why: a run that stored its target did its job, so its errors (a hub page, a
 * failed store on another URL) must not mark it `partial` (#300).
 * What: `completed` once the target is reached; else `partial` on a deadline
 * or budget stop; else `determineRunStatus` (errors decide).
 * Test: `a run that reaches its store target is completed even with an error on another URL`
 */
export function finalRunStatus(end: RunEnd): DiscoveryRunStatus {
  if (end.recipesStored >= end.maxRecipes) return 'completed';
  if (end.budgetStopped || end.deadline) return 'partial';
  return determineRunStatus(end.recipesStored, end.errors);
}

/**
 * Why: `partial` alone does not say whether the clock cut the run (#300).
 * What: names the first stop that applies, in `finalRunStatus` order: error,
 * target, deadline, budget, else `exhausted` (every URL was tried, or there
 * were none).
 * Test: `src/lib/services/__tests__/ingestion-url-triage.test.ts`
 */
export function runStopReason(end: RunEnd): RunStopReason {
  if (end.pipelineError) return 'error';
  if (end.recipesStored >= end.maxRecipes) return 'target';
  if (end.deadline) return 'deadline';
  if (end.budgetStopped) return 'budget';
  return 'exhausted';
}
