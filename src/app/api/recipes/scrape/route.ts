import { type NextRequest, NextResponse } from 'next/server';
import { crawlWeeklyRecipes } from '@/lib/recipe-crawl';
import { authorizeAdminOrCronSecret } from '@/lib/admin';

export async function POST(request: NextRequest) {
  // #11: paid crawl — admin session or CRON_SECRET bearer only, checked before any work.
  const denied = await authorizeAdminOrCronSecret(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { weeksAgo = 0, maxResults = 5, autoApprove = true } = body;

    console.log(
      `[API] Scraping recipes for week ${weeksAgo} (max: ${maxResults}, autoApprove: ${autoApprove})`
    );

    const result = await crawlWeeklyRecipes(weeksAgo, {
      maxResults,
      autoApprove,
    });

    return NextResponse.json(result);
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
