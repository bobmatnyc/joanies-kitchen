/**
 * Test script to fetch tool slugs from database
 */

import { db } from '@/lib/db';
import { tools } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    console.log('Fetching tools with slugs...\n');

    const results = await db
      .select({
        name: tools.name,
        slug: tools.slug,
        displayName: tools.display_name,
        category: tools.category,
      })
      .from(tools)
      .orderBy(tools.name)
      .limit(10);

    console.log('Sample Tools:');
    console.log('='.repeat(80));
    results.forEach((tool) => {
      console.log(`Name: ${tool.name}`);
      console.log(`Slug: ${tool.slug}`);
      console.log(`Display Name: ${tool.displayName}`);
      console.log(`Category: ${tool.category}`);
      console.log(`URL: /tools/${tool.slug}`);
      console.log('-'.repeat(80));
    });

    console.log(`\nTotal tools fetched: ${results.length}`);
    console.log('\nSample URLs to test:');
    results.slice(0, 5).forEach((tool) => {
      console.log(`  - http://localhost:3000/tools/${tool.slug}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
