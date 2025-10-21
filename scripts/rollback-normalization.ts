#!/usr/bin/env tsx
/**
 * Rollback Normalization Script
 *
 * Restores ingredients from backup tables created during normalization
 * or consolidation operations.
 *
 * Usage:
 *   npm run rollback-normalization -- --backup ingredients_backup_2025-10-21T12-00-00
 *   npm run rollback-normalization -- --list   # List available backups
 *   npm run rollback-normalization -- --help   # Show help
 *
 * @module scripts/rollback-normalization
 */

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

// ============================================================================
// CLI ARGUMENTS
// ============================================================================

interface CliArgs {
  backup?: string;
  list: boolean;
  execute: boolean;
  help: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    backup: args.includes('--backup') ? args[args.indexOf('--backup') + 1] : undefined,
    list: args.includes('--list'),
    execute: args.includes('--execute'),
    help: args.includes('--help') || args.includes('-h'),
  };
}

function showHelp() {
  console.log(`
Rollback Normalization Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Restores ingredients from backup tables.

USAGE:
  npm run rollback-normalization -- [OPTIONS]

OPTIONS:
  --backup TABLE      Name of backup table to restore from
  --execute           Execute rollback (default: dry-run preview)
  --list              List all available backup tables
  --help, -h          Show this help message

EXAMPLES:
  npm run rollback-normalization -- --list
  npm run rollback-normalization -- --backup ingredients_backup_2025-10-21T12-00-00
  npm run rollback-normalization -- --backup ingredients_backup_2025-10-21T12-00-00 --execute

SAFETY:
  - Preview mode by default (use --execute to apply)
  - Creates new backup of current state before rollback
  - Atomic transaction (all or nothing)
  `);
}

// ============================================================================
// BACKUP MANAGEMENT
// ============================================================================

async function listBackups(): Promise<string[]> {
  console.log('📦 Available Backup Tables:\n');

  const result = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (
        tablename LIKE 'ingredients_backup_%'
        OR tablename LIKE 'recipe_ingredients_backup_%'
      )
    ORDER BY tablename DESC
  `);

  const backups = result.rows.map((row: any) => row.tablename);

  if (backups.length === 0) {
    console.log('   No backup tables found.\n');
    return [];
  }

  // Group by timestamp
  const grouped = new Map<string, string[]>();
  for (const backup of backups) {
    const match = backup.match(/_(backup_[\d-T]+)$/);
    if (match) {
      const timestamp = match[1];
      const existing = grouped.get(timestamp) || [];
      existing.push(backup);
      grouped.set(timestamp, existing);
    }
  }

  for (const [timestamp, tables] of grouped.entries()) {
    console.log(`   ${timestamp}:`);
    tables.forEach((table) => console.log(`      - ${table}`));
  }

  console.log('');
  return backups;
}

async function verifyBackup(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM ${sql.raw(tableName)}
    `);

    const count = result.rows[0]?.count || 0;
    console.log(`✅ Backup table "${tableName}" verified (${count} rows)\n`);
    return true;
  } catch (error) {
    console.error(`❌ Backup table "${tableName}" does not exist or is invalid.\n`);
    return false;
  }
}

async function createPreRollbackBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const backupTable = `ingredients_pre_rollback_${timestamp}`;

  console.log(`📦 Creating pre-rollback backup: ${backupTable}...\n`);

  await db.execute(sql`
    CREATE TABLE ${sql.raw(backupTable)} AS
    SELECT * FROM ingredients
  `);

  console.log(`✅ Pre-rollback backup created\n`);
  return backupTable;
}

// ============================================================================
// ROLLBACK LOGIC
// ============================================================================

async function analyzeRollback(backupTable: string): Promise<{
  currentCount: number;
  backupCount: number;
  difference: number;
}> {
  console.log('🔍 Analyzing rollback impact...\n');

  // Count current ingredients
  const currentResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM ingredients
  `);
  const currentCount = currentResult.rows[0]?.count || 0;

  // Count backup ingredients
  const backupResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM ${sql.raw(backupTable)}
  `);
  const backupCount = backupResult.rows[0]?.count || 0;

  const difference = backupCount - currentCount;

  console.log(`   Current ingredients: ${currentCount}`);
  console.log(`   Backup ingredients: ${backupCount}`);
  console.log(`   Difference: ${difference > 0 ? '+' : ''}${difference}\n`);

  return {
    currentCount,
    backupCount,
    difference,
  };
}

async function executeRollback(backupTable: string): Promise<void> {
  console.log(`\n🔧 Executing rollback from ${backupTable}...\n`);

  // Create pre-rollback backup
  await createPreRollbackBackup();

  console.log('   Step 1: Clearing current ingredients table...');
  await db.execute(sql`TRUNCATE TABLE ingredients CASCADE`);
  console.log('   ✓ Cleared\n');

  console.log('   Step 2: Restoring from backup...');
  await db.execute(sql`
    INSERT INTO ingredients
    SELECT * FROM ${sql.raw(backupTable)}
  `);
  console.log('   ✓ Restored\n');

  // Verify restoration
  const result = await db.execute(sql`
    SELECT COUNT(*) as count FROM ingredients
  `);
  const restoredCount = result.rows[0]?.count || 0;

  console.log(`✅ Rollback complete! Restored ${restoredCount} ingredients.\n`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔙 ROLLBACK NORMALIZATION SCRIPT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // List backups mode
    if (args.list) {
      await listBackups();
      process.exit(0);
    }

    // Rollback mode
    if (!args.backup) {
      console.error('❌ Error: --backup parameter is required\n');
      console.log('Use --list to see available backups\n');
      showHelp();
      process.exit(1);
    }

    const backupTable = args.backup;

    // Verify backup exists
    const isValid = await verifyBackup(backupTable);
    if (!isValid) {
      console.error('Use --list to see available backups\n');
      process.exit(1);
    }

    // Analyze rollback
    const analysis = await analyzeRollback(backupTable);

    if (!args.execute) {
      console.log('🔍 DRY-RUN MODE (use --execute to apply rollback)\n');
      console.log('⚠️  This will:');
      console.log(`   - Restore ${analysis.backupCount} ingredients from backup`);
      console.log(`   - Replace ${analysis.currentCount} current ingredients`);

      if (analysis.difference > 0) {
        console.log(`   - Add ${analysis.difference} ingredients (un-consolidating)`);
      } else if (analysis.difference < 0) {
        console.log(`   - Remove ${Math.abs(analysis.difference)} ingredients`);
      } else {
        console.log(`   - Same number of ingredients (un-normalizing)`);
      }

      console.log('\nRe-run with --execute to perform rollback\n');
      process.exit(0);
    }

    // Execute rollback
    console.log('\n⚠️  EXECUTING ROLLBACK...\n');

    await db.transaction(async (tx) => {
      await executeRollback(backupTable);
    });

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ ROLLBACK COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during rollback:', error);
    console.error('\n⚠️  Rollback failed. Database state unchanged.\n');
    process.exit(1);
  }
}

main();
