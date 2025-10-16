#!/usr/bin/env tsx
/**
 * Simple test for similar recipes feature
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { getRecipeEmbedding, findSimilarRecipes } from '../src/lib/db/embeddings';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testSimilarRecipes() {
  console.log('Testing Similar Recipes Feature...\n');

  // Get a recipe with embedding
  const result = await db.execute(sql`
    SELECT r.id, r.name, r.cuisine
    FROM recipes r
    INNER JOIN recipe_embeddings e ON r.id = e.recipe_id
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    console.log('❌ No recipes with embeddings found');
    process.exit(1);
  }

  const testRecipe = result.rows[0] as { id: string; name: string; cuisine: string };
  console.log(`Testing with: "${testRecipe.name}" (${testRecipe.cuisine})\n`);

  // Get its embedding
  const embedding = await getRecipeEmbedding(testRecipe.id);
  if (!embedding) {
    console.log('❌ Could not retrieve embedding');
    process.exit(1);
  }

  // Find similar recipes
  const similar = await findSimilarRecipes(embedding.embedding, 5, 0.5);

  console.log(`Found ${similar.length} similar recipes:\n`);
  similar.forEach((r, i) => {
    const recipeName = (r as any).recipe_name || 'Unknown';
    const similarity = (r.similarity * 100).toFixed(1);
    console.log(`  ${i + 1}. ${recipeName} (${similarity}% similar)`);
  });

  if (similar.length > 0) {
    console.log('\n✅ Similar recipes feature is WORKING!');
  } else {
    console.log('\n⚠️  No similar recipes found (may need more embeddings)');
  }

  process.exit(0);
}

testSimilarRecipes().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
