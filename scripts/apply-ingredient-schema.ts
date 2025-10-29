#!/usr/bin/env tsx

/**
 * Apply Ingredient Schema Changes
 *
 * Adds new columns to ingredients table:
 * - slug (for URL-friendly ingredient pages)
 * - description (general information)
 * - storage_tips (Joanie's storage advice)
 * - substitutions (JSON array of alternatives)
 * - image_url (ingredient image)
 *
 * Usage:
 *   pnpm tsx scripts/apply-ingredient-schema.ts
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function applySchema() {
  console.log('🔄 Connecting to database...');
  const client = postgres(DATABASE_URL);
  const db = drizzle(client);

  try {
    console.log('📝 Adding new columns to ingredients table...');

    // Add slug column
    await db.execute(sql`
      ALTER TABLE ingredients
      ADD COLUMN IF NOT EXISTS slug VARCHAR(255)
    `);
    console.log('✅ Added slug column');

    // Add description column
    await db.execute(sql`
      ALTER TABLE ingredients
      ADD COLUMN IF NOT EXISTS description TEXT
    `);
    console.log('✅ Added description column');

    // Add storage_tips column
    await db.execute(sql`
      ALTER TABLE ingredients
      ADD COLUMN IF NOT EXISTS storage_tips TEXT
    `);
    console.log('✅ Added storage_tips column');

    // Add substitutions column
    await db.execute(sql`
      ALTER TABLE ingredients
      ADD COLUMN IF NOT EXISTS substitutions TEXT
    `);
    console.log('✅ Added substitutions column');

    // Add image_url column
    await db.execute(sql`
      ALTER TABLE ingredients
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `);
    console.log('✅ Added image_url column');

    // Create index on slug
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS ingredients_slug_idx ON ingredients(slug)
    `);
    console.log('✅ Created slug index');

    console.log('\n✨ Schema changes applied successfully!');
    console.log('📌 Next step: Run populate-ingredient-slugs.ts to generate slugs');

    await client.end();
  } catch (error: any) {
    console.error('❌ Failed to apply schema changes:', error);
    await client.end();
    process.exit(1);
  }
}

// Run the migration
applySchema();
