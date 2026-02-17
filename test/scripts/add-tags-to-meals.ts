#!/usr/bin/env tsx

/**
 * Add tags column to meals table
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function addTagsColumn() {
  try {
    console.log('Adding tags column to meals table...');

    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'meals' AND column_name = 'tags'
    `);

    if (result.rows.length > 0) {
      console.log('✓ Tags column already exists');
      return;
    }

    // Add tags column
    await db.execute(sql`
      ALTER TABLE meals ADD COLUMN tags text
    `);

    console.log('✓ Successfully added tags column to meals table');
  } catch (error) {
    console.error('Error adding tags column:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

addTagsColumn();
