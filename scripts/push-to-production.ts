#!/usr/bin/env tsx
/**
 * Push Schema to Production Database
 *
 * Uses drizzle-kit push with production DATABASE_URL
 */

import * as path from 'node:path';
import * as dotenv from 'dotenv';

// Load production environment variables
const result = dotenv.config({ path: path.join(process.cwd(), '.env.production') });

if (result.error) {
  console.error('❌ Failed to load .env.production:', result.error);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env.production');
  process.exit(1);
}

console.log('🔄 Pushing schema to production database...');
console.log(`📍 Database: ${databaseUrl.split('@')[1]?.split('?')[0] || 'unknown'}\n');

try {
  // Run drizzle-kit push with production DATABASE_URL
  execSync('pnpm drizzle-kit push', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });

  console.log('\n✅ Schema pushed to production successfully!');
  console.log('🎉 Production database is now up to date\n');
} catch (error) {
  console.error('\n❌ Failed to push schema:', error);
  process.exit(1);
}
