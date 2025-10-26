/**
 * Quick check for recently imported recipes
 * Checks various time windows to find when imports occurred
 */

import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';
import { gte, desc, sql } from 'drizzle-orm';

async function checkImports() {
  const timeWindows = [
    { label: 'Last 1 hour', hours: 1 },
    { label: 'Last 2 hours', hours: 2 },
    { label: 'Last 6 hours', hours: 6 },
    { label: 'Last 12 hours', hours: 12 },
    { label: 'Last 24 hours', hours: 24 },
    { label: 'Last 48 hours', hours: 48 },
    { label: 'Last 7 days', hours: 168 },
  ];

  console.log('🔍 Checking for recent recipe imports...\n');

  for (const window of timeWindows) {
    const cutoff = new Date(Date.now() - window.hours * 60 * 60 * 1000);
    const count = await db
      .select({ count: sql<number>`count(*)` })
      .from(recipes)
      .where(gte(recipes.created_at, cutoff));

    console.log(`${window.label.padEnd(20)} ${count[0].count} recipes`);
  }

  // Get most recent recipe
  const latest = await db.select().from(recipes).orderBy(desc(recipes.created_at)).limit(1);

  if (latest.length > 0) {
    console.log(`\n📅 Most recent recipe:`);
    console.log(`   Name: ${latest[0].name}`);
    console.log(`   Created: ${latest[0].created_at}`);
    console.log(`   Source: ${latest[0].source || 'N/A'}`);
    console.log(`   Chef ID: ${latest[0].chef_id || 'No chef association'}`);
  }

  // Check for recipes with source URLs (likely imports)
  const withSource = await db
    .select({ count: sql<number>`count(*)` })
    .from(recipes)
    .where(sql`${recipes.source} IS NOT NULL AND ${recipes.source} != ''`);

  console.log(`\n📊 Total recipes with source URL: ${withSource[0].count}`);

  // Get recent recipes grouped by date
  console.log(`\n📆 Recent imports by date:`);
  const byDate = await db.execute(sql`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as count
    FROM recipes
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) DESC
    LIMIT 10
  `);

  for (const row of byDate.rows) {
    console.log(`   ${row.date}: ${row.count} recipes`);
  }
}

checkImports()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
