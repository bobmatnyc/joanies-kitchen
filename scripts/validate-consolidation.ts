#!/usr/bin/env tsx
/**
 * Validation script for ingredient consolidation
 */

import { db, cleanup } from './db-with-transactions';
import { ingredients, recipeIngredients } from '../src/lib/db/ingredients-schema';
import { sql } from 'drizzle-orm';

async function validate() {
  console.log('\n🔍 Validating Ingredient Consolidation...\n');

  // 1. Check ingredient count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(ingredients);
  console.log(`✅ Total ingredients: ${countResult[0].count}`);

  // 2. Check for ingredients with aliases
  const aliasResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(ingredients)
    .where(sql`aliases IS NOT NULL AND aliases != '[]'`);
  console.log(`✅ Ingredients with aliases: ${aliasResult[0].count}`);

  // 3. Check for orphaned recipe_ingredients (should be 0)
  const orphanedResult = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM recipe_ingredients ri
    LEFT JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE i.id IS NULL
  `);
  const orphanedCount = orphanedResult.rows[0]?.count || 0;
  console.log(
    orphanedCount === 0
      ? `✅ No orphaned recipe_ingredients`
      : `❌ Found ${orphanedCount} orphaned recipe_ingredients`
  );

  // 4. Sample consolidated ingredients with high usage
  console.log('\n📊 Top 10 Consolidated Ingredients:\n');
  const topIngredients = await db
    .select({
      name: ingredients.name,
      aliases: ingredients.aliases,
      usage_count: ingredients.usage_count,
    })
    .from(ingredients)
    .where(sql`aliases IS NOT NULL AND aliases != '[]'`)
    .orderBy(sql`usage_count DESC`)
    .limit(10);

  for (const ingredient of topIngredients) {
    const aliases = JSON.parse(ingredient.aliases || '[]');
    console.log(`   ${ingredient.name} (${ingredient.usage_count} uses)`);
    console.log(`      Aliases: ${aliases.join(', ')}`);
  }

  console.log('\n✅ Validation Complete!\n');

  await cleanup();
  process.exit(0);
}

validate().catch(async (error) => {
  console.error('❌ Validation failed:', error);
  await cleanup();
  process.exit(1);
});
