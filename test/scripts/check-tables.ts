#!/usr/bin/env tsx
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

async function main() {
  const result = await db.execute(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  console.log('Existing tables:');
  result.rows.forEach((row: any) => console.log(`  - ${row.tablename}`));
}

main().catch(console.error);
