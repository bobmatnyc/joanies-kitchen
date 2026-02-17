import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

async function testQuery() {
  console.log('Testing getTopRatedRecipes query...\n');

  try {
    const topRecipes = await db
      .select()
      .from(recipes)
      .where(
        and(
          eq(recipes.isPublic, true),
          or(sql`${recipes.systemRating} IS NOT NULL`, sql`${recipes.avgUserRating} IS NOT NULL`)
        )
      )
      .orderBy(
        desc(
          sql`COALESCE(
            (COALESCE(${recipes.systemRating}, 0) + COALESCE(${recipes.avgUserRating}, 0)) /
            NULLIF(
              (CASE WHEN ${recipes.systemRating} IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN ${recipes.avgUserRating} IS NOT NULL THEN 1 ELSE 0 END),
              0
            ),
            COALESCE(${recipes.systemRating}, ${recipes.avgUserRating}, 0)
          )`
        ),
        desc(recipes.createdAt)
      )
      .limit(8);

    console.log(`✅ Query successful! Found ${topRecipes.length} top-rated recipes`);
    console.log('\nSample recipe:');
    if (topRecipes[0]) {
      console.log(
        JSON.stringify(
          {
            id: topRecipes[0].id,
            name: topRecipes[0].name,
            systemRating: topRecipes[0].systemRating,
            avgUserRating: topRecipes[0].avgUserRating,
          },
          null,
          2
        )
      );
    }
  } catch (error) {
    console.error('❌ Query failed:', error);
    process.exit(1);
  }
}

testQuery();
