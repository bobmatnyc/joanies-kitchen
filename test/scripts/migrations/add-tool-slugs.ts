/**
 * Migration: Add slug field to tools table and populate from name field
 *
 * This migration:
 * 1. Adds a slug column to the tools table
 * 2. Generates slugs from existing name field (name is already URL-friendly)
 * 3. Sets NOT NULL and UNIQUE constraints
 * 4. Adds index for performance
 *
 * The name field is already in URL-friendly format (e.g., "large-pot"),
 * so we can use it directly as the slug.
 */

import { db } from '@/lib/db';
import { tools } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('Starting migration: add-tool-slugs');
  console.log('=====================================\n');

  try {
    // Step 1: Add slug column (nullable initially)
    console.log('Step 1: Adding slug column to tools table...');
    await db.execute(sql`
      ALTER TABLE tools
      ADD COLUMN IF NOT EXISTS slug VARCHAR(255)
    `);
    console.log('✓ Slug column added\n');

    // Step 2: Populate slugs from name field
    console.log('Step 2: Populating slugs from name field...');
    const result = await db.execute(sql`
      UPDATE tools
      SET slug = name
      WHERE slug IS NULL
    `);
    console.log(`✓ Updated ${result.rowCount || 0} tools with slugs\n`);

    // Step 3: Add UNIQUE constraint
    console.log('Step 3: Adding UNIQUE constraint...');
    await db.execute(sql`
      ALTER TABLE tools
      ADD CONSTRAINT tools_slug_unique UNIQUE (slug)
    `);
    console.log('✓ UNIQUE constraint added\n');

    // Step 4: Add NOT NULL constraint
    console.log('Step 4: Adding NOT NULL constraint...');
    await db.execute(sql`
      ALTER TABLE tools
      ALTER COLUMN slug SET NOT NULL
    `);
    console.log('✓ NOT NULL constraint added\n');

    // Step 5: Add index for performance
    console.log('Step 5: Adding index on slug column...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS tools_slug_idx ON tools(slug)
    `);
    console.log('✓ Index created\n');

    // Verification: Count tools with slugs
    const verification = await db.execute(sql`
      SELECT COUNT(*) as count FROM tools WHERE slug IS NOT NULL
    `);
    const count = verification.rows?.[0]?.count || result.rowCount || 0;
    console.log('=====================================');
    console.log('Migration completed successfully!');
    console.log(`Total tools with slugs: ${count}`);
    console.log('=====================================\n');

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

main();
