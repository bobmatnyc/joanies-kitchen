import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import * as userDiscoverySchema from './user-discovery-schema';
import * as chefSchema from './chef-schema';

// Ensure we have a valid DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || '';

// Log the issue for debugging
if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
  console.error('Invalid DATABASE_URL:', databaseUrl);
  throw new Error(
    'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql://. ' +
    'Current value: ' + (databaseUrl || 'undefined')
  );
}

// Combine all schemas
const allSchemas = { ...schema, ...userDiscoverySchema, ...chefSchema };

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema: allSchemas });

// Export all schemas for external use
export { schema, userDiscoverySchema, chefSchema };