#!/usr/bin/env tsx
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function checkAndFix() {
  console.log('=== Checking meals table schema ===\n');

  try {
    // Check current columns
    const columns = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'meals'
      ORDER BY ordinal_position;
    `);

    console.log('Current columns:');
    for (const col of columns.rows) {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    }

    // Check if image_url exists
    const hasImageUrl = columns.rows.some((col: any) => col.column_name === 'image_url');

    if (!hasImageUrl) {
      console.log('\n⚠️ Missing image_url column. Adding it...');
      await db.execute(sql`ALTER TABLE "meals" ADD COLUMN "image_url" text`);
      console.log('✓ Added image_url column');
    } else {
      console.log('\n✓ image_url column exists');
    }

    // Count meals
    const count = await db.execute(sql`SELECT COUNT(*) FROM meals`);
    console.log(`\n✓ Total meals: ${count.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAndFix().then(() => process.exit(0));
