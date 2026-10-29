import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as apiKeysSchema from './api-keys-schema';
import * as authSchema from './auth-schema';
import * as autonomousScraperSchema from './autonomous-scraper-schema';
import * as chefSchema from './chef-schema';
import * as ingredientsSchema from './ingredients-schema';
import { configureLocalNeonProxy } from './local-neon';
import * as schema from './schema';
import * as usageCountersSchema from './usage-counters-schema'; // #17: rate-limit counters
import * as userDiscoverySchema from './user-discovery-schema';

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

function createDb(databaseUrl: string) {
  // #60: loopback DATABASE_URL (EVO staging) goes through the local Neon HTTP proxy.
  configureLocalNeonProxy(neonConfig, databaseUrl);
  return drizzle(neon(databaseUrl), { schema: allSchemas });
}

type Db = ReturnType<typeof createDb>;

let cached: Db | undefined;

/**
 * Why: Vercel Preview builds run without DATABASE_URL (owner change A37), and a
 * client built at import made `next build` fail while collecting page data.
 * What: returns the process-wide client, creating it on first call. Throws when
 * DATABASE_URL is missing or not a postgres URL; the value is never echoed.
 * Test: `src/lib/db/__tests__/lazy-db.test.ts`
 */
export function getDb(): Db {
  if (cached) return cached;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    throw new Error(
      databaseUrl
        ? 'DATABASE_URL is set but is not a postgresql:// connection string.'
        : 'DATABASE_URL is not set; the database client cannot be created.'
    );
  }
  cached = createDb(databaseUrl);
  return cached;
}

/** Lazy handle: any property access resolves (and validates) the client via `getDb()`. */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
  has: (_target, prop) => Reflect.has(getDb(), prop),
  getPrototypeOf: () => Reflect.getPrototypeOf(getDb()),
});

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

export * from './transformed-types';
// Export type transformers and parsed types
export * from './transformers';
