import { headers } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { crawlWeeklyRecipes } from '@/app/actions/recipe-crawl';

export async function POST(request: NextRequest) {
  try {
    // Get host header
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    // Skip auth for localhost
    if (!isLocalhost) {
      // For production, add auth check here
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { weeksAgo = 0, cuisine, maxResults = 10, autoApprove = false } = body;

    // Validate inputs
    if (typeof weeksAgo !== 'number' || weeksAgo < 0 || weeksAgo > 52) {
      return NextResponse.json(
        { error: 'weeksAgo must be a number between 0 and 52' },
        { status: 400 }
      );
    }

    if (maxResults > 50) {
      return NextResponse.json({ error: 'maxResults cannot exceed 50' }, { status: 400 });
    }

    // Run the crawl
    const result = await crawlWeeklyRecipes(weeksAgo, {
      cuisine,
      maxResults,
      autoApprove,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Crawl API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// Allow GET to check status
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Recipe crawl API is running',
    usage: {
      endpoint: '/api/crawl/weekly',
      method: 'POST',
      body: {
        weeksAgo: 'number (0-52)',
        cuisine: 'string (optional)',
        maxResults: 'number (max 50)',
        autoApprove: 'boolean',
      },
    },
  });
}
