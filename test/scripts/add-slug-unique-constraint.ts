#!/usr/bin/env tsx
/**
 * Add Unique Constraint to Ingredient Slug
 *
 * After populating all slugs, this script adds a unique constraint
 * to ensure no duplicate slugs exist.
 *
 * Usage:
 *   pnpm tsx scripts/add-slug-unique-constraint.ts
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function addUniqueConstraint() {
  console.log('🔄 Connecting to database...');
  const client = postgres(DATABASE_URL!);
  const db = drizzle(client);

  try {
    console.log('📝 Adding unique constraint to slug column...');

    await db.execute(sql`
      ALTER TABLE ingredients
      ADD CONSTRAINT ingredients_slug_unique UNIQUE (slug)
    `);

    console.log('✅ Unique constraint added successfully!');
    await client.end();
  } catch (error: any) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Unique constraint already exists, skipping');
      await client.end();
    } else {
      console.error('❌ Failed to add unique constraint:', error);
      await client.end();
      process.exit(1);
    }
  }
}

// Run the script
addUniqueConstraint();
