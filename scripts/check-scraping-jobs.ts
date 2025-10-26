#!/usr/bin/env tsx
/**
 * Check Scraping Jobs
 *
 * Query the scraping_jobs table to see if batch imports have been run.
 */

import { db } from '../src/lib/db';
import { chefSchema } from '../src/lib/db';
import { sql, desc } from 'drizzle-orm';

const { scrapingJobs, chefs } = chefSchema;

async function checkScrapingJobs() {
  console.log('🔍 Checking Scraping Jobs\n');
  console.log('=' .repeat(80));

  // Get all scraping jobs ordered by created_at
  const jobs = await db
    .select({
      id: scrapingJobs.id,
      chef_id: scrapingJobs.chef_id,
      source_url: scrapingJobs.source_url,
      status: scrapingJobs.status,
      recipes_scraped: scrapingJobs.recipes_scraped,
      recipes_failed: scrapingJobs.recipes_failed,
      created_at: scrapingJobs.created_at,
      started_at: scrapingJobs.started_at,
      completed_at: scrapingJobs.completed_at,
      error: scrapingJobs.error,
    })
    .from(scrapingJobs)
    .orderBy(desc(scrapingJobs.created_at))
    .limit(20);

  console.log(`Total scraping jobs found: ${jobs.length}\n`);

  if (jobs.length === 0) {
    console.log('❌ No scraping jobs found in database.');
    console.log('   This suggests the batch import has NOT been run yet.\n');
  } else {
    console.log('Recent Scraping Jobs:\n');

    for (const job of jobs) {
      // Get chef name if chef_id is set
      let chefName = '(no chef)';
      if (job.chef_id) {
        const chefResult = await db
          .select({ name: chefs.name })
          .from(chefs)
          .where(sql`${chefs.id} = ${job.chef_id}`)
          .limit(1);
        chefName = chefResult[0]?.name || '(unknown)';
      }

      const statusIcon =
        job.status === 'completed' ? '✅' :
        job.status === 'failed' ? '❌' :
        job.status === 'running' ? '🔄' :
        '⏳';

      console.log(`${statusIcon} Job: ${job.id.substring(0, 8)}...`);
      console.log(`   Chef: ${chefName}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Source: ${job.source_url.substring(0, 80)}...`);
      console.log(`   Recipes Scraped: ${job.recipes_scraped || 0}`);
      console.log(`   Recipes Failed: ${job.recipes_failed || 0}`);
      console.log(`   Created: ${job.created_at}`);
      if (job.started_at) console.log(`   Started: ${job.started_at}`);
      if (job.completed_at) console.log(`   Completed: ${job.completed_at}`);
      if (job.error) console.log(`   Error: ${job.error.substring(0, 100)}...`);
      console.log('');
    }

    // Summary statistics
    const totalScraped = jobs.reduce((sum, job) => sum + (job.recipes_scraped || 0), 0);
    const totalFailed = jobs.reduce((sum, job) => sum + (job.recipes_failed || 0), 0);
    const completed = jobs.filter(j => j.status === 'completed').length;
    const failed = jobs.filter(j => j.status === 'failed').length;

    console.log('=' .repeat(80));
    console.log('📊 Summary:\n');
    console.log(`   Total Jobs: ${jobs.length}`);
    console.log(`   Completed: ${completed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total Recipes Scraped: ${totalScraped}`);
    console.log(`   Total Recipes Failed: ${totalFailed}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Check Complete\n');

  process.exit(0);
}

checkScrapingJobs().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
