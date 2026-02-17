#!/usr/bin/env tsx
/**
 * Create Missing Tables in Production Database
 *
 * Creates recipe_embeddings, recipe_ratings, and recipe_flags tables
 * that were missing from the new database
 */

import postgres from 'postgres';

const NEW_DB =
  'postgresql://neondb_owner:npg_rH9ODE8FgstI@ep-jolly-snow-addxski4-pooler.c-2.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require';

async function createTables() {
  console.log('🔧 Creating missing tables in ep-jolly-snow-addxski4...\n');
  const sql = postgres(NEW_DB);

  try {
    // Enable pgvector extension
    console.log('1. Enabling pgvector extension...');
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('   ✓ pgvector enabled\n');

    // Create recipe_embeddings table
    console.log('2. Creating recipe_embeddings table...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "recipe_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "recipe_id" text NOT NULL,
        "embedding" vector(384) NOT NULL,
        "embedding_text" text NOT NULL,
        "model_name" varchar(100) DEFAULT 'all-MiniLM-L6-v2' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now(),
        "updated_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "recipe_embeddings_recipe_id_recipes_id_fk"
          FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id")
          ON DELETE cascade ON UPDATE no action
      )
    `);
    console.log('   ✓ recipe_embeddings created\n');

    // Create recipe_ratings table
    console.log('3. Creating recipe_ratings table...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "recipe_ratings" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "recipe_id" text NOT NULL,
        "user_id" text NOT NULL,
        "rating" integer NOT NULL,
        "review" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "recipe_ratings_recipe_id_user_id_unique" UNIQUE("recipe_id","user_id"),
        CONSTRAINT "recipe_ratings_recipe_id_recipes_id_fk"
          FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id")
          ON DELETE cascade ON UPDATE no action
      )
    `);
    console.log('   ✓ recipe_ratings created\n');

    // Create recipe_flags table
    console.log('4. Creating recipe_flags table...');
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "recipe_flags" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "recipe_id" text NOT NULL,
        "user_id" text NOT NULL,
        "reason" text NOT NULL,
        "description" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "reviewed_by" text,
        "reviewed_at" timestamp,
        "review_notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "recipe_flags_recipe_id_recipes_id_fk"
          FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id")
          ON DELETE cascade ON UPDATE no action
      )
    `);
    console.log('   ✓ recipe_flags created\n');

    // Create indexes
    console.log('5. Creating indexes...');

    // recipe_ratings indexes
    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS "recipe_ratings_recipe_id_idx" ON "recipe_ratings" USING btree ("recipe_id")'
    );
    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS "recipe_ratings_user_id_idx" ON "recipe_ratings" USING btree ("user_id")'
    );

    // recipe_flags indexes
    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS "recipe_flags_recipe_id_idx" ON "recipe_flags" USING btree ("recipe_id")'
    );
    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS "recipe_flags_status_idx" ON "recipe_flags" USING btree ("status")'
    );
    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS "recipe_flags_user_id_idx" ON "recipe_flags" USING btree ("user_id")'
    );
    await sql.unsafe(
      'CREATE INDEX IF NOT EXISTS "recipe_flags_created_at_idx" ON "recipe_flags" USING btree ("created_at" DESC NULLS LAST)'
    );

    console.log('   ✓ Indexes created\n');

    // Verify tables
    console.log('6. Verifying tables...');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('recipe_embeddings', 'recipe_ratings', 'recipe_flags')
      ORDER BY table_name
    `;

    console.log(`   Found ${tables.length}/3 tables:`);
    tables.forEach((t) => console.log(`   ✓ ${t.table_name}`));

    console.log('\n✅ All tables created successfully!');
  } catch (error) {
    console.error('\n❌ Failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

createTables()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
