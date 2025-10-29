#!/usr/bin/env tsx
/**
 * Show sample of Lidia Bastianich recipes with images
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

async function main() {
  const [lidia] = await db.select().from(chefs).where(eq(chefs.slug, 'lidia-bastianich')).limit(1);

  if (!lidia) {
    console.error('❌ Lidia not found');
    process.exit(1);
  }

  const recipesResult = await db
    .select({ recipe: recipes })
    .from(chefRecipes)
    .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(eq(chefRecipes.chef_id, lidia.id))
    .limit(5);

  console.log('\n📸 Sample of Lidia Bastianich Recipes:\n');
  console.log('='.repeat(80));

  recipesResult.forEach((r) => {
    const recipe = r.recipe;
    let images: string[] = [];
    let instructions: string[] = [];

    try {
      images = JSON.parse(recipe.images || '[]');
    } catch {}

    try {
      instructions = JSON.parse(recipe.instructions || '[]');
    } catch {}

    console.log(`\n${recipe.name}`);
    console.log(`  Image URL: ${images[0] || 'None'}`);
    console.log(`  Instructions: ${instructions.length} steps`);
    if (instructions.length > 0) {
      const firstStep = instructions[0].substring(0, 100);
      console.log(`  First step: ${firstStep}${instructions[0].length > 100 ? '...' : ''}`);
    }
  });

  console.log(`\n${'='.repeat(80)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
