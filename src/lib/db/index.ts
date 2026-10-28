import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as apiKeysSchema from './api-keys-schema';
import * as authSchema from './auth-schema';
import * as autonomousScraperSchema from './autonomous-scraper-schema';
import * as chefSchema from './chef-schema';
import * as ingredientsSchema from './ingredients-schema';
import * as schema from './schema';
import * as usageCountersSchema from './usage-counters-schema'; // #17: rate-limit counters
import * as userDiscoverySchema from './user-discovery-schema';

// Ensure we have a valid DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || '';

// Log the issue for debugging
if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
  console.error('Invalid DATABASE_URL:', databaseUrl);
  throw new Error(
    'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql://. ' +
      'Current value: ' +
      (databaseUrl || 'undefined')
  );
}

// Combine all schemas
const allSchemas = {
  ...schema,
  ...userDiscoverySchema,
  ...chefSchema,
  ...ingredientsSchema,
  ...apiKeysSchema,
  ...autonomousScraperSchema,
  ...authSchema, // #22: Auth.js tables
  ...usageCountersSchema, // #17/#57: rate-limit and alert counters
};

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema: allSchemas });

// Export all schemas for external use
export {
  schema,
  userDiscoverySchema,
  chefSchema,
  ingredientsSchema,
  apiKeysSchema,
  autonomousScraperSchema,
  authSchema,
};

// Export type transformers and parsed types
export * from './transformers';
export * from './transformed-types';
