/**
 * #58/#104: every schema module under src/lib/db, keyed by file name, plus
 * every drizzle table they define. Shared by the export coverage test and the
 * purge column-inventory test; `lists every schema module` keeps it complete.
 */
import { is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import * as apiKeysSchema from '@/lib/db/api-keys-schema';
import * as authSchema from '@/lib/db/auth-schema';
import * as scraperSchema from '@/lib/db/autonomous-scraper-schema';
import * as chefSchema from '@/lib/db/chef-schema';
import * as ingredientsSchema from '@/lib/db/ingredients-schema';
import * as inventorySchema from '@/lib/db/inventory-schema';
import * as mealsSchema from '@/lib/db/meals-schema';
import * as schema from '@/lib/db/schema';
import * as usageCountersSchema from '@/lib/db/usage-counters-schema';
import * as discoverySchema from '@/lib/db/user-discovery-schema';

export const SCHEMA_MODULES: Record<string, Record<string, unknown>> = {
  'api-keys-schema.ts': apiKeysSchema,
  'auth-schema.ts': authSchema,
  'autonomous-scraper-schema.ts': scraperSchema,
  'chef-schema.ts': chefSchema,
  'ingredients-schema.ts': ingredientsSchema,
  'inventory-schema.ts': inventorySchema,
  'meals-schema.ts': mealsSchema,
  'schema.ts': schema,
  'usage-counters-schema.ts': usageCountersSchema,
  'user-discovery-schema.ts': discoverySchema,
};

/** Every drizzle table exported by a schema module. */
export function allSchemaTables(): PgTable[] {
  return Object.values(SCHEMA_MODULES).flatMap((mod) =>
    Object.values(mod).filter((value): value is PgTable => is(value, PgTable))
  );
}
