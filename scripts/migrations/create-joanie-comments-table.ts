#!/usr/bin/env tsx
/**
 * Database Migration: Create joanie_comments table
 *
 * Purpose:
 * - Add joanie_comments table for Joanie's personal notes and observations
 * - Support comments on recipes, meals, and ingredients
 * - Enable categorization by comment type (story, tip, substitution, general)
 *
 * Usage:
 *   pnpm tsx scripts/migrations/create-joanie-comments-table.ts
 */

import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function createJoanieCommentsTable() {
  console.log('Creating joanie_comments table...');

  try {
    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS joanie_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Flexible references (one must be set, others null)
        recipe_id TEXT REFERENCES recipes(id) ON DELETE CASCADE,
        meal_id UUID REFERENCES meals(id) ON DELETE CASCADE,
        ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,

        -- Comment content
        comment_text TEXT NOT NULL,
        comment_type TEXT CHECK (comment_type IN ('story', 'tip', 'substitution', 'general')),

        -- Metadata
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        -- Ensure exactly one reference is set
        CONSTRAINT joanie_comments_single_reference_check
          CHECK (
            (recipe_id IS NOT NULL AND meal_id IS NULL AND ingredient_id IS NULL) OR
            (meal_id IS NOT NULL AND recipe_id IS NULL AND ingredient_id IS NULL) OR
            (ingredient_id IS NOT NULL AND recipe_id IS NULL AND meal_id IS NULL)
          )
      );
    `);
    console.log('✓ Table created successfully');

    // Create indexes
    console.log('Creating indexes...');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS joanie_comments_recipe_id_idx
        ON joanie_comments(recipe_id);
    `);
    console.log('✓ Recipe ID index created');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS joanie_comments_meal_id_idx
        ON joanie_comments(meal_id);
    `);
    console.log('✓ Meal ID index created');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS joanie_comments_ingredient_id_idx
        ON joanie_comments(ingredient_id);
    `);
    console.log('✓ Ingredient ID index created');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS joanie_comments_type_idx
        ON joanie_comments(comment_type);
    `);
    console.log('✓ Comment type index created');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS joanie_comments_created_at_idx
        ON joanie_comments(created_at DESC);
    `);
    console.log('✓ Created at index created');

    // Create updated_at trigger
    console.log('Creating updated_at trigger...');

    await db.execute(sql`
      CREATE OR REPLACE FUNCTION update_joanie_comments_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await db.execute(sql`
      DROP TRIGGER IF EXISTS joanie_comments_updated_at_trigger
        ON joanie_comments;
    `);

    await db.execute(sql`
      CREATE TRIGGER joanie_comments_updated_at_trigger
        BEFORE UPDATE ON joanie_comments
        FOR EACH ROW
        EXECUTE FUNCTION update_joanie_comments_updated_at();
    `);
    console.log('✓ Updated at trigger created');

    console.log('\n✓ Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test by adding a comment via the server actions');
    console.log('2. Verify the constraint by trying to set multiple references');
    console.log('3. Add Joanie\'s first comment to Monday Night Crab Salad');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
createJoanieCommentsTable()
  .then(() => {
    console.log('\nMigration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMigration script failed:', error);
    process.exit(1);
  });
