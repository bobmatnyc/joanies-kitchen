import { NextRequest, NextResponse } from 'next/server';
import { getRecipesPaginated, type PaginationParams } from '@/app/actions/recipes';

/**
 * API Route for paginated recipe fetching
 * Supports infinite scroll and filtering
 *
 * POST /api/recipes/paginated
 * Body: {
 *   page?: number,
 *   limit?: number,
 *   filters?: {
 *     cuisine?: string,
 *     difficulty?: 'easy' | 'medium' | 'hard',
 *     minRating?: number,
 *     tags?: string[],
 *     userId?: string,
 *     isSystemRecipe?: boolean,
 *     isPublic?: boolean,
 *     searchQuery?: string
 *   },
 *   sort?: 'rating' | 'recent' | 'name'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as PaginationParams;

    // Validate pagination parameters
    const page = Math.max(1, body.page || 1);
    const limit = Math.min(100, Math.max(1, body.limit || 24)); // Cap at 100 items per page

    const result = await getRecipesPaginated({
      page,
      limit,
      filters: body.filters || {},
      sort: body.sort || 'rating',
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch recipes' },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Pagination API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for simple queries (with URL parameters)
 * Less flexible than POST, but easier for simple use cases
 *
 * GET /api/recipes/paginated?page=1&limit=24&sort=rating&cuisine=italian
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '24'));
    const sort = (searchParams.get('sort') || 'rating') as 'rating' | 'recent' | 'name';

    // Build filters from query params
    const filters: PaginationParams['filters'] = {};

    if (searchParams.has('cuisine')) {
      filters.cuisine = searchParams.get('cuisine') || undefined;
    }

    if (searchParams.has('difficulty')) {
      filters.difficulty = searchParams.get('difficulty') as 'easy' | 'medium' | 'hard';
    }

    if (searchParams.has('minRating')) {
      filters.minRating = parseFloat(searchParams.get('minRating') || '0');
    }

    if (searchParams.has('searchQuery')) {
      filters.searchQuery = searchParams.get('searchQuery') || undefined;
    }

    if (searchParams.has('isSystemRecipe')) {
      filters.isSystemRecipe = searchParams.get('isSystemRecipe') === 'true';
    }

    if (searchParams.has('isPublic')) {
      filters.isPublic = searchParams.get('isPublic') === 'true';
    }

    // Tags can be comma-separated
    if (searchParams.has('tags')) {
      const tagsParam = searchParams.get('tags');
      filters.tags = tagsParam ? tagsParam.split(',').map(t => t.trim()) : undefined;
    }

    const result = await getRecipesPaginated({
      page,
      limit,
      filters,
      sort,
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch recipes' },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Pagination API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
