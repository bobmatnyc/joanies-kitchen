import { type NextRequest, NextResponse } from 'next/server';
import {
  hybridSearchRecipes,
  type SearchOptions,
  semanticSearchRecipes,
} from '@/app/actions/semantic-search';

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

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: unknown) {
    console.error('API semantic search error:', error);
    return NextResponse.json(
      {
        success: false,
        recipes: [],
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/semantic?q=query&mode=semantic&limit=20&minSimilarity=0.5
 *
 * Alternative GET endpoint for simple searches
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const mode = searchParams.get('mode') || 'semantic';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const minSimilarity = parseFloat(searchParams.get('minSimilarity') || '0.5');
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

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error: unknown) {
    console.error('API semantic search error:', error);
    return NextResponse.json(
      {
        success: false,
        recipes: [],
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
