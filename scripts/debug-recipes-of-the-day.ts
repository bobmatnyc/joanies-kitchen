import { and, eq, isNull, like, or, sql } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';

async function checkRecipes() {
  console.log('Checking for recipes with semantic tags...\n');

  // Define course categories with semantic tag variations
  const categories = [
    { name: 'appetizer', tags: ['appetizer', 'starter', 'snack'] },
    { name: 'main', tags: ['dinner', 'main-course', 'lunch', 'main'] },
    { name: 'side', tags: ['side', 'side dish', 'side-dish'] },
    { name: 'dessert', tags: ['dessert', 'sweet', 'pastry'] },
  ];

  for (const category of categories) {
    // Build tag matching conditions for this category
    const tagConditions = category.tags
      .map((tag) => or(like(recipes.tags, `%"${tag}"%`), like(recipes.tags, `%${tag}%`)))
      .filter((condition) => condition !== undefined);

    // Query recipes matching this category's tags
    const categoryRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        tags: recipes.tags,
        image_url: recipes.image_url,
        images: recipes.images,
        system_rating: recipes.system_rating,
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
      .orderBy(sql`${recipes.system_rating} DESC NULLS LAST`, sql`${recipes.created_at} DESC`)
      .limit(5);

    console.log(`\n${category.name.toUpperCase()} recipes (${categoryRecipes.length}):`);
    if (categoryRecipes.length === 0) {
      console.log('  ⚠️  NO RECIPES FOUND WITH IMAGES');
    } else {
      categoryRecipes.forEach((r, index) => {
        const hasImageUrl = !!r.image_url;
        const hasImages = !!r.images;
        console.log(
          `  ${index + 1}. ${r.name} (rating: ${r.system_rating || 'none'}, image_url: ${hasImageUrl}, images: ${hasImages})`
        );
      });
    }
  }

  // Also check how many total public recipes with images exist
  const totalWithImages = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes)
    .where(
      and(
        eq(recipes.is_public, true),
        isNull(recipes.deleted_at),
        sql`(${recipes.image_url} IS NOT NULL OR ${recipes.images} IS NOT NULL)`
      )
    );

  console.log(`\n\nTotal public recipes with images: ${totalWithImages[0]?.count || 0}`);

  process.exit(0);
}

checkRecipes().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
