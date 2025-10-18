#!/usr/bin/env tsx
import 'dotenv/config';
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { eq, sql, like, or } from 'drizzle-orm';

async function checkImportStatus() {
  console.log('='.repeat(70));
  console.log('RECIPE IMPORT STATUS CHECK');
  console.log('='.repeat(70));

  // Total counts
  const total = await db.select({ count: sql`count(*)` }).from(recipes);
  const systemRecipes = await db
    .select({ count: sql`count(*)` })
    .from(recipes)
    .where(eq(recipes.is_system_recipe, true));

  console.log('\n📊 Overall Statistics:');
  console.log(`   Total recipes: ${total[0].count}`);
  console.log(`   System recipes: ${systemRecipes[0].count}`);

  // Check by source
  console.log('\n📍 Recipes by Source:');

  // Lidia Bastianich
  const lidiaRecipes = await db
    .select({ count: sql`count(*)` })
    .from(recipes)
    .where(like(recipes.source, '%lidia%'));
  console.log(`   Lidia Bastianich: ${lidiaRecipes[0].count}`);

  // Nancy Silverton
  const nancyRecipes = await db
    .select({ count: sql`count(*)` })
    .from(recipes)
    .where(like(recipes.source, '%nancy%'));
  console.log(`   Nancy Silverton: ${nancyRecipes[0].count}`);

  // Serious Eats
  const seriousEatsRecipes = await db
    .select({ count: sql`count(*)` })
    .from(recipes)
    .where(like(recipes.source, '%seriouseats%'));
  console.log(`   Serious Eats: ${seriousEatsRecipes[0].count}`);

  // Food.com
  const foodComRecipes = await db
    .select({ count: sql`count(*)` })
    .from(recipes)
    .where(like(recipes.source, '%food.com%'));
  console.log(`   Food.com: ${foodComRecipes[0].count}`);

  // Epicurious
  const epicuriousRecipes = await db
    .select({ count: sql`count(*)` })
    .from(recipes)
    .where(like(recipes.source, '%epicurious%'));
  console.log(`   Epicurious: ${epicuriousRecipes[0].count}`);

  // TheMealDB
  const mealDbRecipes = await db
    .select({ count: sql`count(*)` })
    .from(recipes)
    .where(like(recipes.source, '%themealdb%'));
  console.log(`   TheMealDB: ${mealDbRecipes[0].count}`);

  console.log('\n✅ Status check complete!\n');
  process.exit(0);
}

checkImportStatus().catch((error) => {
  console.error('Error checking import status:', error);
  process.exit(1);
});
