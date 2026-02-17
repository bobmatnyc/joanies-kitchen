#!/usr/bin/env tsx

/**
 * Apply performance indexes to the recipes table
 * Run this script to optimize database queries for pagination with 400K+ recipes
 *
 * Usage:
 *   pnpm tsx scripts/apply-performance-indexes.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function applyIndexes() {
  console.log('🚀 Applying performance indexes to recipes table...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'drizzle', 'add-performance-indexes.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

    // Split into individual statements (separated by semicolons)
    const statements = sqlContent
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Extract index name for logging
      const indexNameMatch = statement.match(/idx_recipes_\w+/);
      const indexName = indexNameMatch ? indexNameMatch[0] : `statement ${i + 1}`;

      console.log(`⏳ Creating index: ${indexName}...`);

      try {
        await db.execute(sql.raw(statement));
        console.log(`✅ Created: ${indexName}\n`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`ℹ️  Already exists: ${indexName}\n`);
        } else {
          console.error(`❌ Failed to create ${indexName}:`, error.message);
          throw error;
        }
      }
    }

    console.log('✅ All indexes applied successfully!\n');
    console.log('📊 Verifying indexes...\n');

    // Verify indexes exist
    const indexQuery = await db.execute(sql`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'recipes'
        AND indexname LIKE 'idx_recipes_%'
      ORDER BY indexname;
    `);

    if (indexQuery.rows && indexQuery.rows.length > 0) {
      console.log('📋 Current indexes on recipes table:');
      indexQuery.rows.forEach((row: any) => {
        console.log(`   - ${row.indexname}`);
      });
      console.log(`\n✨ Total: ${indexQuery.rows.length} performance indexes\n`);
    }

    // Get table statistics
    const statsQuery = await db.execute(sql`
      SELECT
        schemaname,
        tablename,
        n_live_tup as row_count,
        n_dead_tup as dead_rows
      FROM pg_stat_user_tables
      WHERE tablename = 'recipes';
    `);

    if (statsQuery.rows && statsQuery.rows.length > 0) {
      const stats = statsQuery.rows[0] as any;
      console.log('📈 Table statistics:');
      console.log(`   - Total rows: ${stats.row_count?.toLocaleString() || 0}`);
      console.log(`   - Dead rows: ${stats.dead_rows || 0}`);
      console.log('');
    }

    console.log('🎉 Performance optimization complete!\n');
    console.log('💡 Tips:');
    console.log('   - These indexes will significantly speed up pagination queries');
    console.log('   - Run ANALYZE recipes; periodically to update query planner statistics');
    console.log('   - Monitor index usage with pg_stat_user_indexes');
    console.log('');
  } catch (error) {
    console.error('❌ Error applying indexes:', error);
    process.exit(1);
  }

  process.exit(0);
}

applyIndexes();
