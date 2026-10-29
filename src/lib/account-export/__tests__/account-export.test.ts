// @vitest-environment node
/** #58: the account export is scoped to one user, covers every user-owned table, and drops secrets. */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
import { buildUserExport, EXCLUDED_COLUMNS, EXPORT_SCHEMA_VERSION, EXPORTED_TABLES } from '..';
import { SECRETS, seedExportDb } from './export-fixture';

/** Every schema module under src/lib/db, keyed by file name. */
const SCHEMA_MODULES: Record<string, Record<string, unknown>> = {
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

/** Columns that name the owning user. `created_by` covers meal_templates. */
const OWNER_COLUMNS = new Set(['user_id', 'created_by']);

let fx: Awaited<ReturnType<typeof seedExportDb>>;

beforeAll(async () => {
  fx = await seedExportDb();
});
afterAll(async () => {
  await fx.client.close();
});

describe('buildUserExport', () => {
  it("returns A's rows in every section and no id belonging to B", async () => {
    const out = await buildUserExport(fx.db, fx.userA, new Date('2026-10-29T12:00:00Z'));
    expect(out.exported_at).toBe('2026-10-29T12:00:00.000Z');
    expect(out.schema_version).toBe(EXPORT_SCHEMA_VERSION);
    for (const section of EXPORTED_TABLES) {
      expect(out.data[section], section).toHaveLength(1);
    }
    const text = JSON.stringify(out);
    for (const id of fx.bIds) expect(text).not.toContain(id);
    for (const id of fx.aIds) expect(text).toContain(id);
    expect(text).not.toContain(fx.systemTemplateId);
    expect(text).toContain('https://blob.example.com/a.jpg');
  });

  it('omits OAuth tokens and the API key hash', async () => {
    const out = await buildUserExport(fx.db, fx.userA);
    const text = JSON.stringify(out);
    for (const secret of Object.values(SECRETS)) expect(text).not.toContain(secret);
    const account = out.data.accounts[0] as Record<string, unknown>;
    for (const key of ['access_token', 'refresh_token', 'id_token', 'session_state']) {
      expect(account).not.toHaveProperty(key);
    }
    expect(account.provider).toBe('google');
    const key = out.data.api_keys[0] as Record<string, unknown>;
    expect(key).not.toHaveProperty('key_hash');
    expect(key.key_prefix).toBe('jk_live_abcd');
    expect(EXCLUDED_COLUMNS.api_keys).toContain('key_hash');
  });

  it('rejects, with no partial result, when one table query fails', async () => {
    const broken = await seedExportDb();
    await broken.client.exec('DROP TABLE "waste_tracking";');
    await expect(buildUserExport(broken.db, broken.userA)).rejects.toThrow();
    await broken.client.close();
  });
});

describe('export table coverage', () => {
  it('lists every schema module in src/lib/db', () => {
    const dir = path.resolve(__dirname, '../../db');
    const withTables = readdirSync(dir).filter(
      (f) => f.endsWith('.ts') && readFileSync(path.join(dir, f), 'utf8').includes('pgTable(')
    );
    expect(Object.keys(SCHEMA_MODULES).sort()).toEqual(withTables.sort());
  });

  it('covers every table with an owner column', () => {
    const owned = new Set<string>();
    for (const mod of Object.values(SCHEMA_MODULES)) {
      for (const value of Object.values(mod)) {
        if (!is(value, PgTable)) continue;
        const config = getTableConfig(value);
        if (config.columns.some((c) => OWNER_COLUMNS.has(c.name))) owned.add(config.name);
      }
    }
    expect(owned.size).toBeGreaterThan(10);
    const missing = [...owned].filter((name) => !(EXPORTED_TABLES as string[]).includes(name));
    expect(missing).toEqual([]);
  });
});
