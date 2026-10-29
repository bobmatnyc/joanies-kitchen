import { type NextRequest, NextResponse } from 'next/server';
import {
  hybridSearchRecipes,
  type SearchOptions,
  type SemanticSearchResult,
  semanticSearchRecipes,
} from '@/app/actions/semantic-search';
import { toErrorMessage } from '@/lib/utils/error-handling';

/** #17/#57: 429 (with Retry-After) over the rate limit; 503 for a limiter outage or the cost ceiling. */
function searchResponse(result: SemanticSearchResult) {
  if (result.errorCode === 'RATE_LIMITED') {
    return NextResponse.json(result, {
      status: 429,
      headers: { 'Retry-After': String(result.retryAfterSec ?? 60) },
    });
  }
  if (result.errorCode) return NextResponse.json(result, { status: 503 });
  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}

/**
 * POST /api/search/semantic
 *
 * Performs semantic or hybrid search on recipes
 *
 * Request body:
 * {
 *   query: string,
 *   mode?: 'semantic' | 'hybrid',
 *   options?: SearchOptions
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   recipes: RecipeWithSimilarity[],
 *   error?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, mode = 'semantic', options = {} } = body;

    // Validate query
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        {
          success: false,
          recipes: [],
          error: 'Invalid query parameter',
        },
        { status: 400 }
      );
    }

    // Perform search based on mode
    const result =
      mode === 'hybrid'
        ? await hybridSearchRecipes(query, options as SearchOptions)
        : await semanticSearchRecipes(query, options as SearchOptions);

    return searchResponse(result); // #17
  } catch (error: unknown) {
    console.error('API semantic search error:', error);
    return NextResponse.json(
      {
        success: false,
        recipes: [],
        error: toErrorMessage(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/semantic?q=query&mode=semantic&limit=20[&minSimilarity=0.65]
 *
 * Alternative GET endpoint for simple searches
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const mode = searchParams.get('mode') || 'semantic';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    // #96 D57: calibrated cutoff — no (or a non-number) minSimilarity leaves it
    // undefined, so search applies SEARCH_MIN_SIMILARITY plus the relative trim.
    const rawMinSimilarity = Number.parseFloat(searchParams.get('minSimilarity') ?? '');
    const minSimilarity = Number.isFinite(rawMinSimilarity) ? rawMinSimilarity : undefined;
    const cuisine = searchParams.get('cuisine') || undefined;
    const difficulty = searchParams.get('difficulty') || undefined;

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          recipes: [],
          error: 'Query parameter (q) is required',
        },
        { status: 400 }
      );
    }

    const options: SearchOptions = {
      limit,
      minSimilarity,
      cuisine,
      difficulty: difficulty as 'easy' | 'medium' | 'hard' | undefined,
      includePrivate: true,
    };

    const result =
      mode === 'hybrid'
        ? await hybridSearchRecipes(query, options)
        : await semanticSearchRecipes(query, options);

    return searchResponse(result); // #17
  } catch (error: unknown) {
    console.error('API semantic search error:', error);
    return NextResponse.json(
      {
        success: false,
        recipes: [],
        error: toErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
