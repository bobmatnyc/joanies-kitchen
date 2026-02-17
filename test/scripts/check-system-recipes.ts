#!/usr/bin/env tsx
/**
 * Check System Recipes Public Visibility
 *
 * Verify all system recipes (curated content) are properly configured
 * as public, even if they don't have chef associations.
 *
 * Run: npx tsx scripts/check-system-recipes.ts
 */

import { db } from '@/lib/db/index';
import { recipes } from '@/lib/db/schema';
import { eq, isNull, and, sql } from 'drizzle-orm';

async function checkSystemRecipes() {
  console.log('🔍 Checking system recipe visibility...\n');

  try {
    // Get all system recipes
    const systemRecipes = await db.select({
      count: sql<number>`count(*)`,
      public: sql<number>`count(*) filter (where is_public = true)`,
      private: sql<number>`count(*) filter (where is_public = false)`,
      withChef: sql<number>`count(*) filter (where chef_id is not null)`,
      withoutChef: sql<number>`count(*) filter (where chef_id is null)`
    })
    .from(recipes)
    .where(eq(recipes.is_system_recipe, true));

    console.log('📊 System Recipes Overview:');
    console.log(`   Total: ${systemRecipes[0].count}`);
    console.log(`   Public: ${systemRecipes[0].public}`);
    console.log(`   Private: ${systemRecipes[0].private}`);
    console.log(`   With chef: ${systemRecipes[0].withChef}`);
    console.log(`   Without chef: ${systemRecipes[0].withoutChef}`);

    // Get system recipes without chef that are private
    const privateSystemNoChef = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        isPublic: recipes.is_public,
        userId: recipes.user_id,
        source: recipes.source
      })
      .from(recipes)
      .where(
        and(
          eq(recipes.is_system_recipe, true),
          isNull(recipes.chef_id),
          eq(recipes.is_public, false)
        )
      )
      .limit(10);

    if (privateSystemNoChef.length > 0) {
      console.log('\n⚠️  System recipes (no chef) that are PRIVATE:');
      privateSystemNoChef.forEach((recipe, idx) => {
        console.log(`   ${idx + 1}. ${recipe.name}`);
        console.log(`      ID: ${recipe.id}`);
        console.log(`      Source: ${recipe.source || 'N/A'}`);
        console.log(`      isPublic: ${recipe.isPublic}`);
      });
      console.log(`\n   Found ${privateSystemNoChef.length} private system recipes without chef attribution.`);
      console.log('   These should likely be public as well!');
    } else {
      console.log('\n✅ All system recipes without chef attribution are public.');
    }

    // Check for "Joanie" recipes specifically
    const joanieRecipes = await db
      .select({
        count: sql<number>`count(*)`,
        public: sql<number>`count(*) filter (where is_public = true)`,
        private: sql<number>`count(*) filter (where is_public = false)`,
        system: sql<number>`count(*) filter (where is_system_recipe = true)`
      })
      .from(recipes)
      .where(
        sql`${recipes.source} ilike '%joanie%' or ${recipes.name} ilike '%sunday lunch%'`
      );

    console.log('\n📊 Joanie\'s Recipes (Sunday Lunch, etc.):');
    console.log(`   Total: ${joanieRecipes[0].count}`);
    console.log(`   Public: ${joanieRecipes[0].public}`);
    console.log(`   Private: ${joanieRecipes[0].private}`);
    console.log(`   System: ${joanieRecipes[0].system}`);

    if (joanieRecipes[0].private > 0) {
      console.log('\n⚠️  Some Joanie recipes are private!');
    } else {
      console.log('\n✅ All Joanie recipes are public.');
    }

  } catch (error) {
    console.error('❌ Error checking system recipes:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run check
checkSystemRecipes();
