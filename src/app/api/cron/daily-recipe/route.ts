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
 * POST body params (all optional, override env vars):
 *   { dryRun?: boolean, maxRecipes?: number, searchQuery?: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getAutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — fits Vercel Pro limit

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

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret) {
    console.error('[DailyRecipeCron] CRON_SECRET environment variable not configured');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
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
    },
    { status: 200 }
  );
}

// ---------------------------------------------------------------------------
// GET — Vercel scheduled cron trigger
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
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

  try {
    const service = getAutonomousRecipeIngestionService();
    const result = await service.runDailyDiscovery({ maxRecipes, dryRun: false, searchQuery });

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

  try {
    const body = await request.json();
    if (typeof body.dryRun === 'boolean') dryRun = body.dryRun;
    if (typeof body.maxRecipes === 'number' && body.maxRecipes > 0) maxRecipes = body.maxRecipes;
    if (typeof body.searchQuery === 'string' && body.searchQuery.trim()) {
      searchQuery = body.searchQuery.trim();
    }
  } catch {
    // Body is optional — ignore parse errors
  }

  console.log(
    `[DailyRecipeCron] POST options — dryRun=${dryRun}, maxRecipes=${maxRecipes ?? 'env/default'}, searchQuery=${searchQuery ?? 'env/rotating'}`
  );

  try {
    const service = getAutonomousRecipeIngestionService();
    const result = await service.runDailyDiscovery({ dryRun, maxRecipes, searchQuery });

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
