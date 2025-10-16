import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.production') });

async function enablePgvector() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL not found');
    process.exit(1);
  }

  console.log('Connecting to production database...');
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    console.log('Enabling pgvector extension...');
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
    console.log('pgvector extension enabled successfully!');
  } catch (error: any) {
    console.error('Failed:', error.message);
    throw error;
  } finally {
    await sql.end();
  }
}

enablePgvector().then(() => process.exit(0)).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
