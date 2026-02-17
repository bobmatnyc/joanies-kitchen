import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

/**
 * Lidia Bastianich Recipe Import Script
 *
 * Imports 27 recipes from Lidia Bastianich's website.
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
  _metadata?: any;
  _validation_issues?: string[];
}

async function importLidiaRecipes() {
  console.log('Starting Lidia Bastianich recipe import...\n');

  // Get Lidia's chef ID
  const [lidiaChef] = await db
    .select()
    .from(chefs)
    .where(eq(chefs.slug, 'lidia-bastianich'))
    .limit(1);

  if (!lidiaChef) {
    console.error('Error: Lidia Bastianich chef profile not found!');
    console.error('Please run: pnpm tsx scripts/import-chefs.ts first');
    process.exit(1);
  }

  console.log(`Found chef: ${lidiaChef.name} (ID: ${lidiaChef.id})\n`);

  // Load recipe data
  const recipesPath = join(
    process.cwd(),
    'data/recipes/incoming/lidia-bastianich/recipes-transformed.json'
  );

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
      // Skip recipes with validation issues (e.g., missing ingredients/instructions)
      if (recipe._validation_issues && recipe._validation_issues.length > 0) {
        console.log(
          `⊘ Skipping "${recipe.name}" (validation issues: ${recipe._validation_issues.join(', ')})`
        );
        skipped++;
        continue;
      }

      // Check if recipe already exists by source URL
      const existing = recipe.source
        ? await db.select().from(recipes).where(eq(recipes.source, recipe.source)).limit(1)
        : [];

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
        cuisine: recipe.cuisine || 'Italian',
        tags: recipe.tags,
        images: recipe.images,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: true,
        source: recipe.source,
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
          chef_id: lidiaChef.id,
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
    .where(eq(chefs.id, lidiaChef.id));

  console.log('\n=== Import Summary ===');
  console.log(`Chef: ${lidiaChef.name}`);
  console.log(`Imported: ${imported}`);
  console.log(`Updated: ${updated}`);
  console.log(`Linked: ${linked}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total processed: ${recipeData.length}`);
}

// Run the import
importLidiaRecipes()
  .then(() => {
    console.log('\nLidia Bastianich recipe import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Recipe import failed:', error);
    process.exit(1);
  });
