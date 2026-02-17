#!/usr/bin/env tsx

/**
 * Find Chefs Needing Recipe Scraping
 *
 * Purpose: Identify active chefs with zero recipes and prioritize them for scraping
 *
 * Criteria:
 * - Active and verified chefs
 * - recipe_count = 0 or no associated recipes in chef_recipes table
 * - Prioritize sustainable/highlighted chefs
 * - Must have website URLs for scraping
 *
 * Output:
 * - List of chefs without recipes
 * - Their websites and scraping potential
 * - Recommendations for recipe count to scrape
 */

import { and, eq, or, sql } from 'drizzle-orm';
import { chefRecipes, chefs } from '@/lib/db/chef-schema.js';
import { db } from '@/lib/db/index.js';

interface ChefWithRecipeInfo {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  bio: string | null;
  website: string | null;
  specialties: string[];
  is_verified: boolean;
  is_active: boolean;
  recipe_count: number;
  actual_recipe_count: number; // From chef_recipes table
}

interface PrioritizedChef extends ChefWithRecipeInfo {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  priorityScore: number;
  scrapingRecommendation: {
    recipesToScrape: number;
    rationale: string;
  };
  sustainabilityTags: string[];
}

const SUSTAINABILITY_KEYWORDS = [
  'sustainability',
  'sustainable',
  'zero-waste',
  'food waste',
  'waste',
  'eco',
  'environmental',
  'local',
  'seasonal',
  'organic',
  'farm-to-table',
  'regenerative',
];

const HIGH_PRIORITY_CHEFS = [
  'joanie', // Platform mascot
  'max-la-manna', // Zero-waste expert
  'anne-marie-bonneau', // Zero-waste chef
];

async function findChefsNeedingRecipes(): Promise<void> {
  console.log('🔍 Finding chefs needing recipe scraping...\n');

  // Query all active chefs with actual recipe counts
  const chefsData = await db
    .select({
      id: chefs.id,
      slug: chefs.slug,
      name: chefs.name,
      display_name: chefs.display_name,
      bio: chefs.bio,
      website: chefs.website,
      specialties: chefs.specialties,
      is_verified: chefs.is_verified,
      is_active: chefs.is_active,
      recipe_count: chefs.recipe_count,
      actual_recipe_count: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${chefRecipes}
        WHERE ${chefRecipes.chef_id} = ${chefs.id}
      )`,
    })
    .from(chefs)
    .where(
      and(
        eq(chefs.is_active, true),
        or(
          eq(chefs.recipe_count, 0),
          sql`(
            SELECT COUNT(*)
            FROM ${chefRecipes}
            WHERE ${chefRecipes.chef_id} = ${chefs.id}
          ) = 0`
        )
      )
    )
    .orderBy(chefs.name);

  console.log(`📊 Found ${chefsData.length} active chefs with zero recipes\n`);

  if (chefsData.length === 0) {
    console.log('✅ All active chefs have recipes assigned!');
    return;
  }

  // Prioritize chefs
  const prioritizedChefs: PrioritizedChef[] = chefsData.map((chef) =>
    prioritizeChef(chef as ChefWithRecipeInfo)
  );

  // Sort by priority score (descending)
  prioritizedChefs.sort((a, b) => b.priorityScore - a.priorityScore);

  // Separate by priority
  const highPriority = prioritizedChefs.filter((c) => c.priority === 'HIGH');
  const mediumPriority = prioritizedChefs.filter((c) => c.priority === 'MEDIUM');
  const lowPriority = prioritizedChefs.filter((c) => c.priority === 'LOW');

  // Print results
  console.log('='.repeat(80));
  console.log('🔴 HIGH PRIORITY CHEFS (Sustainable/Featured)');
  console.log('='.repeat(80));
  printChefList(highPriority);

  console.log(`\n${'='.repeat(80)}`);
  console.log('🟡 MEDIUM PRIORITY CHEFS (Verified with Website)');
  console.log('='.repeat(80));
  printChefList(mediumPriority);

  console.log(`\n${'='.repeat(80)}`);
  console.log('⚪ LOW PRIORITY CHEFS (No Website or Unverified)');
  console.log('='.repeat(80));
  printChefList(lowPriority);

  // Summary statistics
  console.log(`\n${'='.repeat(80)}`);
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total chefs needing recipes: ${prioritizedChefs.length}`);
  console.log(`  - High Priority: ${highPriority.length}`);
  console.log(`  - Medium Priority: ${mediumPriority.length}`);
  console.log(`  - Low Priority: ${lowPriority.length}`);
  console.log(`\nChefs with websites: ${prioritizedChefs.filter((c) => c.website).length}`);
  console.log(
    `Sustainable chefs: ${prioritizedChefs.filter((c) => c.sustainabilityTags.length > 0).length}`
  );

  const totalRecommendedRecipes = prioritizedChefs.reduce(
    (sum, chef) => sum + chef.scrapingRecommendation.recipesToScrape,
    0
  );
  console.log(`\nTotal recommended recipes to scrape: ${totalRecommendedRecipes}`);

  // Generate action items
  console.log(`\n${'='.repeat(80)}`);
  console.log('📋 RECOMMENDED ACTIONS');
  console.log('='.repeat(80));

  if (highPriority.length > 0) {
    console.log('\n1. Start with HIGH PRIORITY chefs (zero-waste mission alignment):');
    highPriority.slice(0, 5).forEach((chef, idx) => {
      console.log(
        `   ${idx + 1}. ${chef.name} - ${chef.scrapingRecommendation.recipesToScrape} recipes`
      );
      console.log(`      Website: ${chef.website || 'N/A'}`);
      console.log(`      Rationale: ${chef.scrapingRecommendation.rationale}`);
    });
  }

  if (mediumPriority.length > 0) {
    console.log('\n2. Then proceed with MEDIUM PRIORITY (verified chefs):');
    mediumPriority.slice(0, 5).forEach((chef, idx) => {
      console.log(
        `   ${idx + 1}. ${chef.name} - ${chef.scrapingRecommendation.recipesToScrape} recipes`
      );
      console.log(`      Website: ${chef.website || 'N/A'}`);
    });
  }

  console.log('\n3. Use scraping script:');
  console.log('   pnpm tsx scripts/scrape-chef-recipes.ts [chef-slug] --limit [count]');

  console.log('\n✅ Analysis complete!\n');
}

function prioritizeChef(chef: ChefWithRecipeInfo): PrioritizedChef {
  let priorityScore = 0;
  let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  const sustainabilityTags: string[] = [];

  // Check for sustainability keywords in specialties
  if (chef.specialties && chef.specialties.length > 0) {
    chef.specialties.forEach((specialty) => {
      const specialtyLower = specialty.toLowerCase();
      SUSTAINABILITY_KEYWORDS.forEach((keyword) => {
        if (specialtyLower.includes(keyword)) {
          sustainabilityTags.push(specialty);
          priorityScore += 10; // High weight for sustainability
        }
      });
    });
  }

  // Check if chef is high-priority by slug
  if (HIGH_PRIORITY_CHEFS.includes(chef.slug)) {
    priorityScore += 20;
  }

  // Verified chefs get bonus points
  if (chef.is_verified) {
    priorityScore += 5;
  }

  // Chefs with websites get bonus points
  if (chef.website) {
    priorityScore += 8;
  }

  // Chefs with bios (more info) get bonus points
  if (chef.bio && chef.bio.length > 100) {
    priorityScore += 3;
  }

  // Determine priority level
  if (priorityScore >= 15) {
    priority = 'HIGH';
  } else if (priorityScore >= 8) {
    priority = 'MEDIUM';
  } else {
    priority = 'LOW';
  }

  // Determine scraping recommendation
  const scrapingRecommendation = getScrapingRecommendation(
    chef,
    priority,
    sustainabilityTags.length > 0
  );

  return {
    ...chef,
    priority,
    priorityScore,
    scrapingRecommendation,
    sustainabilityTags,
  };
}

function getScrapingRecommendation(
  chef: ChefWithRecipeInfo,
  priority: 'HIGH' | 'MEDIUM' | 'LOW',
  isSustainable: boolean
): { recipesToScrape: number; rationale: string } {
  let recipesToScrape = 5; // Default
  let rationale = '';

  if (priority === 'HIGH') {
    recipesToScrape = isSustainable ? 15 : 10;
    rationale = isSustainable
      ? 'Sustainable chef - high value for zero-waste mission. Scrape diverse recipes.'
      : 'Featured chef - good for platform visibility. Scrape signature recipes.';
  } else if (priority === 'MEDIUM') {
    recipesToScrape = chef.is_verified ? 8 : 5;
    rationale = chef.is_verified
      ? 'Verified chef with website - moderate priority.'
      : 'Standard chef - basic coverage recommended.';
  } else {
    recipesToScrape = 3;
    rationale = chef.website
      ? 'Low priority - minimal coverage to test scraping viability.'
      : 'No website - may require manual curation or alternative sources.';
  }

  return { recipesToScrape, rationale };
}

function printChefList(chefs: PrioritizedChef[]): void {
  if (chefs.length === 0) {
    console.log('  (None)');
    return;
  }

  chefs.forEach((chef, idx) => {
    console.log(`\n${idx + 1}. ${chef.name} (@${chef.slug})`);
    console.log(`   Priority Score: ${chef.priorityScore}`);
    console.log(`   Verified: ${chef.is_verified ? '✅' : '❌'}`);
    console.log(`   Website: ${chef.website || '❌ No website'}`);

    if (chef.sustainabilityTags.length > 0) {
      console.log(`   🌱 Sustainability: ${chef.sustainabilityTags.join(', ')}`);
    }

    if (chef.specialties && chef.specialties.length > 0) {
      console.log(`   Specialties: ${chef.specialties.join(', ')}`);
    }

    console.log(`   📋 Recommended Recipes: ${chef.scrapingRecommendation.recipesToScrape}`);
    console.log(`   💡 Rationale: ${chef.scrapingRecommendation.rationale}`);

    if (chef.bio) {
      const bioPreview = chef.bio.length > 100 ? `${chef.bio.substring(0, 100)}...` : chef.bio;
      console.log(`   Bio: ${bioPreview}`);
    }
  });
}

// Run the script
findChefsNeedingRecipes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
