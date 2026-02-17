#!/usr/bin/env tsx

/**
 * Apply QA tracking fields migration directly to database
 * This script adds the necessary columns and indexes for recipe QA tracking
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function applyQAMigration() {
  console.log('🔄 Applying QA Tracking Fields Migration...\n');
  console.log('='.repeat(70));

  try {
    // Add QA tracking columns
    console.log('\n📝 Adding QA tracking columns to recipes table...');

    await db.execute(
      sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS qa_status varchar(50) DEFAULT 'pending'`
    );
    console.log('  ✅ qa_status (varchar 50, default: pending)');

    await db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS qa_timestamp timestamp`);
    console.log('  ✅ qa_timestamp (timestamp)');

    await db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS qa_method varchar(100)`);
    console.log('  ✅ qa_method (varchar 100)');

    await db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS qa_confidence numeric(3, 2)`);
    console.log('  ✅ qa_confidence (numeric 3,2)');

    await db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS qa_notes text`);
    console.log('  ✅ qa_notes (text)');

    await db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS qa_issues_found text`);
    console.log('  ✅ qa_issues_found (text)');

    await db.execute(sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS qa_fixes_applied text`);
    console.log('  ✅ qa_fixes_applied (text)');

    // Create indexes
    console.log('\n📇 Creating performance indexes...');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_recipes_qa_status ON recipes(qa_status)`);
    console.log('  ✅ idx_recipes_qa_status');

    await db.execute(
      sql`CREATE INDEX IF NOT EXISTS idx_recipes_qa_timestamp ON recipes(qa_timestamp)`
    );
    console.log('  ✅ idx_recipes_qa_timestamp');

    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_recipes_qa_method ON recipes(qa_method)`);
    console.log('  ✅ idx_recipes_qa_method');

    // Verify columns were added
    console.log('\n🔍 Verifying migration...');
    const result = await db.execute(sql`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'recipes' AND column_name LIKE 'qa_%'
      ORDER BY column_name
    `);

    console.log('\n📊 QA Columns in Database:');
    result.rows.forEach((row: any) => {
      console.log(
        `   - ${row.column_name.padEnd(25)} ${row.data_type.padEnd(20)} ${row.column_default || '(nullable)'}`
      );
    });

    // Count recipes with default status
    const countResult = await db.execute(sql`
      SELECT qa_status, COUNT(*) as count
      FROM recipes
      GROUP BY qa_status
    `);

    console.log('\n📈 Recipe QA Status Distribution:');
    countResult.rows.forEach((row: any) => {
      console.log(`   - ${row.qa_status || 'NULL'}: ${row.count} recipes`);
    });

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Run test suite: pnpm qa:test');
    console.log('  2. Run Phase 1: pnpm qa:phase1');
    console.log('  3. Run Phase 2: pnpm qa:phase2\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

applyQAMigration();
