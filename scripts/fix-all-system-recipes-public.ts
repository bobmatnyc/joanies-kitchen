#!/usr/bin/env tsx
/**
 * Fix ALL System Recipes Public Visibility
 *
 * CRITICAL FIX: Makes ALL system recipes publicly accessible
 *
 * System recipes include:
 * - Chef-attributed recipes (already fixed)
 * - Imported recipes from food.com and other sources
 * - Joanie's curated recipes
 *
 * All system/curated content should be public by default.
 *
 * Run: npx tsx scripts/fix-all-system-recipes-public.ts
 */

import { db } from '../src/lib/db/index';
import { recipes } from '../src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function fixAllSystemRecipesPublic() {
  console.log('🔍 Fixing ALL system recipes to be public...\n');

  try {
    // Step 1: Get current state
    const beforeStats = await db.select({
      total: sql<number>`count(*)`,
      public: sql<number>`count(*) filter (where is_public = true)`,
      private: sql<number>`count(*) filter (where is_public = false)`
    })
    .from(recipes)
    .where(eq(recipes.is_system_recipe, true));

    console.log('📊 BEFORE Fix:');
    console.log(`   Total system recipes: ${beforeStats[0].total}`);
    console.log(`   Public: ${beforeStats[0].public}`);
    console.log(`   Private: ${beforeStats[0].private}`);

    if (beforeStats[0].private === 0) {
      console.log('\n✅ All system recipes are already public. No fix needed!');
      process.exit(0);
    }

    // Step 2: Fix - Make all system recipes public
    console.log(`\n🔧 Updating ${beforeStats[0].private} private system recipes...`);

    const updateResult = await db.update(recipes)
      .set({
        is_public: true,
        updated_at: new Date()
      })
      .where(
        and(
          eq(recipes.is_system_recipe, true),
          eq(recipes.is_public, false)
        )
      )
      .returning({ id: recipes.id, name: recipes.name });

    console.log(`✅ Updated ${updateResult.length} system recipes to be public`);

    // Step 3: Verify
    const afterStats = await db.select({
      total: sql<number>`count(*)`,
      public: sql<number>`count(*) filter (where is_public = true)`,
      private: sql<number>`count(*) filter (where is_public = false)`
    })
    .from(recipes)
    .where(eq(recipes.is_system_recipe, true));

    console.log('\n📊 AFTER Fix:');
    console.log(`   Total system recipes: ${afterStats[0].total}`);
    console.log(`   Public: ${afterStats[0].public} (${((afterStats[0].public/afterStats[0].total)*100).toFixed(1)}%)`);
    console.log(`   Private: ${afterStats[0].private}`);

    if (afterStats[0].private === 0) {
      console.log('\n🎉 SUCCESS! All system recipes are now public and accessible without sign-in.');
      console.log('   This includes:');
      console.log('   - Chef-attributed recipes (117)');
      console.log('   - Imported food.com recipes');
      console.log('   - Joanie\'s curated recipes');
      console.log('   - All other system/curated content');
    } else {
      console.log(`\n⚠️  WARNING: Still have ${afterStats[0].private} private system recipes!`);
    }

    // Sample some of the updated recipes
    console.log('\n📋 Sample of updated recipes (first 10):');
    updateResult.slice(0, 10).forEach((recipe, idx) => {
      console.log(`   ${idx + 1}. ${recipe.name}`);
    });

    if (updateResult.length > 10) {
      console.log(`   ... and ${updateResult.length - 10} more`);
    }

  } catch (error) {
    console.error('❌ Error fixing system recipes:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the fix
fixAllSystemRecipesPublic();
