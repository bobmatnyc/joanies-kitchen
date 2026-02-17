import path from 'node:path';
import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Load .env.local file with override to ensure we get the right DATABASE_URL
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined');
}

// Validate it's a PostgreSQL URL
if (!databaseUrl.startsWith('postgresql://')) {
  throw new Error(
    `DATABASE_URL must be a PostgreSQL connection string. Got: ${databaseUrl.substring(0, 30)}...`
  );
}

// Type assertion to ensure TypeScript knows databaseUrl is defined
const validDatabaseUrl: string = databaseUrl;

async function cleanupUnusedTables() {
  console.log('🧹 Starting database cleanup...\n');

  // Create connection
  const client = postgres(validDatabaseUrl);
  const db = drizzle(client);

  try {
    // List all tables before cleanup
    console.log('📋 Current tables in database:');
    const tablesResult = await db.execute(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const currentTables = (tablesResult as any[]).map((row: any) => row.tablename);
    console.log('Found tables:', currentTables);
    console.log('\n');

    // Tables to remove
    const tablesToDrop = ['appointments', 'contacts', 'demo_users', 'trip_accounts'];
    const protectedTables = ['recipes'];

    // Safety check - ensure we're not dropping protected tables
    for (const table of protectedTables) {
      if (tablesToDrop.includes(table)) {
        throw new Error(`Safety check failed: Attempted to drop protected table '${table}'`);
      }
    }

    console.log('🗑️  Tables to remove:', tablesToDrop);
    console.log('🛡️  Protected tables:', protectedTables);
    console.log('\n');

    // Drop unused tables
    let droppedCount = 0;
    for (const table of tablesToDrop) {
      if (currentTables.includes(table)) {
        console.log(`Dropping table: ${table}...`);
        await db.execute(sql.raw(`DROP TABLE IF EXISTS ${table} CASCADE`));
        console.log(`✅ Dropped table: ${table}`);
        droppedCount++;
      } else {
        console.log(`⏭️  Table '${table}' does not exist, skipping...`);
      }
    }

    console.log(`\n🎯 Dropped ${droppedCount} table(s)\n`);

    // List remaining tables after cleanup
    console.log('📋 Remaining tables after cleanup:');
    const remainingTablesResult = await db.execute(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const remainingTables = (remainingTablesResult as any[]).map((row: any) => row.tablename);
    console.log('Remaining tables:', remainingTables);

    // Verify recipes table still exists
    if (remainingTables.includes('recipes')) {
      console.log('\n✅ Success: recipes table is intact');

      // Count records in recipes table to verify it's accessible
      const recipeCount = await db.execute(sql`SELECT COUNT(*) as count FROM recipes`);
      console.log(`   Recipe records in database: ${(recipeCount as any[])[0].count}`);
    } else {
      console.error('\n❌ Error: recipes table not found!');
      throw new Error('recipes table is missing after cleanup');
    }

    console.log('\n🎉 Database cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  } finally {
    // Close connection
    await client.end();
  }
}

// Run the cleanup
cleanupUnusedTables().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
