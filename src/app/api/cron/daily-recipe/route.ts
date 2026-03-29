/**
 * Cron API: Daily Autonomous Recipe Discovery and Ingestion
 *
 * GET  /api/cron/daily-recipe  — Triggered by Vercel cron at 6 AM UTC daily
 * POST /api/cron/daily-recipe  — Manual trigger (e.g. from admin dashboard)
 *
 * Both handlers require Authorization: Bearer <CRON_SECRET>.
 * POST accepts an optional JSON body: { dryRun?: boolean, maxRecipes?: number }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAutonomousRecipeIngestionService } from '@/lib/services/autonomous-recipe-ingestion.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes — fits Vercel Pro limit

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
// GET — Vercel scheduled cron trigger
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[DailyRecipeCron] GET triggered at ${new Date().toISOString()}`);

  if (!isAuthorized(request)) {
    console.warn('[DailyRecipeCron] Unauthorized GET request');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const service = getAutonomousRecipeIngestionService();
    const result = await service.runDailyDiscovery({ maxRecipes: 3, dryRun: false });

    const durationMs = Date.now() - startTime;
    console.log(
      `[DailyRecipeCron] Completed — stored=${result.recipesStored}, skipped=${result.recipesSkipped}, ` +
        `chefsCreated=${result.chefsCreated}, errors=${result.errors.length}, duration=${durationMs}ms`
    );

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
  const startTime = Date.now();
  console.log(`[DailyRecipeCron] POST triggered at ${new Date().toISOString()}`);

  if (!isAuthorized(request)) {
    console.warn('[DailyRecipeCron] Unauthorized POST request');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Parse optional overrides from request body
  let dryRun = false;
  let maxRecipes = 3;

  try {
    const body = await request.json();
    if (typeof body.dryRun === 'boolean') dryRun = body.dryRun;
    if (typeof body.maxRecipes === 'number' && body.maxRecipes > 0) maxRecipes = body.maxRecipes;
  } catch {
    // Body is optional — ignore parse errors
  }

  console.log(`[DailyRecipeCron] Options — dryRun=${dryRun}, maxRecipes=${maxRecipes}`);

  try {
    const service = getAutonomousRecipeIngestionService();
    const result = await service.runDailyDiscovery({ dryRun, maxRecipes });

    const durationMs = Date.now() - startTime;
    console.log(
      `[DailyRecipeCron] Completed — stored=${result.recipesStored}, skipped=${result.recipesSkipped}, ` +
        `chefsCreated=${result.chefsCreated}, errors=${result.errors.length}, duration=${durationMs}ms`
    );

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
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[DailyRecipeCron] Pipeline failed: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
