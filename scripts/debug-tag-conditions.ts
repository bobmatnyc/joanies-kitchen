import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { and, eq, isNull, like, or, sql } from 'drizzle-orm';

async function debugTagConditions() {
  console.log('Testing tag condition building logic...\n');

  const category = { name: 'appetizer', tags: ['appetizer', 'starter', 'snack'] };

  // Build tag matching conditions
  const tagConditions = category.tags
    .map((tag) => or(like(recipes.tags, `%"${tag}"%`), like(recipes.tags, `%${tag}%`)))
    .filter((condition) => condition !== undefined);

  console.log('Tag conditions array length:', tagConditions.length);
  console.log('Tag conditions:', tagConditions);

  try {
    // Try to use it in a query
    const categoryRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        tags: recipes.tags,
      })
      .from(recipes)
      .where(
        and(
          eq(recipes.is_public, true),
          isNull(recipes.deleted_at),
          sql`(${recipes.image_url} IS NOT NULL OR ${recipes.images} IS NOT NULL)`,
          or(...tagConditions)
        )
      )
      .limit(5);

    console.log('\n✅ Query succeeded!');
    console.log('Found recipes:', categoryRecipes.length);
    categoryRecipes.forEach((r) => console.log('  -', r.name));
  } catch (error) {
    console.error('\n❌ Query failed:', error);
  }

  process.exit(0);
}

debugTagConditions();
