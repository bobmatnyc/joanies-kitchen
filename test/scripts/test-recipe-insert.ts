#!/usr/bin/env tsx
/**
 * Test Recipe Insert
 * Debug script to test minimal recipe insertion
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { generateUniqueSlug } from '@/lib/utils/slug';
import { randomUUID } from 'node:crypto';

async function main() {
  console.log('Testing recipe insert...\n');

  // Get Alton Brown
  const [chef] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'alton-brown'))
    .limit(1);

  if (!chef) {
    console.error('Chef not found');
    process.exit(1);
  }

  console.log(`Chef: ${chef.name} (${chef.id})`);

  // Generate slug
  const slug = await generateUniqueSlug('Test Recipe French Toast');
  console.log(`Generated slug: ${slug}`);

  // Prepare minimal recipe
  const recipeId = randomUUID();
  console.log(`Generated ID: ${recipeId}`);

  try {
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        id: recipeId,
        user_id: 'system',
        chef_id: chef.id,
        name: 'Test Recipe French Toast',
        slug: slug,
        description: 'A test recipe',
        ingredients: JSON.stringify(['bread', 'eggs', 'milk']),
        instructions: JSON.stringify(['Mix ingredients', 'Cook']),
        tags: JSON.stringify(['breakfast', 'test']),
        images: JSON.stringify([]),
        is_public: true,
        is_system_recipe: true,
        source: 'https://example.com/test',
        license: 'FAIR_USE',
      })
      .returning({ id: recipes.id, slug: recipes.slug });

    console.log(`\n✓ Success! Recipe inserted:`);
    console.log(`  ID: ${newRecipe.id}`);
    console.log(`  Slug: ${newRecipe.slug}`);

    // Clean up
    await db.delete(recipes).where(eq(recipes.id, newRecipe.id));
    console.log(`\n✓ Cleanup complete`);

  } catch (error: any) {
    console.error(`\n✗ Insert failed:`);
    console.error(`  Message: ${error.message}`);
    console.error(`  Code: ${error.code}`);
    console.error(`  Detail: ${error.detail}`);
    console.error(`  Constraint: ${error.constraint}`);
    console.error(`\nFull error:`, error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
