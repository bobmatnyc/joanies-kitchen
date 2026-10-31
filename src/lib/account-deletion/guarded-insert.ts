/**
 * #208: the guarded INSERT for user-content writes that an account with a
 * pending deletion must not make (comments, forks, collections, reports, and
 * meals since #217).
 *
 * Why: the account purge reads its lock set once. A row the departing user
 * writes while the purge runs can lock a row the purge never locked (40P01),
 * or outlive the purge with no `users` row behind it, where
 * `authorNotPendingDeletion` no longer hides it. neon-http has no interactive
 * transaction, so a pre-check in a query of its own cannot close that window.
 * The check rides in the write statement, as in #197, #208 favorites and #210.
 * What: `insertUnlessPendingDeletion` runs one statement:
 * `WITH allowed AS (SELECT 1 WHERE NOT EXISTS (pending deletion)), inserted AS
 * (INSERT … SELECT … FROM allowed RETURNING *) SELECT …`. It answers whether
 * the guard allowed the write and the inserted row, typed like `.returning()`.
 * Ids with no `users` row pass. A refused write inserts nothing and takes no
 * row lock.
 * Test: `src/lib/__tests__/user-writes-pending-deletion.test.ts`
 */

import { getTableColumns, is, SQL, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { authorNotPendingDeletion } from '@/lib/account-deletion';
import { db } from '@/lib/db';

/** #208: the refusal text for `action` (e.g. "comment on recipes"). */
export function pendingDeletionError(action: string): string {
  return `Your account is scheduled for deletion, so you cannot ${action}. Cancel the deletion to ${action} again.`;
}

/**
 * #217: `errorCode` on a server action's pending-deletion refusal, so a v1
 * route that calls the action can answer 403 instead of 500.
 */
export const PENDING_DELETION_ERROR_CODE = 'ACCOUNT_PENDING_DELETION';

/** #217: the `{ success: false }` result a server action returns for a refused write. */
export function pendingDeletionRefusal(action: string) {
  return {
    success: false as const,
    error: pendingDeletionError(action),
    errorCode: PENDING_DELETION_ERROR_CODE,
  };
}

/** #217: true when a server action's result is a `pendingDeletionRefusal`. */
export function isPendingDeletionRefusal(result: object): boolean {
  return 'errorCode' in result && result.errorCode === PENDING_DELETION_ERROR_CODE;
}

/** #208: thrown by the service layer when the guard refuses a write. */
export class AccountPendingDeletionError extends Error {
  constructor(action: string) {
    super(pendingDeletionError(action));
    this.name = 'AccountPendingDeletionError';
  }
}

export interface GuardedInsertOptions {
  /** e.g. `ON CONFLICT … DO NOTHING`. A skipped row answers `allowed: true, row: null`. */
  onConflict?: SQL;
  /** A further data-modifying CTE body. It may read `inserted`, so it writes only with the row. */
  followedBy?: SQL;
}

export interface GuardedInsertResult<T> {
  /** False when the account has a pending deletion; nothing was written. */
  allowed: boolean;
  /** The inserted row; null when refused or skipped by `onConflict`. */
  row: T | null;
}

const ALLOWED = 'guard_allowed';
const ADDED = 'guard_added';

function columnsOf(table: PgTable): Array<[string, PgColumn]> {
  return Object.entries(getTableColumns(table) as Record<string, PgColumn>);
}

/** The statement `insertUnlessPendingDeletion` runs. */
export function insertUnlessPendingDeletionSql<TTable extends PgTable>(
  table: TTable,
  values: TTable['$inferInsert'],
  userId: string,
  options: GuardedInsertOptions = {}
): SQL {
  const names: SQL[] = [];
  const cells: SQL[] = [];
  for (const [key, column] of columnsOf(table)) {
    let value = (values as Record<string, unknown>)[key];
    // As `.values()` does: a JS default is computed here; a database default applies by omission.
    if (value === undefined && column.defaultFn) value = column.defaultFn();
    else if (value === undefined && column.default === undefined && column.onUpdateFn) {
      value = column.onUpdateFn();
    }
    if (value === undefined) continue;
    names.push(sql`${sql.identifier(column.name)}`);
    // A SELECT list gives a parameter no type, so each value is cast to its
    // column's type. The length is dropped: a cast to varchar(n) truncates.
    const type = sql.raw(column.getSQLType().replace(/\(\d+\)$/, ''));
    cells.push(
      is(value, SQL) ? sql`(${value})::${type}` : sql`${sql.param(value, column)}::${type}`
    );
  }
  const followedBy = options.followedBy ? sql`, followed AS (${options.followedBy})` : sql``;
  // The final LEFT JOIN always returns one row, so a refusal is told from a skipped row.
  return sql`
    WITH allowed AS (
      SELECT 1 AS ok WHERE ${authorNotPendingDeletion(userId)}
    ), inserted AS (
      INSERT INTO ${table} (${sql.join(names, sql`, `)})
      SELECT ${sql.join(cells, sql`, `)} FROM allowed
      ${options.onConflict ?? sql``}
      RETURNING *
    )${followedBy}
    SELECT EXISTS (SELECT 1 FROM allowed) AS ${sql.identifier(ALLOWED)},
      EXISTS (SELECT 1 FROM inserted) AS ${sql.identifier(ADDED)}, i.*
    FROM (SELECT 1) AS one LEFT JOIN inserted i ON true
  `;
}

/**
 * Why: see the file header.
 * What: inserts `values` into `table` unless `userId` has a pending deletion,
 * in one statement. Throws on any DB error (a unique violation stays 23505).
 * Test: `src/lib/__tests__/user-writes-pending-deletion.test.ts`
 */
export async function insertUnlessPendingDeletion<TTable extends PgTable>(
  table: TTable,
  values: TTable['$inferInsert'],
  userId: string,
  options: GuardedInsertOptions = {}
): Promise<GuardedInsertResult<TTable['$inferSelect']>> {
  const result = await db.execute(insertUnlessPendingDeletionSql(table, values, userId, options));
  const raw = (result.rows as Record<string, unknown>[])[0];
  if (!raw?.[ALLOWED]) return { allowed: false, row: null };
  if (!raw[ADDED]) return { allowed: true, row: null };
  // Raw rows carry database names and driver values; map them as `.returning()` does.
  const row: Record<string, unknown> = {};
  for (const [key, column] of columnsOf(table)) {
    const value = raw[column.name];
    row[key] = value === null || value === undefined ? null : column.mapFromDriverValue(value);
  }
  return { allowed: true, row: row as TTable['$inferSelect'] };
}
