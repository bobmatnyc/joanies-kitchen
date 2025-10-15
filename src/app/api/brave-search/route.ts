import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

// Type definitions for request/response
interface BraveSearchRequest {
  query: string;
  count?: number;
}

interface BraveSearchError {
  error: string;
  details?: string;
}

// Type for Brave Search API response (simplified)
interface BraveSearchResponse {
  type?: string;
  query?: {
    original: string;
    show_strict_warning: boolean;
    altered?: string;
  };
  web?: {
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
      language?: string;
    }>;
  };
  videos?: unknown;
  news?: unknown;
  discussions?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json<BraveSearchError>(
        { error: 'Unauthorized', details: 'You must be signed in to use search' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body: BraveSearchRequest;

    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json<BraveSearchError>(
        { error: 'Invalid request body', details: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const { query, count = 10 } = body;

    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json<BraveSearchError>(
        { error: 'Invalid query', details: 'Query must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate count parameter
    if (typeof count !== 'number' || count < 1 || count > 100) {
      return NextResponse.json<BraveSearchError>(
        { error: 'Invalid count', details: 'Count must be a number between 1 and 100' },
        { status: 400 }
      );
    }

    // 3. Check API key exists
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
      console.error('BRAVE_SEARCH_API_KEY is not configured');
      return NextResponse.json<BraveSearchError>(
        { error: 'Search service unavailable', details: 'Search service is not configured' },
        { status: 503 }
      );
    }

    // 4. Call Brave Search API
    const searchUrl = new URL('https://api.search.brave.com/res/v1/web/search');
    searchUrl.searchParams.set('q', query.trim());
    searchUrl.searchParams.set('count', count.toString());

    console.log(`Brave Search API request: userId=${userId}, query="${query.substring(0, 50)}...", count=${count}`);

    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': apiKey,
      },
    });

    // 5. Handle API error responses
    if (!response.ok) {
      const statusCode = response.status;
      let errorMessage = 'Search failed';
      let details = `API returned status ${statusCode}`;

      switch (statusCode) {
        case 401:
          errorMessage = 'Search service authentication failed';
          details = 'Invalid API key configuration';
          console.error('Brave Search API: Invalid API key (401)');
          return NextResponse.json<BraveSearchError>(
            { error: errorMessage, details },
            { status: 503 } // Don't expose auth issues to client
          );

        case 429:
          errorMessage = 'Rate limit exceeded';
          details = 'Too many requests. Please try again later.';
          console.warn('Brave Search API: Rate limit exceeded (429)');
          return NextResponse.json<BraveSearchError>(
            { error: errorMessage, details },
            { status: 429 }
          );

        case 400:
          errorMessage = 'Invalid search query';
          details = 'The search query format is invalid';
          console.error('Brave Search API: Bad request (400)');
          return NextResponse.json<BraveSearchError>(
            { error: errorMessage, details },
            { status: 400 }
          );

        case 500:
        case 502:
        case 503:
        case 504:
          errorMessage = 'Search service temporarily unavailable';
          details = 'Please try again in a few moments';
          console.error(`Brave Search API: Server error (${statusCode})`);
          return NextResponse.json<BraveSearchError>(
            { error: errorMessage, details },
            { status: 503 }
          );

        default:
          console.error(`Brave Search API: Unexpected error (${statusCode})`);
          return NextResponse.json<BraveSearchError>(
            { error: errorMessage, details },
            { status: 500 }
          );
      }
    }

    // 6. Parse and return results
    const data: BraveSearchResponse = await response.json();

    // Log successful search
    console.log(`Brave Search API: Success for userId=${userId}, results=${data.web?.results?.length || 0}`);

    return NextResponse.json(data, { status: 200 });

  } catch (error) {
    // Handle unexpected errors
    console.error('Brave Search API: Unexpected error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return NextResponse.json<BraveSearchError>(
      {
        error: 'Search failed',
        details: 'An unexpected error occurred while processing your request'
      },
      { status: 500 }
    );
  }
}

// Disable other HTTP methods
export async function GET() {
  return NextResponse.json<BraveSearchError>(
    { error: 'Method not allowed', details: 'Use POST method for search requests' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json<BraveSearchError>(
    { error: 'Method not allowed', details: 'Use POST method for search requests' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json<BraveSearchError>(
    { error: 'Method not allowed', details: 'Use POST method for search requests' },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json<BraveSearchError>(
    { error: 'Method not allowed', details: 'Use POST method for search requests' },
    { status: 405 }
  );
}
