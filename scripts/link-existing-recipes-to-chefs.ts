#!/usr/bin/env tsx

/**
 * Link Existing Recipes to Famous Chefs
 *
 * This script links recipes already in the database to famous chefs based on:
 * 1. Recipe source URLs (e.g., seriouseats.com/kenji recipes → Kenji)
 * 2. Recipe author metadata
 * 3. Manual mappings for known chefs
 *
 * Usage:
 *   npx tsx scripts/link-existing-recipes-to-chefs.ts
 */

import { and, eq, like, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

interface ChefMapping {
  chefSlug: string;
  sourcePatterns: string[]; // URL patterns to match
  limit: number; // Max recipes to link per chef
}

/**
 * Chef-to-recipe source mappings
 * These patterns identify recipes that belong to each chef
 */
const CHEF_MAPPINGS: ChefMapping[] = [
  {
    chefSlug: 'kenji-lopez-alt',
    sourcePatterns: ['%seriouseats.com%kenji%', '%seriouseats.com/recipes%lopez-alt%', '%/kenji-%'],
    limit: 5,
  },
  {
    chefSlug: 'ina-garten',
    sourcePatterns: ['%barefootcontessa.com%', '%foodnetwork.com%ina-garten%'],
    limit: 5,
  },
  {
    chefSlug: 'gordon-ramsay',
    sourcePatterns: ['%gordonramsay.com%', '%/gordon-ramsay-%'],
    limit: 5,
  },
  {
    chefSlug: 'yotam-ottolenghi',
    sourcePatterns: ['%ottolenghi.co.uk%', '%/ottolenghi-%'],
    limit: 5,
  },
  {
    chefSlug: 'samin-nosrat',
    sourcePatterns: ['%ciaosamin.com%', '%/samin-nosrat-%'],
    limit: 5,
  },
  {
    chefSlug: 'alton-brown',
    sourcePatterns: ['%altonbrown.com%', '%/alton-brown-%'],
    limit: 5,
  },
  {
    chefSlug: 'nigella-lawson',
    sourcePatterns: ['%nigella.com%', '%/nigella-%'],
    limit: 5,
  },
  {
    chefSlug: 'jacques-pepin',
    sourcePatterns: ['%jacquespepin.net%', '%/jacques-pepin-%'],
    limit: 5,
  },
  {
    chefSlug: 'madhur-jaffrey',
    sourcePatterns: ['%madhurjaffrey.com%', '%/madhur-jaffrey-%'],
    limit: 5,
  },
];

async function linkRecipesToChefs() {
  console.log('🔗 Linking existing recipes to famous chefs...\n');

  let totalLinked = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const mapping of CHEF_MAPPINGS) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Processing: ${mapping.chefSlug}`);
    console.log('='.repeat(70));

    try {
      // Get chef ID
      const [chef] = await db.select().from(chefs).where(eq(chefs.slug, mapping.chefSlug)).limit(1);

      if (!chef) {
        console.log(`⚠️  Chef not found: ${mapping.chefSlug}`);
        totalFailed++;
        continue;
      }

      console.log(`Chef: ${chef.display_name || chef.name} (ID: ${chef.id})`);

      // Find matching recipes
      let matchingRecipes: any[] = [];

      for (const pattern of mapping.sourcePatterns) {
        const foundRecipes = await db
          .select({
            id: recipes.id,
            name: recipes.name,
            source: recipes.source,
          })
          .from(recipes)
          .where(
            and(
              like(recipes.source, pattern),
              eq(recipes.is_system_recipe, true) // Only system recipes
            )
          )
          .limit(mapping.limit);

        matchingRecipes.push(...foundRecipes);

        if (matchingRecipes.length >= mapping.limit) {
          break;
        }
      }

      // Remove duplicates
      matchingRecipes = matchingRecipes
        .filter((recipe, index, self) => index === self.findIndex((r) => r.id === recipe.id))
        .slice(0, mapping.limit);

      console.log(`Found ${matchingRecipes.length} matching recipes`);

      if (matchingRecipes.length === 0) {
        console.log(`ℹ️  No matching recipes found for patterns:`);
        mapping.sourcePatterns.forEach((p) => console.log(`   - ${p}`));
        totalSkipped++;
        continue;
      }

      // Link recipes to chef
      let linked = 0;
      let skipped = 0;

      for (const recipe of matchingRecipes) {
        try {
          // Check if already linked
          const existing = await db
            .select()
            .from(chefRecipes)
            .where(and(eq(chefRecipes.chef_id, chef.id), eq(chefRecipes.recipe_id, recipe.id)))
            .limit(1);

          if (existing.length > 0) {
            skipped++;
            continue;
          }

          // Create link
          await db.insert(chefRecipes).values({
            chef_id: chef.id,
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

      // Update chef recipe count
      await db
        .update(chefs)
        .set({
          recipe_count: sql`(
            SELECT COUNT(*)::int
            FROM ${chefRecipes}
            WHERE ${chefRecipes.chef_id} = ${chef.id}
          )`,
          updated_at: new Date(),
        })
        .where(eq(chefs.id, chef.id));

      console.log(`\n✨ Summary for ${chef.name}:`);
      console.log(`   Linked: ${linked}`);
      console.log(`   Skipped (already linked): ${skipped}`);
      console.log(`   Total recipes for chef: ${linked + skipped}`);

      totalLinked += linked;
      totalSkipped += skipped;
    } catch (error) {
      console.error(`❌ Error processing ${mapping.chefSlug}:`, error);
      totalFailed++;
    }
  }

  // Final summary
  console.log('\n');
  console.log('═'.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✅ Total recipes linked: ${totalLinked}`);
  console.log(`⚠️  Chefs skipped (no recipes): ${totalSkipped}`);
  console.log(`❌ Chefs failed: ${totalFailed}`);
  console.log('═'.repeat(70));

  if (totalLinked > 0) {
    console.log('\n🎉 Successfully linked recipes to chefs!');
    console.log('\n📍 View results:');
    console.log('   - All chefs: http://localhost:3002/discover/chefs');
    console.log('   - Individual chef pages: /chef/{slug}');
  }
}

// Run the script
linkRecipesToChefs()
  .then(() => {
    console.log('\n✅ Script completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
