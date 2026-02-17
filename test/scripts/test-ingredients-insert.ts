import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

async function testInsert() {
  console.log('🧪 Testing ingredients table INSERT...\n');

  const sql = neon(DATABASE_URL!);

  try {
    // Test INSERT
    const result = await sql`
      INSERT INTO ingredients (name, display_name, category, common_units, aliases, is_common)
      VALUES (
        'test garlic',
        'Test Garlic',
        'vegetables',
        '["clove", "teaspoon", "tablespoon"]',
        '["test ail"]',
        true
      )
      RETURNING *;
    `;

    console.log('✅ INSERT successful!');
    console.log('Inserted record:', result[0]);

    // Clean up test record
    await sql`DELETE FROM ingredients WHERE name = 'test garlic'`;
    console.log('\n🧹 Test record cleaned up\n');

    console.log('✅ Ingredients table is ready to use!');
  } catch (error) {
    console.error('❌ INSERT failed:', error);
    process.exit(1);
  }
}

testInsert();
