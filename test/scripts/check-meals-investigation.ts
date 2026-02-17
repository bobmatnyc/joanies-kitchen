#!/usr/bin/env tsx
import { db } from '@/lib/db';
import { meals } from '@/lib/db/schema';
import { chefs } from '@/lib/db/chef-schema';
import { sql, eq, or, isNull } from 'drizzle-orm';

async function investigate() {
  console.log('=== MEALS INVESTIGATION ===\n');

  // Check meals count
  const mealsCount = await db.select({ count: sql<number>`count(*)` }).from(meals);
  console.log('Total meals:', mealsCount[0]?.count || 0);

  // Sample meals
  const sampleMeals = await db.select().from(meals).limit(5);
  console.log('\nSample meals:', sampleMeals.length);

  if (sampleMeals.length > 0) {
    for (const meal of sampleMeals) {
      console.log(`\n- ${meal.name}`);
      console.log(`  ID: ${meal.id}`);
      console.log(`  User: ${meal.user_id}`);
      console.log(`  Created: ${meal.created_at}`);
    }
  } else {
    console.log('\n⚠️ NO MEALS FOUND IN DATABASE');
  }

  // Check chefs with 0 recipes
  console.log('\n\n=== CHEFS WITH 0 RECIPES ===');
  const chefsNoRecipes = await db.select({
    id: chefs.id,
    displayName: chefs.displayName,
    slug: chefs.slug,
    recipeCount: chefs.recipeCount
  }).from(chefs).where(or(eq(chefs.recipeCount, 0), isNull(chefs.recipeCount)));

  console.log(`\nChefs with 0 recipes: ${chefsNoRecipes.length}`);
  for (const chef of chefsNoRecipes) {
    console.log(`- ${chef.slug} (${chef.displayName})`);
  }
}

investigate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
