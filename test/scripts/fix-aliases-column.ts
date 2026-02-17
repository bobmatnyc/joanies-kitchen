import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';

async function fixAliasesColumn() {
  try {
    console.log('Fixing aliases column type...\n');

    // Change aliases from text to text[]
    await db.execute(
      sql`ALTER TABLE ingredients ALTER COLUMN aliases TYPE text[] USING string_to_array(aliases, ',')`
    );
    console.log('✅ Changed aliases column to text[] (ARRAY)');

    // Make created_at nullable
    await db.execute(sql`ALTER TABLE ingredients ALTER COLUMN created_at DROP NOT NULL`);
    console.log('✅ Made created_at nullable');

    console.log('\nSchema fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing schema:', error);
    process.exit(1);
  }
}

fixAliasesColumn();
