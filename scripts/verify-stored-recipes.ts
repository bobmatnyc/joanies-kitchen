import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

async function verifyStoredRecipes() {
  console.log('Querying database for week 38 recipes...\n');

  try {
    // Query for week 38 recipes
    const week38Recipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        source: recipes.source,
        discoveryWeek: recipes.discoveryWeek,
        discoveryYear: recipes.discoveryYear,
        embeddingModel: recipes.embeddingModel,
        createdAt: recipes.createdAt,
      })
      .from(recipes)
      .where(eq(recipes.discoveryWeek, 38))
      .orderBy(sql`${recipes.createdAt} DESC`)
      .limit(10);

    console.log(`✅ Found ${week38Recipes.length} recipes for week 38:\n`);

    week38Recipes.forEach((recipe, idx) => {
      console.log(`${idx + 1}. ${recipe.name}`);
      console.log(`   Source: ${recipe.source}`);
      console.log(`   Week: ${recipe.discoveryYear}-W${recipe.discoveryWeek}`);
      console.log(`   Embedding: ${recipe.embeddingModel || 'null (NO EMBEDDING)'}`);
      console.log(`   Created: ${recipe.createdAt}`);
      console.log(`   ID: ${recipe.id}`);
      console.log('');
    });

    // Get overall statistics
    const stats = await db
      .select({
        total: sql<number>`count(*)`,
        withEmbeddings: sql<number>`count(*) filter (where ${recipes.embeddingModel} is not null)`,
        withoutEmbeddings: sql<number>`count(*) filter (where ${recipes.embeddingModel} is null)`,
      })
      .from(recipes);

    console.log('\n📊 Database Statistics:');
    console.log(`   Total Recipes: ${stats[0].total}`);
    console.log(`   With Embeddings: ${stats[0].withEmbeddings}`);
    console.log(`   Without Embeddings: ${stats[0].withoutEmbeddings}`);
    console.log(
      `   Success Rate: ${((stats[0].withEmbeddings / stats[0].total) * 100).toFixed(1)}%`
    );
  } catch (error) {
    console.error('❌ Database query failed:', error);
    throw error;
  }
}

verifyStoredRecipes()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
