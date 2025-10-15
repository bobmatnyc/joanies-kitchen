#!/usr/bin/env tsx

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkStats() {
  console.log('\n🔍 Checking Food.com ingestion statistics...\n');

  try {
    // Overall Food.com stats
    const overallStats = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE source LIKE '%food.com%') as foodcom_total,
        COUNT(*) FILTER (WHERE source LIKE '%food.com%' AND created_at > NOW() - INTERVAL '30 minutes') as recent_foodcom,
        COUNT(*) FILTER (WHERE source LIKE '%food.com%' AND created_at > NOW() - INTERVAL '30 minutes' AND system_rating IS NOT NULL) as rated_recent,
        AVG(CAST(system_rating AS FLOAT)) FILTER (WHERE source LIKE '%food.com%' AND created_at > NOW() - INTERVAL '30 minutes' AND system_rating IS NOT NULL) as avg_recent_quality,
        MIN(created_at) FILTER (WHERE source LIKE '%food.com%' AND created_at > NOW() - INTERVAL '30 minutes') as first_recent,
        MAX(created_at) FILTER (WHERE source LIKE '%food.com%' AND created_at > NOW() - INTERVAL '30 minutes') as last_recent
      FROM recipes
    `);

    const stats = overallStats.rows[0] as any;

    console.log('📊 FOOD.COM INGESTION STATISTICS');
    console.log('='.repeat(60));
    console.log(`Total Food.com recipes in DB: ${stats.foodcom_total || 0}`);
    console.log(`Recipes added in last 30 min: ${stats.recent_foodcom || 0}`);
    console.log(`Recipes with AI rating: ${stats.rated_recent || 0}`);

    if (stats.avg_recent_quality) {
      console.log(`Average quality score: ${parseFloat(stats.avg_recent_quality).toFixed(2)}/5.0`);
    }

    if (stats.first_recent) {
      console.log(`First recent recipe: ${new Date(stats.first_recent).toISOString()}`);
    }

    if (stats.last_recent) {
      console.log(`Last recent recipe: ${new Date(stats.last_recent).toISOString()}`);

      // Calculate processing rate
      const start = new Date(stats.first_recent);
      const end = new Date(stats.last_recent);
      const durationSeconds = (end.getTime() - start.getTime()) / 1000;
      const rate = stats.recent_foodcom / durationSeconds;

      console.log(`\nProcessing rate: ${rate.toFixed(2)} recipes/second`);
      console.log(`Total duration: ${(durationSeconds / 60).toFixed(2)} minutes`);
    }

    // Get rating distribution
    const ratingDist = await db.execute(sql`
      SELECT
        system_rating,
        COUNT(*) as count
      FROM recipes
      WHERE source LIKE '%food.com%'
        AND created_at > NOW() - INTERVAL '30 minutes'
        AND system_rating IS NOT NULL
      GROUP BY system_rating
      ORDER BY system_rating DESC
    `);

    if (ratingDist.rows.length > 0) {
      console.log('\n📈 QUALITY RATING DISTRIBUTION (Recent)');
      console.log('='.repeat(60));
      ratingDist.rows.forEach((row: any) => {
        const rating = parseFloat(row.system_rating);
        const count = parseInt(row.count);
        const bar = '█'.repeat(Math.ceil(count / 5));
        console.log(`${rating.toFixed(1)}/5.0: ${bar} ${count} recipes`);
      });
    }

    console.log('\n' + '='.repeat(60));

  } catch (error: any) {
    console.error('❌ Error checking stats:', error.message);
    throw error;
  }
}

checkStats()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
