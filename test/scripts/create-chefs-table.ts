import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * Creates the chefs table in the database
 */

async function createChefsTable() {
  console.log('Creating chefs table...\n');

  try {
    // Create the chefs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "chefs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "slug" varchar(255) NOT NULL UNIQUE,
        "bio" text,
        "avatar_url" text,
        "specialties" text,
        "website" text,
        "instagram" text,
        "twitter" text,
        "youtube" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    console.log('✓ Chefs table created');

    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "chefs_slug_idx" ON "chefs" ("slug");
    `);
    console.log('✓ Slug index created');

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "chefs_name_idx" ON "chefs" ("name");
    `);
    console.log('✓ Name index created');

    // Add foreign key to recipes table if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'recipes_chef_id_chefs_id_fk'
        ) THEN
          ALTER TABLE "recipes"
          ADD CONSTRAINT "recipes_chef_id_chefs_id_fk"
          FOREIGN KEY ("chef_id") REFERENCES "chefs"("id")
          ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log('✓ Foreign key constraint added');

    console.log('\nChefs table created successfully!');
  } catch (error) {
    console.error('Error creating chefs table:', error);
    throw error;
  }
}

createChefsTable()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to create chefs table:', error);
    process.exit(1);
  });
