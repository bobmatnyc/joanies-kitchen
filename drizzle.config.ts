import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local file
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Validate DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
  console.error('Invalid DATABASE_URL in drizzle.config:', databaseUrl || 'undefined');
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
}

export default defineConfig({
  schema: [
    './src/lib/db/schema.ts',
    './src/lib/db/user-discovery-schema.ts',
    './src/lib/db/chef-schema.ts',
    './src/lib/db/ingredients-schema.ts'
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});