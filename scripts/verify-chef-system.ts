#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { chefRecipes, chefs, scrapingJobs } from '@/lib/db/chef-schema';

/**
 * Verify Chef System Implementation
 */

async function verifyChefSystem() {
  console.log('🔍 Verifying Chef System Implementation...\n');

  try {
    // Check chefs table
    const allChefs = await db.select().from(chefs);
    console.log(`✅ Chefs table: ${allChefs.length} chef(s) found`);

    if (allChefs.length > 0) {
      console.log('\nChefs:');
      allChefs.forEach((chef) => {
        console.log(`  - ${chef.name} (${chef.slug})`);
        console.log(`    Recipes: ${chef.recipeCount}`);
        console.log(`    Verified: ${chef.isVerified}`);
        console.log(`    Active: ${chef.isActive}`);
        console.log(`    Specialties: ${chef.specialties?.join(', ') || 'None'}`);
      });
    }

    // Check chef_recipes table
    const allChefRecipes = await db.select().from(chefRecipes);
    console.log(`\n✅ Chef Recipes table: ${allChefRecipes.length} link(s) found`);

    // Check scraping_jobs table
    const allJobs = await db.select().from(scrapingJobs);
    console.log(`✅ Scraping Jobs table: ${allJobs.length} job(s) found`);

    if (allJobs.length > 0) {
      console.log('\nRecent Jobs:');
      allJobs.slice(0, 5).forEach((job) => {
        console.log(`  - ${job.sourceUrl}`);
        console.log(`    Status: ${job.status}`);
        console.log(`    Scraped: ${job.recipesScraped}/${job.totalPages || '?'}`);
      });
    }

    console.log('\n✅ All tables verified successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Chefs: ${allChefs.length}`);
    console.log(`  - Chef Recipes: ${allChefRecipes.length}`);
    console.log(`  - Scraping Jobs: ${allJobs.length}`);

    console.log('\n🎉 Chef system is ready to use!');
  } catch (error) {
    console.error('❌ Error verifying chef system:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  verifyChefSystem()
    .then(() => {
      console.log('\n✨ Verification complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Verification failed:', error);
      process.exit(1);
    });
}

export { verifyChefSystem };
