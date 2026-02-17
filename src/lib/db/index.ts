import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as apiKeysSchema from './api-keys-schema';
import * as chefSchema from './chef-schema';
import * as ingredientsSchema from './ingredients-schema';
import * as schema from './schema';
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
};

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema: allSchemas });

// Export all schemas for external use
export { schema, userDiscoverySchema, chefSchema, ingredientsSchema, apiKeysSchema };

// Export type transformers and parsed types
export * from './transformers';
export * from './transformed-types';
