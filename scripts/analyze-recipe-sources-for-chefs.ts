#!/usr/bin/env tsx
/**
 * Analyze recipe sources to find potential chef matches
 */

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function analyzeRecipeSources() {
  console.log('📊 Analyzing recipe sources for chef matches...\n');

  // Get all unique sources from system recipes
  const sources = await db
    .select({
      source: recipes.source,
      count: sql<number>`count(*)::int`,
    })
    .from(recipes)
    .where(eq(recipes.is_system_recipe, true))
    .groupBy(recipes.source)
    .orderBy(sql`count(*) desc`)
    .limit(50);

  console.log('Top 50 Recipe Sources:');
  console.log('═'.repeat(70));

  sources.forEach((s, idx) => {
    console.log(`${(idx + 1).toString().padStart(2)}. [${s.count.toString().padStart(4)}] ${s.source}`);
  });

  console.log('\n\nPotential Chef Matches:');
  console.log('═'.repeat(70));

  // Famous chef patterns to look for
  const chefPatterns = [
    { name: 'Gordon Ramsay', patterns: ['gordon', 'ramsay'] },
    { name: 'Ina Garten', patterns: ['barefoot', 'contessa', 'ina'] },
    { name: 'Jacques Pépin', patterns: ['jacques', 'pepin'] },
    { name: 'Yotam Ottolenghi', patterns: ['ottolenghi', 'yotam'] },
    { name: 'Nigella Lawson', patterns: ['nigella'] },
    { name: 'Alton Brown', patterns: ['alton'] },
    { name: 'Madhur Jaffrey', patterns: ['madhur', 'jaffrey'] },
    { name: 'Samin Nosrat', patterns: ['samin'] },
  ];

  for (const chef of chefPatterns) {
    const matches = sources.filter(s => 
      chef.patterns.some(pattern => 
        s.source?.toLowerCase().includes(pattern.toLowerCase())
      )
    );

    if (matches.length > 0) {
      console.log(`\n${chef.name}:`);
      matches.forEach(m => {
        console.log(`  [${m.count.toString().padStart(4)}] ${m.source}`);
      });
    }
  }

  console.log('\n\n📈 Summary:');
  console.log(`Total unique sources: ${sources.length}`);
  console.log(`Total system recipes: ${sources.reduce((sum, s) => sum + s.count, 0)}`);
}

analyzeRecipeSources()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  });
