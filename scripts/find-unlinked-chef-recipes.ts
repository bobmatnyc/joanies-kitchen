#!/usr/bin/env tsx
/**
 * Find Unlinked Chef Recipes
 *
 * Search for recipes that may belong to the 10 sustainability-focused chefs
 * but aren't linked via chef_recipes junction table.
 */

import { db } from '../src/lib/db';
import { chefSchema } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { like, or, sql } from 'drizzle-orm';

const { chefs, chefRecipes } = chefSchema;

const TARGET_CHEFS = [
  { name: 'Alton Brown', slug: 'alton-brown', patterns: ['alton', 'alton brown'] },
  { name: 'Bren Smith', slug: 'bren-smith', patterns: ['bren', 'bren smith'] },
  { name: 'Cristina Scarpaleggia', slug: 'cristina-scarpaleggia', patterns: ['cristina', 'scarpaleggia'] },
  { name: 'Dan Barber', slug: 'dan-barber', patterns: ['dan barber', 'barber'] },
  { name: 'David Zilber', slug: 'david-zilber', patterns: ['david zilber', 'zilber'] },
  { name: 'Ina Garten', slug: 'ina-garten', patterns: ['ina', 'ina garten', 'barefoot contessa'] },
  { name: 'Jeremy Fox', slug: 'jeremy-fox', patterns: ['jeremy fox'] },
  { name: 'Kirsten Shockey', slug: 'kirsten-christopher-shockey', patterns: ['shockey', 'kirsten shockey', 'christopher shockey'] },
  { name: 'Nancy Silverton', slug: 'nancy-silverton', patterns: ['nancy', 'silverton', 'nancy silverton'] },
  { name: 'Tamar Adler', slug: 'tamar-adler', patterns: ['tamar', 'adler', 'tamar adler'] },
];

async function findUnlinkedRecipes() {
  console.log('🔍 Finding Unlinked Chef Recipes\n');
  console.log('=' .repeat(80));

  for (const chef of TARGET_CHEFS) {
    console.log(`\n${chef.name} (${chef.slug}):`);
    console.log('-'.repeat(80));

    // Search for recipes by source field containing chef name patterns
    for (const pattern of chef.patterns) {
      const foundRecipes = await db
        .select({
          id: recipes.id,
          name: recipes.name,
          source: recipes.source,
          chef_id: recipes.chef_id,
          created_at: recipes.created_at,
        })
        .from(recipes)
        .where(
          or(
            sql`LOWER(${recipes.source}) LIKE LOWER(${'%' + pattern + '%'})`,
            sql`LOWER(${recipes.name}) LIKE LOWER(${'%' + pattern + '%'})`
          )
        )
        .limit(20);

      if (foundRecipes.length > 0) {
        console.log(`\nFound ${foundRecipes.length} recipes matching pattern "${pattern}":`);

        for (const recipe of foundRecipes) {
          // Check if this recipe is already in chef_recipes junction
          const isLinked = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(chefRecipes)
            .where(sql`${chefRecipes.recipe_id} = ${recipe.id}`);

          const linkedCount = isLinked[0]?.count || 0;
          const linkStatus = linkedCount > 0 ? '✅ Linked' : '❌ Not Linked';

          console.log(`   ${linkStatus} | ${recipe.name.substring(0, 60)}`);
          console.log(`              Source: ${recipe.source || '(no source)'}`);
          console.log(`              Chef ID: ${recipe.chef_id || '(null)'}`);
          console.log(`              Created: ${recipe.created_at}`);
        }

        // Count unlinked recipes for this pattern
        const unlinkedCount = (await Promise.all(
          foundRecipes.map(async (recipe) => {
            const isLinked = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(chefRecipes)
              .where(sql`${chefRecipes.recipe_id} = ${recipe.id}`);
            return isLinked[0]?.count || 0;
          })
        )).filter(count => count === 0).length;

        console.log(`\n   Summary: ${unlinkedCount} unlinked / ${foundRecipes.length} total`);

        // Don't search other patterns if we found recipes
        if (foundRecipes.length > 5) break;
      }
    }
  }

  // Summary of all unlinked recipes that might belong to target chefs
  console.log('\n' + '='.repeat(80));
  console.log('📊 OVERALL SUMMARY\n');

  // Count recipes without chef_id and without junction table link
  const orphanedRecipes = await db
    .select({
      id: recipes.id,
      name: recipes.name,
      source: recipes.source,
      created_at: recipes.created_at,
    })
    .from(recipes)
    .where(sql`${recipes.chef_id} IS NULL`)
    .limit(10);

  console.log(`Sample of recipes with no chef_id set (showing 10):\n`);
  for (const recipe of orphanedRecipes) {
    // Check if in junction table
    const isLinked = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chefRecipes)
      .where(sql`${chefRecipes.recipe_id} = ${recipe.id}`);

    const linkedCount = isLinked[0]?.count || 0;
    const linkStatus = linkedCount > 0 ? '✅' : '❌';

    console.log(`${linkStatus} ${recipe.name.substring(0, 60)}`);
    console.log(`   Source: ${recipe.source || '(no source)'}`);
    console.log(`   Created: ${recipe.created_at}\n`);
  }

  console.log('='.repeat(80));
  console.log('✅ Search Complete\n');

  process.exit(0);
}

findUnlinkedRecipes().catch((error) => {
  console.error('Fatal error during search:', error);
  process.exit(1);
});
