#!/usr/bin/env tsx

/**
 * Verify Recipe Sources Implementation
 *
 * Quick verification script to check the recipe sources ontology
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { recipeSources, recipeSourceTypes } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

async function verify() {
  console.log('🔍 Verifying Recipe Sources Ontology\n');

  // Get all sources
  const sources = await db.select().from(recipeSources);
  console.log(`✅ Total Sources: ${sources.length}`);
  console.log('\nSources:');
  sources.forEach((s) => {
    console.log(`  - ${s.name} (${s.slug})${s.is_active ? '' : ' [INACTIVE]'}`);
  });

  // Get all source types
  const types = await db.select().from(recipeSourceTypes);
  console.log(`\n✅ Total Source Types: ${types.length}`);

  // Show source types grouped by source
  console.log('\nSource Hierarchy:');
  for (const source of sources) {
    const sourceTypes = await db
      .select()
      .from(recipeSourceTypes)
      .where(eq(recipeSourceTypes.source_id, source.id));

    console.log(`\n  ${source.name}:`);
    sourceTypes.forEach((type) => {
      console.log(`    └─ ${type.name}`);
    });
  }

  console.log('\n✅ Verification complete!');
  await client.end();
}

verify().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
