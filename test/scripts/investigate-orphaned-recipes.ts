#!/usr/bin/env tsx

/**
 * Investigate Orphaned Recipes
 *
 * Check if recipes exist in the database but are not linked to chefs
 * via the chef_recipes junction table.
 */

import { like, sql } from 'drizzle-orm';
import { chefSchema, db } from '@/lib/db';

const { chefs, chefRecipes } = chefSchema;

import { recipes } from '@/lib/db/schema';

async function investigateOrphanedRecipes() {
  console.log('🔍 Investigating Orphaned Recipes\n');
  console.log('='.repeat(80));

  // 1. Check total recipes in database
  const totalRecipesResult = await db.select({ count: sql<number>`count(*)::int` }).from(recipes);
  const totalRecipes = totalRecipesResult[0]?.count || 0;
  console.log(`\nTotal recipes in database: ${totalRecipes}`);

  // 2. Check recipes with chef_id set (direct foreign key)
  const recipesWithChefIdResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes)
    .where(sql`${recipes.chef_id} IS NOT NULL`);
  const recipesWithChefId = recipesWithChefIdResult[0]?.count || 0;
  console.log(`Recipes with chef_id set: ${recipesWithChefId}`);

  // 3. Check recipes in chef_recipes junction table
  const recipesInJunctionResult = await db
    .select({ count: sql<number>`count(DISTINCT ${chefRecipes.recipe_id})::int` })
    .from(chefRecipes);
  const recipesInJunction = recipesInJunctionResult[0]?.count || 0;
  console.log(`Recipes in chef_recipes junction table: ${recipesInJunction}`);

  // 4. Look for recipes from sustainability-focused chefs by source field
  console.log(`\n${'='.repeat(80)}`);
  console.log('Searching for recipes by chef name in source field:\n');

  const chefNames = [
    'Alton Brown',
    'Bren Smith',
    'Cristina Scarpaleggia',
    'Dan Barber',
    'David Zilber',
    'Ina Garten',
    'Jeremy Fox',
    'Kirsten Shockey',
    'Christopher Shockey',
    'Nancy Silverton',
    'Tamar Adler',
  ];

  for (const chefName of chefNames) {
    const recipesBySourceResult = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        source: recipes.source,
        chef_id: recipes.chef_id,
      })
      .from(recipes)
      .where(like(recipes.source, `%${chefName}%`))
      .limit(5);

    if (recipesBySourceResult.length > 0) {
      console.log(`\n${chefName} (${recipesBySourceResult.length} found via source field):`);
      recipesBySourceResult.forEach((recipe, idx) => {
        const hasChefId = recipe.chef_id ? '✅' : '❌';
        console.log(`   ${idx + 1}. ${recipe.name}`);
        console.log(`      Source: ${recipe.source}`);
        console.log(`      Has chef_id: ${hasChefId} ${recipe.chef_id || '(null)'}`);
      });
    }
  }

  // 5. Check if recipes were imported recently (last 24 hours)
  console.log(`\n${'='.repeat(80)}`);
  console.log('Recent recipe imports (last 24 hours):\n');

  const recentRecipesResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(recipes)
    .where(sql`${recipes.created_at} >= NOW() - INTERVAL '24 hours'`);

  const recentCount = recentRecipesResult[0]?.count || 0;
  console.log(`Recipes created in last 24 hours: ${recentCount}`);

  if (recentCount > 0) {
    const recentSample = await db
      .select({
        name: recipes.name,
        source: recipes.source,
        chef_id: recipes.chef_id,
        created_at: recipes.created_at,
      })
      .from(recipes)
      .where(sql`${recipes.created_at} >= NOW() - INTERVAL '24 hours'`)
      .limit(10);

    console.log('\nSample of recent recipes:');
    recentSample.forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.name}`);
      console.log(`      Source: ${recipe.source}`);
      console.log(`      Chef ID: ${recipe.chef_id || '(null)'}`);
      console.log(`      Created: ${recipe.created_at}`);
    });
  }

  // 6. List all chefs in database
  console.log(`\n${'='.repeat(80)}`);
  console.log('All chefs in database:\n');

  const allChefs = await db
    .select({
      id: chefs.id,
      name: chefs.name,
      slug: chefs.slug,
      recipe_count: chefs.recipe_count,
    })
    .from(chefs);

  allChefs.forEach((chef) => {
    console.log(`   - ${chef.name} (${chef.slug}) - recipe_count: ${chef.recipe_count}`);
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ Investigation Complete\n');

  process.exit(0);
}

investigateOrphanedRecipes().catch((error) => {
  console.error('Fatal error during investigation:', error);
  process.exit(1);
});
