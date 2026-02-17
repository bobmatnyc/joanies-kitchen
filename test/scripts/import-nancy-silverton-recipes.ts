import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

/**
 * Nancy Silverton Recipe Import Script
 *
 * Imports 25 recipes from Nancy Silverton (via Food & Wine).
 * Links recipes to chef profile and marks as system recipes.
 */

interface RecipeData {
  id: string;
  user_id: string;
  chef_id: string | null;
  name: string;
  description: string | null;
  ingredients: string;
  instructions: string;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  difficulty: string | null;
  cuisine: string | null;
  tags: string;
  images: string;
  is_ai_generated: boolean;
  is_public: boolean;
  is_system_recipe: boolean;
  source: string | null;
  slug?: string;
  _metadata?: any;
}

async function importNancyRecipes() {
  console.log('Starting Nancy Silverton recipe import...\n');

  // Get Nancy's chef ID
  const [nancyChef] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'nancy-silverton'))
    .limit(1);

  if (!nancyChef) {
    console.error('Error: Nancy Silverton chef profile not found!');
    console.error('Please run: pnpm tsx scripts/import-chefs.ts first');
    process.exit(1);
  }

  console.log(`Found chef: ${nancyChef.name} (ID: ${nancyChef.id})\n`);

  // Load recipe data
  const recipesPath = join(process.cwd(), 'data/recipes/incoming/nancy-silverton/transformed.json');

  let recipeData: RecipeData[];
  try {
    const fileContent = readFileSync(recipesPath, 'utf-8');
    recipeData = JSON.parse(fileContent);
  } catch (error) {
    console.error('Error loading recipe data:', error);
    process.exit(1);
  }

  console.log(`Loaded ${recipeData.length} recipes from file\n`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let linked = 0;

  for (const recipe of recipeData) {
    try {
      // Check if recipe already exists by source URL
      const existing = recipe.source
        ? await db.select().from(recipes).where(eq(recipes.source, recipe.source)).limit(1)
        : [];

      // Generate slug from metadata if available
      const slug = recipe._metadata?.slug || recipe.slug || null;

      const recipeRecord = {
        user_id: 'system',
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        cook_time: recipe.cook_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty as 'easy' | 'medium' | 'hard' | null,
        cuisine: recipe.cuisine || 'American',
        tags: recipe.tags,
        images: recipe.images,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: true,
        source: recipe.source,
        slug: slug,
        updated_at: new Date(),
      };

      let recipeId: string;

      if (existing.length > 0) {
        // Update existing recipe
        await db.update(recipes).set(recipeRecord).where(eq(recipes.id, existing[0].id));

        recipeId = existing[0].id;
        console.log(`✓ Updated: ${recipe.name}`);
        updated++;
      } else {
        // Insert new recipe
        await db.insert(recipes).values({
          ...recipeRecord,
          id: recipe.id,
        });
        recipeId = recipe.id;
        console.log(`✓ Imported: ${recipe.name}`);
        imported++;
      }

      // Link recipe to chef
      const existingLink = await db
        .select()
        .from(chefRecipes)
        .where(eq(chefRecipes.recipe_id, recipeId))
        .limit(1);

      if (existingLink.length === 0) {
        await db.insert(chefRecipes).values({
          chef_id: nancyChef.id,
          recipe_id: recipeId,
          original_url: recipe.source || undefined,
          scraped_at: recipe._metadata?.scraped_at
            ? new Date(recipe._metadata.scraped_at)
            : new Date(),
        });
        linked++;
      }
    } catch (error) {
      console.error(`✗ Error importing "${recipe.name}":`, error);
      skipped++;
    }
  }

  // Update chef recipe count
  await db
    .update(chefs)
    .set({
      recipe_count: imported + updated - skipped,
      updated_at: new Date(),
    })
    .where(eq(chefs.id, nancyChef.id));

  console.log('\n=== Import Summary ===');
  console.log(`Chef: ${nancyChef.name}`);
  console.log(`Imported: ${imported}`);
  console.log(`Updated: ${updated}`);
  console.log(`Linked: ${linked}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total processed: ${recipeData.length}`);
}

// Run the import
importNancyRecipes()
  .then(() => {
    console.log('\nNancy Silverton recipe import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Recipe import failed:', error);
    process.exit(1);
  });
