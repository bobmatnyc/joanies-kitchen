import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq, and, or, ilike, desc, asc, sql } from 'drizzle-orm';

/**
 * GET /api/ingredients/filter
 *
 * Filter and search ingredients with ontology support
 *
 * Query parameters:
 * - q: Search query (name, display_name)
 * - type: Filter by main type
 * - subtype: Filter by subtype
 * - category: Filter by legacy category
 * - is_common: Filter common ingredients only
 * - is_allergen: Filter allergens only
 * - sort: Sort by (usage_count, name, created_at) - default: usage_count
 * - order: Sort order (asc, desc) - default: desc
 * - limit: Results limit (default: 50, max: 200)
 * - offset: Results offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Search and filter parameters
    const searchQuery = searchParams.get('q');
    const typeFilter = searchParams.get('type');
    const subtypeFilter = searchParams.get('subtype');
    const categoryFilter = searchParams.get('category');
    const isCommon = searchParams.get('is_common') === 'true';
    const isAllergen = searchParams.get('is_allergen') === 'true';

    // Pagination and sorting
    const sortBy = searchParams.get('sort') || 'usage_count';
    const sortOrder = searchParams.get('order') || 'desc';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build WHERE conditions
    const conditions = [];

    if (searchQuery) {
      conditions.push(
        or(
          ilike(ingredients.name, `%${searchQuery}%`),
          ilike(ingredients.display_name, `%${searchQuery}%`)
        )
      );
    }

    if (typeFilter) {
      conditions.push(eq(ingredients.type, typeFilter));
    }

    if (subtypeFilter) {
      conditions.push(eq(ingredients.subtype, subtypeFilter));
    }

    if (categoryFilter) {
      conditions.push(eq(ingredients.category, categoryFilter));
    }

    if (isCommon) {
      conditions.push(eq(ingredients.is_common, true));
    }

    if (isAllergen) {
      conditions.push(eq(ingredients.is_allergen, true));
    }

    // Build ORDER BY
    const sortColumn = {
      usage_count: ingredients.usage_count,
      name: ingredients.name,
      display_name: ingredients.display_name,
      created_at: ingredients.created_at,
    }[sortBy] || ingredients.usage_count;

    const orderFn = sortOrder === 'asc' ? asc : desc;

    // Execute query
    const results = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        display_name: ingredients.display_name,
        slug: ingredients.slug,
        type: ingredients.type,
        subtype: ingredients.subtype,
        category: ingredients.category,
        image_url: ingredients.image_url,
        usage_count: ingredients.usage_count,
        is_common: ingredients.is_common,
        is_allergen: ingredients.is_allergen,
        typical_unit: ingredients.typical_unit,
        aliases: ingredients.aliases,
      })
      .from(ingredients)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(ingredients)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return NextResponse.json({
      ingredients: results,
      total: totalCount[0]?.count || 0,
      limit,
      offset,
      has_more: (totalCount[0]?.count || 0) > offset + limit,
    });
  } catch (error) {
    console.error('Error filtering ingredients:', error);
    return NextResponse.json(
      { error: 'Failed to filter ingredients' },
      { status: 500 }
    );
  }
}
