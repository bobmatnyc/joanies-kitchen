/**
 * Database connection with transaction support for scripts
 *
 * Uses Neon's WebSocket driver instead of HTTP for transaction support.
 * This is necessary for atomic operations in consolidation and migration scripts.
 */

import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as chefSchema from '../src/lib/db/chef-schema';
import * as ingredientsSchema from '../src/lib/db/ingredients-schema';
import * as schema from '../src/lib/db/schema';
import * as userDiscoverySchema from '../src/lib/db/user-discovery-schema';

// Ensure we have a valid DATABASE_URL
const databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
  throw new Error(
    'DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql://. ' +
      'Current value: ' +
      (databaseUrl || 'undefined')
  );
}

// Combine all schemas
const allSchemas = { ...schema, ...userDiscoverySchema, ...chefSchema, ...ingredientsSchema };

// Create connection pool with transaction support
const pool = new Pool({ connectionString: databaseUrl });

// Export database with transaction support
export const db = drizzle(pool, { schema: allSchemas });

// Export cleanup function
export async function cleanup() {
  await pool.end();
}
