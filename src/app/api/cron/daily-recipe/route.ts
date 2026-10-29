/**
 * Cron API: Daily Autonomous Recipe Discovery and Ingestion
 *
 * GET  /api/cron/daily-recipe  — Triggered by Vercel cron at 6 AM UTC daily
 * POST /api/cron/daily-recipe  — Manual trigger (e.g. from admin dashboard)
 *
 * Both handlers require Authorization: Bearer <CRON_SECRET>.
 *
 * GET cron reads batch config from env vars:
 *   CRON_MAX_RECIPES  — max recipes per run (default: 5)
 *   CRON_SEARCH_QUERY — optional fixed search query (default: rotating)
 *
 *   CRON_RUN_BUDGET_USD — per-run USD budget (default: DEFAULT_RUN_BUDGET_USD)
 *
 * POST body params (all optional, override env vars):
 *   { dryRun?: boolean, maxRecipes?: number, searchQuery?: string, budgetUsd?: number }
 *
 * Each run first reaps stale `running` rows (#6 S2), then crawls until a
 * deadline of `maxDuration` minus `FINALIZE_SAFETY_MARGIN_MS` and finalizes (#6).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getAutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';
import { crawlRunDeadline } from '@/lib/services/crawl-run-deadline';
import { reapStaleDiscoveryRunsFailOpen } from '@/lib/services/discovery-run-reaper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 5 minutes — fits Vercel Pro limit. Must be a literal for Next's static
// analysis; keep it equal to CRON_FUNCTION_LIMIT_MS (asserted in a test).
export const maxDuration = 300;

/** #6: the run's stop-and-finalize time, measured from handler entry. */
function runDeadline(handlerStart: number): number {
  return crawlRunDeadline(handlerStart, maxDuration * 1000);
}

// ---------------------------------------------------------------------------
// Env-var config parsing
// ---------------------------------------------------------------------------

function getEnvMaxRecipes(): number {
  const raw = process.env.CRON_MAX_RECIPES;
  if (!raw) return 5; // default
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

// #104: shared with the purge cron.
function isAuthorized(request: NextRequest): boolean {
  return isCronAuthorized(request, '[DailyRecipeCron]');
}

/**
 * #6 S2: mark runs killed before their finally as failed. A reaper failure is
 * logged and never blocks the new run.
 */
async function reapStaleRuns(): Promise<void> {
  const reaped = await reapStaleDiscoveryRunsFailOpen('[DailyRecipeCron]');
  if (reaped > 0) console.warn(`[DailyRecipeCron] Reaped ${reaped} stale run(s)`);
}

// ---------------------------------------------------------------------------
// Shared response builder
// ---------------------------------------------------------------------------

function buildSuccessResponse(result: {
  runId: string;
  status: string;
  urlsDiscovered: number;
  recipesExtracted: number;
  recipesStored: number;
  recipesSkipped: number;
  chefsCreated: number;
  errors: string[];
  durationMs: number;
  tracked: boolean;
}) {
  return NextResponse.json(
    {
      success: true,
      runId: result.runId,
      status: result.status,
      urlsDiscovered: result.urlsDiscovered,
      recipesExtracted: result.recipesExtracted,
      recipesStored: result.recipesStored,
      recipesSkipped: result.recipesSkipped,
      chefsCreated: result.chefsCreated,
      errors: result.errors,
      durationMs: result.durationMs,
      // #6 S2: false when no run row backs this run (create failed or dry run).
      tracked: result.tracked,
    },
    { status: 200 }
  );
}

// ---------------------------------------------------------------------------
// GET — Vercel scheduled cron trigger
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const deadlineAt = runDeadline(Date.now());
  console.log(`[DailyRecipeCron] GET triggered at ${new Date().toISOString()}`);

  if (!isAuthorized(request)) {
    console.warn('[DailyRecipeCron] Unauthorized GET request');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Batch size from env (configurable without code deploy)
  const maxRecipes = getEnvMaxRecipes();
  const searchQuery = process.env.CRON_SEARCH_QUERY || undefined;

  console.log(
    `[DailyRecipeCron] GET config — maxRecipes=${maxRecipes}, searchQuery=${searchQuery ?? 'rotating'}`
  );

  await reapStaleRuns();

  try {
    const service = getAutonomousRecipeIngestionService();
    const result = await service.runDailyDiscovery({
      maxRecipes,
      dryRun: false,
      searchQuery,
      runType: 'daily',
      deadlineAt,
    });

    console.log(
      `[DailyRecipeCron] Completed — stored=${result.recipesStored}, skipped=${result.recipesSkipped}, ` +
        `chefsCreated=${result.chefsCreated}, errors=${result.errors.length}, duration=${result.durationMs}ms`
    );

    return buildSuccessResponse(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[DailyRecipeCron] Pipeline failed: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Manual trigger (admin dashboard / CI smoke test)
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const deadlineAt = runDeadline(Date.now());
  console.log(`[DailyRecipeCron] POST triggered at ${new Date().toISOString()}`);

  if (!isAuthorized(request)) {
    console.warn('[DailyRecipeCron] Unauthorized POST request');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Parse optional overrides from request body.
  // POST body > env vars > hard defaults (handled inside runDailyDiscovery).
  let dryRun = false;
  let maxRecipes: number | undefined;
  let searchQuery: string | undefined;
  let budgetUsd: number | undefined;

  try {
    const body = await request.json();
    if (typeof body.dryRun === 'boolean') dryRun = body.dryRun;
    if (typeof body.maxRecipes === 'number' && body.maxRecipes > 0) maxRecipes = body.maxRecipes;
    if (typeof body.searchQuery === 'string' && body.searchQuery.trim()) {
      searchQuery = body.searchQuery.trim();
    }
    if (typeof body.budgetUsd === 'number') budgetUsd = body.budgetUsd;
  } catch {
    // Body is optional — ignore parse errors
  }

  console.log(
    `[DailyRecipeCron] POST options — dryRun=${dryRun}, maxRecipes=${maxRecipes ?? 'env/default'}, searchQuery=${searchQuery ?? 'env/rotating'}`
  );

  await reapStaleRuns();

  try {
    const service = getAutonomousRecipeIngestionService();
    const result = await service.runDailyDiscovery({
      dryRun,
      maxRecipes,
      searchQuery,
      budgetUsd,
      runType: 'manual',
      deadlineAt,
    });

    console.log(
      `[DailyRecipeCron] Completed — stored=${result.recipesStored}, skipped=${result.recipesSkipped}, ` +
        `chefsCreated=${result.chefsCreated}, errors=${result.errors.length}, duration=${result.durationMs}ms`
    );

    return buildSuccessResponse(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[DailyRecipeCron] Pipeline failed: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
