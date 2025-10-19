#!/usr/bin/env tsx
/**
 * Apply Meal Slug Migration
 *
 * Applies the slug column to meals table without the unique constraint
 * (we'll add that after backfilling)
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';

async function applyMigration() {
  console.log('🔄 Applying meal slug migration...\n');

  try {
    // Add slug column
    await db.execute(sql`ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "slug" varchar(255)`);
    console.log('✓ Added slug column');

    // Create index
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "meals_slug_idx" ON "meals" USING btree ("slug")`);
    console.log('✓ Created slug index');

    // Note: We'll add the unique constraint AFTER backfilling
    console.log('\n✅ Migration applied! Now run: pnpm tsx scripts/backfill-meal-slugs.ts');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

applyMigration();
