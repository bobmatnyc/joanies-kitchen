import * as path from 'node:path';
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DATABASE_URL = process.env.DATABASE_URL;

async function fixSchema() {
  console.log('🔧 Fixing ingredients table schema...\n');

  const sql = neon(DATABASE_URL!);

  try {
    console.log('Dropping old columns that dont match schema...');

    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS subcategory CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS standard_unit CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS unit_type CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS grams_per_cup CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS ml_per_cup CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS typical_package_size CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS average_price_usd CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS shelf_life_days CASCADE`;
    await sql`ALTER TABLE ingredients DROP COLUMN IF EXISTS storage_location CASCADE`;

    console.log('✅ Old columns dropped\n');

    console.log('Adding expected columns...');

    await sql`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS common_units text`;
    await sql`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS typical_unit varchar(20)`;

    console.log('✅ New columns added\n');

    console.log('Updating category column to varchar(50)...');
    await sql`ALTER TABLE ingredients ALTER COLUMN category TYPE varchar(50)`;

    console.log('✅ Category column updated\n');

    console.log('🎉 Schema fix complete!');
  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixSchema();
