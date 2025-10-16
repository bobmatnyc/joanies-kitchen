#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { sql } from 'drizzle-orm';

/**
 * Update all chef profiles to verified status
 * Run with: npx tsx scripts/update-chefs-verified.ts
 */

async function updateChefsVerified() {
  console.log('🔧 Updating all chefs to verified status...\n');

  try {
    const result = await db
      .update(chefs)
      .set({
        is_verified: true,
        updated_at: sql`now()`
      })
      .returning();

    console.log(`✅ Updated ${result.length} chef(s) to verified status\n`);

    result.forEach((chef) => {
      console.log(`  ✓ ${chef.name} (${chef.slug})`);
    });

    console.log('\n🎉 All chefs are now verified!');
  } catch (error) {
    console.error('❌ Error updating chefs:', error);
    throw error;
  }
}

updateChefsVerified()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
