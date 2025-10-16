import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function verifySlugColumn() {
  try {
    const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name = 'slug'
    `);

    console.log('✓ Slug column exists:', result.length > 0);
    console.log('Result:', result);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking slug column:', error);
    process.exit(1);
  }
}

verifySlugColumn();
