import { type NextRequest, NextResponse } from 'next/server';
import { authorizeAdminOrCronSecret } from '@/lib/admin';
import { runRecordedWeeklyCrawl } from '@/lib/services/recorded-weekly-crawl';

/** #6 S2: ceiling on URLs per request; each one is a paid Firecrawl + LLM call. */
const MAX_SCRAPE_RESULTS = 50;

function clampMaxResults(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 5;
  return Math.min(Math.max(n, 1), MAX_SCRAPE_RESULTS);
}

export async function POST(request: NextRequest) {
  // #11: paid crawl — admin session or CRON_SECRET bearer only, checked before any work.
  const denied = await authorizeAdminOrCronSecret(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { weeksAgo = 0, autoApprove = true } = body;
    const maxResults = clampMaxResults(body.maxResults ?? 5);

    console.log(
      `[API] Scraping recipes for week ${weeksAgo} (max: ${maxResults}, autoApprove: ${autoApprove})`
    );

    // #6 S2: record the crawl as a discovery run (test/scripts/standalone-scraper.ts calls this).
    const run = await runRecordedWeeklyCrawl({
      weeks: [weeksAgo],
      maxResultsPerWeek: maxResults,
      autoApprove,
      runType: 'manual',
    });
    const result = run.weeks[0];
    if (!result) {
      return NextResponse.json(
        { success: false, runId: run.runId, tracked: run.tracked, error: run.errors.join('; ') },
        { status: 500 }
      );
    }

    return NextResponse.json({ ...result, runId: run.runId, tracked: run.tracked });
  } catch (error) {
    console.error('[API] Error scraping recipes:', error);
    return NextResponse.json(
      {
        error: 'Failed to scrape recipes',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger recipe scraping',
    example: {
      weeksAgo: 0,
      maxResults: 5,
      autoApprove: true,
    },
  });
}
