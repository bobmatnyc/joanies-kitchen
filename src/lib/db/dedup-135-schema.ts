/**
 * #135: tables for the staged duplicate-recipe merge (owner ruling Dcc).
 *
 * Why: losers are soft-deleted, so their old ids and slugs need a stored map
 * to the survivor, and every change the merge makes must be undoable exactly.
 * What: `recipe_redirects` (one row per retired recipe id; read by the recipe
 * route) and `dedup_135_ledger` (one row per change, written in the same
 * transaction as the change; read by `scripts/dedup-135/rollback.ts`).
 * Test: `src/lib/recipes/__tests__/dedup-merge-apply.test.ts`
 */

import { sql } from 'drizzle-orm';
import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { recipes } from './schema';

/**
 * A row means `/recipes/<from_recipe_id>` and `/recipes/<from_slug>` redirect
 * to the current slug of `to_recipe_id` (contract shared with the redirect route).
 */
export const recipeRedirects = pgTable(
  'recipe_redirects',
  {
    from_recipe_id: text('from_recipe_id').primaryKey(),
    from_slug: text('from_slug'),
    to_recipe_id: text('to_recipe_id')
      .notNull()
      .references(() => recipes.id),
    batch_id: text('batch_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    fromSlugUnique: uniqueIndex('recipe_redirects_from_slug_unique')
      .on(table.from_slug)
      .where(sql`${table.from_slug} IS NOT NULL`),
    toRecipeIdx: index('idx_recipe_redirects_to_recipe_id').on(table.to_recipe_id),
  })
);

/**
 * `kind` is one of: move, drop, soft_delete, keeper, redirect, group (the
 * per-group completion marker). `row_data` holds the full dropped row, or the
 * prior values of the changed columns, or the inserted redirect row.
 */
export const dedup135Ledger = pgTable(
  'dedup_135_ledger',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    batch_id: text('batch_id').notNull(),
    group_id: text('group_id').notNull(),
    kind: text('kind').notNull(),
    table_name: text('table_name'),
    column_name: text('column_name'),
    row_pk: jsonb('row_pk'),
    old_recipe_id: text('old_recipe_id'),
    new_recipe_id: text('new_recipe_id'),
    row_data: jsonb('row_data'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    rolled_back_at: timestamp('rolled_back_at', { withTimezone: true }),
  },
  (table) => ({
    batchGroupIdx: index('idx_dedup_135_ledger_batch_group').on(table.batch_id, table.group_id),
    groupKindIdx: index('idx_dedup_135_ledger_group_kind').on(table.group_id, table.kind),
  })
);
