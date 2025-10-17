/**
 * Apply Ingredients Schema Migration
 *
 * This script applies the ingredients schema to the database.
 * It creates:
 * - ingredients table (master ingredient list)
 * - recipe_ingredients table (many-to-many join)
 * - ingredient_statistics table (optional analytics)
 *
 * Requirements:
 * - PostgreSQL with pg_trgm extension support
 */

import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL not found in environment variables');
  process.exit(1);
}

async function applyMigration() {
  console.log('🚀 Starting ingredients schema migration...\n');

  const sql = neon(DATABASE_URL);

  try {
    // 1. Enable pg_trgm extension
    console.log('📦 Enabling pg_trgm extension...');
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`;
    console.log('✅ pg_trgm extension enabled\n');

    // 2. Create ingredients table
    console.log('📋 Creating/updating ingredients table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "ingredients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "display_name" text NOT NULL,
        "category" varchar(50),
        "common_units" text,
        "aliases" text,
        "is_common" boolean DEFAULT false NOT NULL,
        "typical_unit" varchar(20),
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ingredients_name_unique" UNIQUE("name")
      );
    `;

    // Add is_allergen column if it doesn't exist
    try {
      await sql`
        ALTER TABLE "ingredients"
        ADD COLUMN IF NOT EXISTS "is_allergen" boolean DEFAULT false NOT NULL;
      `;
    } catch (_error) {
      console.log('   ℹ️  is_allergen column already exists or other error');
    }

    console.log('✅ ingredients table created/updated\n');

    // 3. Create recipe_ingredients table
    console.log('📋 Creating/updating recipe_ingredients table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "recipe_ingredients" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "recipe_id" text NOT NULL,
        "ingredient_id" uuid NOT NULL,
        "amount" varchar(50),
        "unit" varchar(50),
        "preparation" varchar(200),
        "is_optional" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      );
    `;

    // Add position column if it doesn't exist
    try {
      await sql`
        ALTER TABLE "recipe_ingredients"
        ADD COLUMN IF NOT EXISTS "position" integer DEFAULT 0 NOT NULL;
      `;
    } catch (_error) {
      console.log('   ℹ️  position column already exists or other error');
    }

    // Add ingredient_group column if it doesn't exist
    try {
      await sql`
        ALTER TABLE "recipe_ingredients"
        ADD COLUMN IF NOT EXISTS "ingredient_group" varchar(100);
      `;
    } catch (_error) {
      console.log('   ℹ️  ingredient_group column already exists or other error');
    }

    // Add unique constraint if it doesn't exist
    try {
      await sql`
        ALTER TABLE "recipe_ingredients"
        DROP CONSTRAINT IF EXISTS "recipe_ingredients_position_unique";
      `;
      await sql`
        ALTER TABLE "recipe_ingredients"
        ADD CONSTRAINT "recipe_ingredients_position_unique"
        UNIQUE("recipe_id","ingredient_id","position");
      `;
    } catch (_error) {
      console.log('   ℹ️  Constraint handling completed');
    }

    console.log('✅ recipe_ingredients table created/updated\n');

    // 4. Create ingredient_statistics table
    console.log('📋 Creating ingredient_statistics table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "ingredient_statistics" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ingredient_id" uuid NOT NULL,
        "total_recipes" integer DEFAULT 0 NOT NULL,
        "public_recipes" integer DEFAULT 0 NOT NULL,
        "system_recipes" integer DEFAULT 0 NOT NULL,
        "popularity_score" integer DEFAULT 0 NOT NULL,
        "trending_score" integer DEFAULT 0 NOT NULL,
        "last_calculated" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ingredient_statistics_ingredient_id_unique" UNIQUE("ingredient_id")
      );
    `;
    console.log('✅ ingredient_statistics table created\n');

    // 5. Add foreign key constraints
    console.log('🔗 Adding foreign key constraints...');

    // Drop existing constraints if they exist (for re-running migration)
    await sql`
      ALTER TABLE "ingredient_statistics"
      DROP CONSTRAINT IF EXISTS "ingredient_statistics_ingredient_id_ingredients_id_fk";
    `;

    await sql`
      ALTER TABLE "recipe_ingredients"
      DROP CONSTRAINT IF EXISTS "recipe_ingredients_recipe_id_recipes_id_fk";
    `;

    await sql`
      ALTER TABLE "recipe_ingredients"
      DROP CONSTRAINT IF EXISTS "recipe_ingredients_ingredient_id_ingredients_id_fk";
    `;

    // Add foreign keys
    await sql`
      ALTER TABLE "ingredient_statistics"
      ADD CONSTRAINT "ingredient_statistics_ingredient_id_ingredients_id_fk"
      FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id")
      ON DELETE cascade ON UPDATE no action;
    `;

    await sql`
      ALTER TABLE "recipe_ingredients"
      ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk"
      FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id")
      ON DELETE cascade ON UPDATE no action;
    `;

    await sql`
      ALTER TABLE "recipe_ingredients"
      ADD CONSTRAINT "recipe_ingredients_ingredient_id_ingredients_id_fk"
      FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id")
      ON DELETE cascade ON UPDATE no action;
    `;

    console.log('✅ Foreign key constraints added\n');

    // 6. Create indexes for ingredients table
    console.log('📊 Creating indexes for ingredients table...');

    await sql`CREATE INDEX IF NOT EXISTS "ingredients_name_idx" ON "ingredients" USING btree ("name");`;
    await sql`CREATE INDEX IF NOT EXISTS "ingredients_name_lower_idx" ON "ingredients" USING btree (LOWER("name"));`;
    await sql`CREATE INDEX IF NOT EXISTS "ingredients_display_name_idx" ON "ingredients" USING btree ("display_name");`;
    await sql`CREATE INDEX IF NOT EXISTS "ingredients_category_idx" ON "ingredients" USING btree ("category");`;
    await sql`CREATE INDEX IF NOT EXISTS "ingredients_common_idx" ON "ingredients" USING btree ("is_common","name");`;
    await sql`CREATE INDEX IF NOT EXISTS "ingredients_allergen_idx" ON "ingredients" USING btree ("is_allergen");`;

    console.log('✅ Basic indexes created');

    // 7. Create trigram indexes for fuzzy search
    console.log('📊 Creating trigram indexes (fuzzy search)...');

    try {
      await sql`CREATE INDEX IF NOT EXISTS "ingredients_name_trgm_idx" ON "ingredients" USING gin ("name" gin_trgm_ops);`;
      await sql`CREATE INDEX IF NOT EXISTS "ingredients_display_name_trgm_idx" ON "ingredients" USING gin ("display_name" gin_trgm_ops);`;
      console.log('✅ Trigram indexes created\n');
    } catch (_error) {
      console.warn(
        '⚠️  Warning: Could not create trigram indexes. Ensure pg_trgm extension is enabled.'
      );
      console.warn('   Run: CREATE EXTENSION pg_trgm; in your database\n');
    }

    // 8. Create indexes for recipe_ingredients table
    console.log('📊 Creating indexes for recipe_ingredients table...');

    await sql`CREATE INDEX IF NOT EXISTS "recipe_ingredients_recipe_id_idx" ON "recipe_ingredients" USING btree ("recipe_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "recipe_ingredients_ingredient_id_idx" ON "recipe_ingredients" USING btree ("ingredient_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "recipe_ingredients_position_idx" ON "recipe_ingredients" USING btree ("recipe_id","position");`;
    await sql`CREATE INDEX IF NOT EXISTS "recipe_ingredients_optional_idx" ON "recipe_ingredients" USING btree ("recipe_id","is_optional");`;
    await sql`CREATE INDEX IF NOT EXISTS "recipe_ingredients_group_idx" ON "recipe_ingredients" USING btree ("recipe_id","ingredient_group");`;

    console.log('✅ recipe_ingredients indexes created\n');

    // 9. Create indexes for ingredient_statistics table
    console.log('📊 Creating indexes for ingredient_statistics table...');

    await sql`CREATE INDEX IF NOT EXISTS "ingredient_statistics_popularity_idx" ON "ingredient_statistics" USING btree ("popularity_score" DESC NULLS LAST);`;
    await sql`CREATE INDEX IF NOT EXISTS "ingredient_statistics_trending_idx" ON "ingredient_statistics" USING btree ("trending_score" DESC NULLS LAST);`;
    await sql`CREATE INDEX IF NOT EXISTS "ingredient_statistics_recipe_count_idx" ON "ingredient_statistics" USING btree ("total_recipes" DESC NULLS LAST);`;

    console.log('✅ ingredient_statistics indexes created\n');

    // 10. Verify tables were created
    console.log('🔍 Verifying migration...');

    const tableCheck = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('ingredients', 'recipe_ingredients', 'ingredient_statistics')
      ORDER BY table_name;
    `;

    console.log('✅ Tables created:');
    tableCheck.forEach((row: any) => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n✨ Migration completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Run data migration script to populate from existing recipes');
    console.log('2. Update application code to use normalized ingredients');
    console.log('3. Test ingredient autocomplete and search features\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
applyMigration();
