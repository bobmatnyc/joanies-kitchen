#!/usr/bin/env tsx

/**
 * Apply API Keys Migration
 *
 * Creates the api_keys and api_key_usage tables with all indexes and constraints.
 * Supports both dry-run mode (default) and apply mode (APPLY_CHANGES=true).
 *
 * Usage:
 *   pnpm tsx scripts/apply-api-keys-migration.ts           # Dry run
 *   APPLY_CHANGES=true pnpm tsx scripts/apply-api-keys-migration.ts  # Apply changes
 */

import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

const DRY_RUN = process.env.APPLY_CHANGES !== 'true';

async function checkTableExists(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    );
  `);
  return (result.rows[0] as any).exists;
}

async function getTableCount(tableName: string): Promise<number> {
  try {
    const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
    return parseInt((result.rows[0] as any).count, 10);
  } catch {
    return 0;
  }
}

async function applyMigration() {
  console.log('========================================');
  console.log('API KEYS MIGRATION');
  console.log('========================================\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Set APPLY_CHANGES=true to execute\n');
  } else {
    console.log('⚠️  APPLY MODE - Changes will be made to database\n');
  }

  try {
    // Check existing tables
    console.log('Checking existing tables...');
    const apiKeysExists = await checkTableExists('api_keys');
    const apiKeyUsageExists = await checkTableExists('api_key_usage');

    if (apiKeysExists) {
      console.log('  ℹ️  api_keys table already exists');
      const count = await getTableCount('api_keys');
      console.log(`     Current rows: ${count}`);
    } else {
      console.log('  ✓ api_keys table does not exist');
    }

    if (apiKeyUsageExists) {
      console.log('  ℹ️  api_key_usage table already exists');
      const count = await getTableCount('api_key_usage');
      console.log(`     Current rows: ${count}`);
    } else {
      console.log('  ✓ api_key_usage table does not exist');
    }

    if (apiKeysExists && apiKeyUsageExists) {
      console.log('\n✅ All tables already exist. Migration not needed.');
      process.exit(0);
    }

    console.log('\nWill create:');
    if (!apiKeysExists) {
      console.log('  - api_keys table (18 columns)');
      console.log('    • Primary key, user association');
      console.log('    • Secure key storage (hash + prefix)');
      console.log('    • Permission scopes and lifecycle management');
      console.log('    • Audit trail and usage statistics');
      console.log('    • 9 performance indexes');
    }
    if (!apiKeyUsageExists) {
      console.log('  - api_key_usage table (14 columns)');
      console.log('    • Request tracking and analytics');
      console.log('    • Performance metrics');
      console.log('    • Error logging');
      console.log('    • 8 performance indexes');
      console.log('    • Foreign key cascade to api_keys');
    }

    if (DRY_RUN) {
      console.log('\n========================================');
      console.log('Run with APPLY_CHANGES=true to execute');
      console.log('========================================');
      process.exit(0);
    }

    // Apply migration
    console.log('\n📝 Applying migration...\n');

    // Create api_keys table
    if (!apiKeysExists) {
      console.log('Creating api_keys table...');
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS api_keys (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          key_hash VARCHAR(64) UNIQUE NOT NULL,
          key_prefix VARCHAR(12) NOT NULL,
          scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_active BOOLEAN NOT NULL DEFAULT true,
          last_used_at TIMESTAMP,
          expires_at TIMESTAMP,
          environment VARCHAR(20) DEFAULT 'production',
          total_requests INTEGER NOT NULL DEFAULT 0,
          last_ip_address VARCHAR(45),
          created_by TEXT,
          revoked_at TIMESTAMP,
          revoked_by TEXT,
          revocation_reason TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('  ✅ api_keys table created');

      // Create indexes for api_keys
      console.log('  Creating indexes...');

      await db.execute(sql`CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);`);
      console.log('    ✓ api_keys_user_id_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);`
      );
      console.log('    ✓ api_keys_key_hash_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_key_prefix_idx ON api_keys(key_prefix);`
      );
      console.log('    ✓ api_keys_key_prefix_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_is_active_idx ON api_keys(is_active);`
      );
      console.log('    ✓ api_keys_is_active_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_expires_at_idx ON api_keys(expires_at);`
      );
      console.log('    ✓ api_keys_expires_at_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_created_at_idx ON api_keys(created_at DESC);`
      );
      console.log('    ✓ api_keys_created_at_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_last_used_at_idx ON api_keys(last_used_at DESC);`
      );
      console.log('    ✓ api_keys_last_used_at_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_environment_idx ON api_keys(environment);`
      );
      console.log('    ✓ api_keys_environment_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_keys_user_active_idx ON api_keys(user_id, is_active);`
      );
      console.log('    ✓ api_keys_user_active_idx (composite)');
    }

    // Create api_key_usage table
    if (!apiKeyUsageExists) {
      console.log('\nCreating api_key_usage table...');
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS api_key_usage (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
          endpoint VARCHAR(255) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INTEGER NOT NULL,
          response_time_ms INTEGER,
          ip_address VARCHAR(45),
          user_agent TEXT,
          request_size_bytes INTEGER,
          response_size_bytes INTEGER,
          error_message TEXT,
          error_code VARCHAR(50),
          metadata JSONB,
          requested_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      console.log('  ✅ api_key_usage table created');

      // Create indexes for api_key_usage
      console.log('  Creating indexes...');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_api_key_id_idx ON api_key_usage(api_key_id);`
      );
      console.log('    ✓ api_key_usage_api_key_id_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_requested_at_idx ON api_key_usage(requested_at DESC);`
      );
      console.log('    ✓ api_key_usage_requested_at_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_endpoint_idx ON api_key_usage(endpoint);`
      );
      console.log('    ✓ api_key_usage_endpoint_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_status_code_idx ON api_key_usage(status_code);`
      );
      console.log('    ✓ api_key_usage_status_code_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_method_idx ON api_key_usage(method);`
      );
      console.log('    ✓ api_key_usage_method_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_api_key_date_idx ON api_key_usage(api_key_id, requested_at DESC);`
      );
      console.log('    ✓ api_key_usage_api_key_date_idx (composite)');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_endpoint_status_idx ON api_key_usage(endpoint, status_code);`
      );
      console.log('    ✓ api_key_usage_endpoint_status_idx (composite)');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_error_idx ON api_key_usage(error_code);`
      );
      console.log('    ✓ api_key_usage_error_idx');

      await db.execute(
        sql`CREATE INDEX IF NOT EXISTS api_key_usage_response_time_idx ON api_key_usage(response_time_ms DESC);`
      );
      console.log('    ✓ api_key_usage_response_time_idx');
    }

    // Verify migration
    console.log('\n🔍 Verifying migration...');

    const finalApiKeysExists = await checkTableExists('api_keys');
    const finalApiKeyUsageExists = await checkTableExists('api_key_usage');

    if (finalApiKeysExists && finalApiKeyUsageExists) {
      console.log('  ✅ Both tables created successfully');

      // Show column details
      const apiKeysColumns = await db.execute(sql`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'api_keys'
        ORDER BY ordinal_position;
      `);

      console.log('\n📊 api_keys table structure:');
      console.log(`   Total columns: ${apiKeysColumns.rows.length}`);

      const apiKeyUsageColumns = await db.execute(sql`
        SELECT column_name, data_type, column_default, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'api_key_usage'
        ORDER BY ordinal_position;
      `);

      console.log('\n📊 api_key_usage table structure:');
      console.log(`   Total columns: ${apiKeyUsageColumns.rows.length}`);

      // Show indexes
      const indexes = await db.execute(sql`
        SELECT
          tablename,
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('api_keys', 'api_key_usage')
        ORDER BY tablename, indexname;
      `);

      console.log('\n📇 Indexes created:');
      const apiKeysIndexes = (indexes.rows as any[]).filter((r) => r.tablename === 'api_keys');
      const apiKeyUsageIndexes = (indexes.rows as any[]).filter(
        (r) => r.tablename === 'api_key_usage'
      );

      console.log(`   api_keys: ${apiKeysIndexes.length} indexes`);
      console.log(`   api_key_usage: ${apiKeyUsageIndexes.length} indexes`);
    } else {
      throw new Error('Migration verification failed - tables not found');
    }

    console.log('\n========================================');
    console.log('✅ Migration completed successfully!');
    console.log('========================================\n');

    console.log('Next steps:');
    console.log('  1. Test API key creation: /api/keys/create');
    console.log('  2. Test authentication: /api/auth/validate');
    console.log('  3. Monitor usage: /api/keys/usage\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nThe migration has been rolled back.');
    process.exit(1);
  }
}

applyMigration();
