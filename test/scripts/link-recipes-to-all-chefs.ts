#!/usr/bin/env tsx

/**
 * Link Existing Recipes to All Famous Chefs
 *
 * This script links recipes from our database to the appropriate famous chefs
 * based on known source URLs and patterns.
 */

import { and, eq, like, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefRecipes, chefs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';

// Chef-to-source mapping
const CHEF_SOURCES = [
  {
    slug: 'kenji-lopez-alt',
    name: 'J. Kenji López-Alt',
    sources: ['%seriouseats.com%', '%kenjilopezalt.com%'],
  },
  {
    slug: 'gordon-ramsay',
    name: 'Gordon Ramsay',
    sources: ['%gordonramsay.com%', '%gordonramsayrestaurants.com%'],
  },
  {
    slug: 'ina-garten',
    name: 'Ina Garten',
    sources: ['%barefootcontessa.com%', '%foodnetwork.com%ina%'],
  },
  {
    slug: 'jacques-pepin',
    name: 'Jacques Pépin',
    sources: ['%jacquespepin.net%', '%kqed.org%jacques%'],
  },
  {
    slug: 'yotam-ottolenghi',
    name: 'Yotam Ottolenghi',
    sources: ['%ottolenghi.co.uk%', '%theguardian.com%yotam%'],
  },
  {
    slug: 'nigella-lawson',
    name: 'Nigella Lawson',
    sources: ['%nigella.com%'],
  },
  {
    slug: 'alton-brown',
    name: 'Alton Brown',
    sources: ['%altonbrown.com%', '%foodnetwork.com%alton%'],
  },
  {
    slug: 'madhur-jaffrey',
    name: 'Madhur Jaffrey',
    sources: ['%madhurjaffrey.com%'],
  },
  {
    slug: 'samin-nosrat',
    name: 'Samin Nosrat',
    sources: ['%ciaosamin.com%'],
  },
];

interface ChefStats {
  chef: string;
  recipesFound: number;
  alreadyLinked: number;
  newlyLinked: number;
  errors: number;
}

async function linkRecipesToChefs() {
  console.log('🔗 Linking recipes to famous chefs...\n');

  const stats: ChefStats[] = [];
  let totalLinked = 0;

  for (const chefSource of CHEF_SOURCES) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Chef: ${chefSource.name}`);
    console.log(`Sources: ${chefSource.sources.join(', ')}`);
    console.log('='.repeat(70));

    try {
      // Get chef from database
      const [chef] = await db.select().from(chefs).where(eq(chefs.slug, chefSource.slug)).limit(1);

      if (!chef) {
        console.log(`⚠️  Chef not found: ${chefSource.slug}`);
        continue;
      }

      // Build OR conditions for all source patterns
      const sourceConditions = chefSource.sources.map((source) => like(recipes.source, source));

      // Find recipes matching any of the source patterns
      const matchingRecipes = await db
        .select({
          id: recipes.id,
          name: recipes.name,
          source: recipes.source,
        })
        .from(recipes)
        .where(and(or(...sourceConditions), eq(recipes.is_system_recipe, true)))
        .limit(20); // Limit to 20 recipes per chef

      console.log(`\n📊 Found ${matchingRecipes.length} matching recipes`);

      let alreadyLinked = 0;
      let newlyLinked = 0;
      let errors = 0;

      for (const recipe of matchingRecipes) {
        try {
          // Check if already linked
          const existing = await db
            .select()
            .from(chefRecipes)
            .where(and(eq(chefRecipes.chef_id, chef.id), eq(chefRecipes.recipe_id, recipe.id)))
            .limit(1);

          if (existing.length > 0) {
            console.log(`  ⚪ ${recipe.name.substring(0, 50)}... (already linked)`);
            alreadyLinked++;
            continue;
          }

          // Create link
          await db.insert(chefRecipes).values({
            chef_id: chef.id,
            recipe_id: recipe.id,
            original_url: recipe.source,
            scraped_at: new Date(),
          });

          console.log(`  ✅ ${recipe.name.substring(0, 50)}...`);
          newlyLinked++;
          totalLinked++;
        } catch (error) {
          console.error(`  ❌ Error linking ${recipe.name}:`, error);
          errors++;
        }
      }

      // Update chef's recipe count
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

      // Get final count
      const [updatedChef] = await db.select().from(chefs).where(eq(chefs.id, chef.id)).limit(1);

      stats.push({
        chef: chefSource.name,
        recipesFound: matchingRecipes.length,
        alreadyLinked,
        newlyLinked,
        errors,
      });

      console.log(`\n📈 Summary for ${chefSource.name}:`);
      console.log(`   Total recipes found: ${matchingRecipes.length}`);
      console.log(`   Already linked: ${alreadyLinked}`);
      console.log(`   Newly linked: ${newlyLinked}`);
      console.log(`   Total recipes for chef: ${updatedChef.recipe_count}`);
    } catch (error) {
      console.error(`\n❌ Error processing ${chefSource.name}:`, error);
    }
  }

  // Print final summary
  console.log('\n\n');
  console.log('═'.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('═'.repeat(70));

  stats.forEach((stat) => {
    console.log(`\n${stat.chef}:`);
    console.log(`  Recipes found: ${stat.recipesFound}`);
    console.log(`  Already linked: ${stat.alreadyLinked}`);
    console.log(`  Newly linked: ${stat.newlyLinked}`);
    if (stat.errors > 0) {
      console.log(`  Errors: ${stat.errors}`);
    }
  });

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Total recipes linked across all chefs: ${totalLinked}`);
  console.log('═'.repeat(70));

  console.log('\n🎉 Success! Recipe linking complete.');
  console.log(`\n🌐 View chefs: http://localhost:3002/discover/chefs`);
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
