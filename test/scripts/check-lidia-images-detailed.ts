#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';

async function main() {
  console.log('Checking Lidia Bastianich recipes (via chef_recipes join)...\n');

  // Find Lidia
  const [lidia] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'lidia-bastianich'))
    .limit(1);

  if (!lidia) {
    console.log('❌ Lidia not found');
    process.exit(1);
  }

  console.log(`Chef: ${lidia.name || lidia.display_name}`);
  console.log(`ID: ${lidia.id}`);
  console.log(`Recipe Count (from chef): ${lidia.recipe_count || 0}\n`);

  // Get recipes via chef_recipes join
  const lidiaRecipes = await db
    .select({
      recipe: recipes,
    })
    .from(chefRecipes)
    .innerJoin(recipes, eq(chefRecipes.recipe_id, recipes.id))
    .where(eq(chefRecipes.chef_id, lidia.id));

  console.log(`Total recipes (via join): ${lidiaRecipes.length}\n`);

  let withImages = 0;
  let withoutImages = 0;

  const samplesWithout: string[] = [];
  const samplesWith: string[] = [];

  for (const { recipe } of lidiaRecipes) {
    const hasImage =
      recipe.images && recipe.images !== '[]' && recipe.images !== '' && recipe.images !== 'null';

    if (hasImage) {
      withImages++;
      if (samplesWith.length < 3) {
        samplesWith.push(`${recipe.name} → ${recipe.images}`);
      }
    } else {
      withoutImages++;
      if (samplesWithout.length < 5) {
        samplesWithout.push(recipe.name);
      }
    }
  }

  console.log(`✅ Recipes WITH images: ${withImages}`);
  console.log(`❌ Recipes WITHOUT images: ${withoutImages}\n`);

  if (samplesWith.length > 0) {
    console.log('Sample recipes WITH images:');
    samplesWith.forEach((s) => console.log(`   ${s}`));
    console.log('');
  }

  if (samplesWithout.length > 0) {
    console.log('Sample recipes WITHOUT images:');
    samplesWithout.forEach((s) => console.log(`   - ${s}`));
    if (withoutImages > samplesWithout.length) {
      console.log(`   ... and ${withoutImages - samplesWithout.length} more\n`);
    }
  }

  if (withoutImages === 0) {
    console.log('🎉 All Lidia recipes have images!');
  } else {
    console.log(
      `\n💡 Run this command to generate ${withoutImages} images:\n   npm run chef:generate:lidia-images`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
