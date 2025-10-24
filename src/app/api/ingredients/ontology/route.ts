import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ingredients } from '@/lib/db/ingredients-schema';
import { eq, and, sql, desc } from 'drizzle-orm';

/**
 * GET /api/ingredients/ontology
 *
 * Get ingredient ontology structure and statistics
 *
 * Query parameters:
 * - type: Filter by main type (FRESH_PRODUCE, PROTEINS, DAIRY_EGGS, PANTRY_STAPLES, BAKING_SPECIALTY)
 * - subtype: Filter by subtype (vegetables_leafy, meat_beef, etc.)
 * - include_ingredients: Include full ingredient list (default: false)
 * - limit: Limit ingredients per subtype (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const typeFilter = searchParams.get('type');
    const subtypeFilter = searchParams.get('subtype');
    const includeIngredients = searchParams.get('include_ingredients') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build filter conditions
    const conditions = [];
    if (typeFilter) {
      conditions.push(eq(ingredients.type, typeFilter));
    }
    if (subtypeFilter) {
      conditions.push(eq(ingredients.subtype, subtypeFilter));
    }

    // Get ontology structure with counts
    const ontologyQuery = db
      .select({
        type: ingredients.type,
        subtype: ingredients.subtype,
        count: sql<number>`count(*)::int`,
      })
      .from(ingredients)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(ingredients.type, ingredients.subtype)
      .orderBy(ingredients.type, desc(sql`count(*)`));

    const ontologyStructure = await ontologyQuery;

    // Organize by type
    const organized: Record<string, any> = {};

    for (const row of ontologyStructure) {
      if (!row.type) continue;

      if (!organized[row.type]) {
        organized[row.type] = {
          type: row.type,
          total_count: 0,
          subtypes: [],
        };
      }

      organized[row.type].total_count += row.count;
      organized[row.type].subtypes.push({
        subtype: row.subtype,
        count: row.count,
      });
    }

    // Optionally include ingredient lists
    if (includeIngredients && subtypeFilter) {
      const ingredientsList = await db
        .select({
          id: ingredients.id,
          name: ingredients.name,
          display_name: ingredients.display_name,
          slug: ingredients.slug,
          image_url: ingredients.image_url,
          usage_count: ingredients.usage_count,
        })
        .from(ingredients)
        .where(and(
          typeFilter ? eq(ingredients.type, typeFilter) : undefined,
          eq(ingredients.subtype, subtypeFilter)
        ))
        .orderBy(desc(ingredients.usage_count))
        .limit(limit);

      return NextResponse.json({
        ontology: organized,
        ingredients: ingredientsList,
        total: ingredientsList.length,
      });
    }

    return NextResponse.json({
      ontology: organized,
      total_types: Object.keys(organized).length,
    });
  } catch (error) {
    console.error('Error fetching ontology:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ingredient ontology' },
      { status: 500 }
    );
  }
}
