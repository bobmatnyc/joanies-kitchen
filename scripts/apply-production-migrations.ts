#!/usr/bin/env tsx
/**
 * Apply Database Migrations to Production
 *
 * This script applies all pending migrations to the production database
 * using the DATABASE_URL from .env.production
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load production environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.production') });

async function applyMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in .env.production');
    process.exit(1);
  }

  console.log('🔄 Connecting to production database...');
  console.log(`📍 Database: ${databaseUrl.split('@')[1]?.split('?')[0] || 'unknown'}`);

  // Create postgres connection
  const migrationClient = postgres(databaseUrl, { max: 1 });

  try {
    console.log('\n🚀 Applying migrations...\n');

    // Apply migrations
    await migrate(drizzle(migrationClient), {
      migrationsFolder: './drizzle',
    });

    console.log('\n✅ All migrations applied successfully!');
    console.log('🎉 Production database is now up to date\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await migrationClient.end();
  }
}

applyMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
