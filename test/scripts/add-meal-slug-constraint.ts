#!/usr/bin/env tsx
/**
 * Add Unique Constraint to Meal Slugs
 *
 * Run this AFTER backfilling all existing meals with slugs
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function addUniqueConstraint() {
  console.log('🔄 Adding unique constraint to meal slugs...\n');

  try {
    await db.execute(sql`ALTER TABLE "meals" ADD CONSTRAINT "meals_slug_unique" UNIQUE("slug")`);
    console.log('✓ Added unique constraint on slug column');
    console.log('\n✅ Migration complete!');
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log('✓ Unique constraint already exists');
    } else {
      console.error('❌ Error adding constraint:', error);
      process.exit(1);
    }
  } finally {
    process.exit(0);
  }
}

addUniqueConstraint();
