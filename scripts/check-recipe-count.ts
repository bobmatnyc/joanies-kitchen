#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { sql, eq, count } from 'drizzle-orm';

async function checkRecipeCount() {
  console.log('\n=== Recipe Database Statistics ===\n');

  try {
    // Total recipes
    const totalResult = await db.select({ count: count() }).from(recipes);
    const total = totalResult[0]?.count || 0;
    console.log(`Total Recipes: ${total}`);

    // System recipes
    const systemResult = await db
      .select({ count: count() })
      .from(recipes)
      .where(eq(recipes.isSystemRecipe, true));
    const systemCount = systemResult[0]?.count || 0;
    console.log(`System Recipes: ${systemCount}`);

    // User recipes
    const userCount = total - systemCount;
    console.log(`User Recipes: ${userCount}`);

    // Recipes by source
    console.log('\n=== Recipes by Source ===\n');
    const sources = await db
      .select({
        source: recipes.source,
        count: count(),
      })
      .from(recipes)
      .groupBy(recipes.source)
      .orderBy(sql`count DESC`);

    sources.forEach(s => {
      console.log(`${s.source || 'NULL'}: ${s.count}`);
    });

    // Quality ratings distribution
    console.log('\n=== Quality Rating Distribution ===\n');
    const ratingDistribution = await db
      .select({
        rating: recipes.systemRating,
        count: count(),
      })
      .from(recipes)
      .where(sql`${recipes.systemRating} IS NOT NULL`)
      .groupBy(recipes.systemRating)
      .orderBy(recipes.systemRating);

    ratingDistribution.forEach(r => {
      console.log(`${r.rating}/5.0: ${r.count} recipes`);
    });

    console.log('\n' + '='.repeat(50));
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  }

  process.exit(0);
}

checkRecipeCount();
