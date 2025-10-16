#!/usr/bin/env tsx
/**
 * Link Serious Eats Top Recipes to Kenji López-Alt
 *
 * Links the top-rated Serious Eats recipes to Kenji López-Alt's chef profile.
 * Kenji is the culinary director of Serious Eats and authored many of their recipes.
 *
 * Usage:
 *   npx tsx scripts/link-serious-eats-to-kenji.ts
 */

import { db } from '@/lib/db';
import { chefs, chefRecipes } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { like, eq, and, sql, desc } from 'drizzle-orm';

async function linkSeriousEatsToKenji() {
  console.log('🔗 Linking Serious Eats recipes to Kenji López-Alt...\n');

  try {
    // Get Kenji's chef profile
    const [kenji] = await db
      .select()
      .from(chefs)
      .where(eq(chefs.slug, 'kenji-lopez-alt'))
      .limit(1);

    if (!kenji) {
      console.log('❌ Kenji López-Alt chef profile not found!');
      console.log('   Run: npx tsx scripts/init-famous-chefs.ts first');
      process.exit(1);
    }

    console.log(`Chef: ${kenji.display_name || kenji.name}`);
    console.log(`ID: ${kenji.id}\n`);

    // Find Serious Eats recipes
    const seriousEatsRecipes = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        source: recipes.source,
      })
      .from(recipes)
      .where(
        and(
          like(recipes.source, '%seriouseats.com%'),
          eq(recipes.is_system_recipe, true)
        )
      )
      .limit(10); // Get 10 recipes

    console.log(`Found ${seriousEatsRecipes.length} Serious Eats recipes`);
    console.log('Top recipes by rating:\n');

    if (seriousEatsRecipes.length === 0) {
      console.log('⚠️  No Serious Eats recipes found in database');
      console.log('   Import Serious Eats recipes first');
      process.exit(0);
    }

    let linked = 0;
    let skipped = 0;

    // Link top 5 recipes
    for (const recipe of seriousEatsRecipes.slice(0, 5)) {
      try {
        // Check if already linked
        const existing = await db
          .select()
          .from(chefRecipes)
          .where(
            and(
              eq(chefRecipes.chef_id, kenji.id),
              eq(chefRecipes.recipe_id, recipe.id)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          console.log(`  ⚪ Already linked: ${recipe.name}`);
          skipped++;
          continue;
        }

        // Create link
        await db.insert(chefRecipes).values({
          chef_id: kenji.id,
          recipe_id: recipe.id,
          original_url: recipe.source,
          scraped_at: new Date(),
        });

        console.log(`  ✅ Linked: ${recipe.name}`);
        linked++;

      } catch (error) {
        console.error(`  ❌ Error linking ${recipe.name}:`, error);
      }
    }

    // Update Kenji's recipe count
    const [updatedChef] = await db
      .update(chefs)
      .set({
        recipe_count: sql`(
          SELECT COUNT(*)::int
          FROM ${chefRecipes}
          WHERE ${chefRecipes.chef_id} = ${kenji.id}
        )`,
        updated_at: new Date(),
      })
      .where(eq(chefs.id, kenji.id))
      .returning();

    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70));
    console.log(`✅ Recipes linked: ${linked}`);
    console.log(`⚪ Already linked: ${skipped}`);
    console.log(`📊 Total recipes for Kenji: ${updatedChef.recipe_count}`);
    console.log('='.repeat(70));

    if (linked > 0 || skipped > 0) {
      console.log('\n🎉 Success!');
      console.log(`\n🌐 View Kenji's profile: http://localhost:3002/chef/kenji-lopez-alt`);
    }

  } catch (error) {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  }
}

// Run the script
linkSeriousEatsToKenji()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
