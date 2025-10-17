#!/usr/bin/env tsx

/**
 * Check Recipe Quality Ratings
 *
 * Queries the database to analyze the distribution of system_rating values
 * and identify low-quality recipes that may need removal.
 */

import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';

async function checkQualityRatings() {
  console.log('🔍 Recipe Quality Analysis');
  console.log('========================\n');

  try {
    // Get overall statistics
    const stats = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(system_rating) as rated,
        COUNT(*) - COUNT(system_rating) as unrated,
        MIN(system_rating) as min_rating,
        MAX(system_rating) as max_rating,
        AVG(system_rating) as avg_rating,
        COUNT(CASE WHEN system_rating < 1.0 THEN 1 END) as unusable,
        COUNT(CASE WHEN system_rating >= 1.0 AND system_rating < 2.0 THEN 1 END) as poor,
        COUNT(CASE WHEN system_rating >= 2.0 AND system_rating < 3.0 THEN 1 END) as fair,
        COUNT(CASE WHEN system_rating >= 3.0 AND system_rating < 4.0 THEN 1 END) as good,
        COUNT(CASE WHEN system_rating >= 4.0 AND system_rating < 5.0 THEN 1 END) as very_good,
        COUNT(CASE WHEN system_rating = 5.0 THEN 1 END) as excellent
      FROM recipes
    `);

    const data = stats.rows[0];

    console.log('📊 Overall Statistics:');
    console.log('━'.repeat(80));
    console.log(`Total recipes: ${Number(data.total).toLocaleString()}`);
    console.log(
      `Rated recipes: ${Number(data.rated).toLocaleString()} (${((Number(data.rated) / Number(data.total)) * 100).toFixed(1)}%)`
    );
    console.log(
      `Unrated recipes: ${Number(data.unrated).toLocaleString()} (${((Number(data.unrated) / Number(data.total)) * 100).toFixed(1)}%)`
    );

    if (Number(data.rated) > 0) {
      console.log(
        `\nRating Range: ${Number(data.min_rating).toFixed(1)} - ${Number(data.max_rating).toFixed(1)}`
      );
      console.log(`Average Rating: ${Number(data.avg_rating).toFixed(2)}`);

      console.log('\n📈 Rating Distribution:');
      console.log('━'.repeat(80));
      console.log(
        `0.0-0.9 (Unusable):   ${Number(data.unusable).toLocaleString().padStart(6)} recipes (${((Number(data.unusable) / Number(data.rated)) * 100).toFixed(1)}%)`
      );
      console.log(
        `1.0-1.9 (Poor):       ${Number(data.poor).toLocaleString().padStart(6)} recipes (${((Number(data.poor) / Number(data.rated)) * 100).toFixed(1)}%)`
      );
      console.log(
        `2.0-2.9 (Fair):       ${Number(data.fair).toLocaleString().padStart(6)} recipes (${((Number(data.fair) / Number(data.rated)) * 100).toFixed(1)}%)`
      );
      console.log(
        `3.0-3.9 (Good):       ${Number(data.good).toLocaleString().padStart(6)} recipes (${((Number(data.good) / Number(data.rated)) * 100).toFixed(1)}%)`
      );
      console.log(
        `4.0-4.9 (Very Good):  ${Number(data.very_good).toLocaleString().padStart(6)} recipes (${((Number(data.very_good) / Number(data.rated)) * 100).toFixed(1)}%)`
      );
      console.log(
        `5.0 (Excellent):      ${Number(data.excellent).toLocaleString().padStart(6)} recipes (${((Number(data.excellent) / Number(data.rated)) * 100).toFixed(1)}%)`
      );
    }

    // Get source breakdown
    console.log('\n📦 Source Breakdown:');
    console.log('━'.repeat(80));

    const sourceStats = await db.execute(sql`
      SELECT
        COALESCE(source, 'Unknown') as source_name,
        COUNT(*) as count,
        COUNT(system_rating) as rated_count,
        AVG(system_rating) as avg_rating,
        COUNT(CASE WHEN system_rating < 2.0 THEN 1 END) as low_quality
      FROM recipes
      GROUP BY source
      ORDER BY count DESC
      LIMIT 10
    `);

    for (const row of sourceStats.rows) {
      const source = String(row.source_name);
      const count = Number(row.count);
      const ratedCount = Number(row.rated_count);
      const avgRating = row.avg_rating ? Number(row.avg_rating).toFixed(2) : 'N/A';
      const lowQuality = Number(row.low_quality);

      console.log(
        `${source.padEnd(30)} ${count.toLocaleString().padStart(6)} recipes | Rated: ${ratedCount.toLocaleString().padStart(5)} | Avg: ${String(avgRating).padStart(4)} | Low: ${lowQuality.toLocaleString().padStart(4)}`
      );
    }

    // Sample low-quality recipes
    if (Number(data.unusable) + Number(data.poor) > 0) {
      console.log('\n⚠️  Sample Low-Quality Recipes (rating < 2.0):');
      console.log('━'.repeat(80));

      const lowQualityRecipes = await db.execute(sql`
        SELECT
          id,
          name,
          system_rating,
          system_rating_reason,
          source
        FROM recipes
        WHERE system_rating < 2.0
        ORDER BY system_rating ASC
        LIMIT 10
      `);

      for (const recipe of lowQualityRecipes.rows) {
        console.log(`\nID: ${recipe.id}`);
        console.log(`Name: ${recipe.name}`);
        console.log(`Rating: ${Number(recipe.system_rating).toFixed(1)}/5.0`);
        console.log(`Reason: ${recipe.system_rating_reason || 'No reason provided'}`);
        console.log(`Source: ${recipe.source || 'Unknown'}`);
      }
    }

    // Recommendations
    console.log('\n\n💡 Recommendations:');
    console.log('━'.repeat(80));

    const lowQualityTotal = Number(data.unusable) + Number(data.poor);
    const fairQualityTotal = Number(data.fair);

    if (lowQualityTotal > 0) {
      console.log(
        `\n🔴 REMOVE: ${lowQualityTotal.toLocaleString()} recipes rated < 2.0 (${((lowQualityTotal / Number(data.total)) * 100).toFixed(1)}% of total)`
      );
      console.log('   These recipes have critical quality issues and should be removed.');
    }

    if (fairQualityTotal > 0) {
      console.log(
        `\n🟡 REVIEW: ${fairQualityTotal.toLocaleString()} recipes rated 2.0-2.9 (${((fairQualityTotal / Number(data.total)) * 100).toFixed(1)}% of total)`
      );
      console.log(
        '   These recipes have significant issues and may need manual review or cleanup.'
      );
    }

    if (Number(data.unrated) > 0) {
      console.log(
        `\n⚪ RATE: ${Number(data.unrated).toLocaleString()} recipes without ratings (${((Number(data.unrated) / Number(data.total)) * 100).toFixed(1)}% of total)`
      );
      console.log('   Run quality evaluation script to rate these recipes.');
    }

    console.log('\n\n📋 Next Steps:');
    console.log('━'.repeat(80));
    console.log('1. Review sample low-quality recipes above');
    console.log('2. Run: npx tsx scripts/remove-low-quality-recipes.ts --dry-run');
    console.log('3. If satisfied, run: npx tsx scripts/remove-low-quality-recipes.ts --execute');
    console.log('4. For manual review: npx tsx scripts/export-low-quality-recipes.ts');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

checkQualityRatings()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
