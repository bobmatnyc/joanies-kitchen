import { boolean, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Auth.js (NextAuth v5) tables — #22.
 *
 * Why: auth runs on Auth.js with JWT sessions; the Drizzle adapter
 * needs `users` and `accounts` to link a Google login to an app user id.
 * What: `users.id` is text so the one real pre-existing Clerk id keeps every
 * row that references it attached; new rows get a UUID. `is_admin` is the
 * single source of truth for admin access. There is no `sessions` table —
 * sessions are JWTs. Created by migration 0023 (additive only).
 */

// #22: id is text, not uuid — seeded rows reuse their old Clerk user id.
export const users = pgTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  // #22: replaces Clerk sessionClaims.metadata.isAdmin.
  is_admin: boolean('is_admin').default(false).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  // #103: set when the user requests account deletion; null = active. The
  // 30-day grace period and the purge (S5) run from this timestamp.
  deletion_requested_at: timestamp('deletion_requested_at'),
  // #103: the user's choice at request time — true keeps public recipes as
  // "deleted user" at purge; false/null deletes them.
  deletion_keep_recipes: boolean('deletion_keep_recipes'),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]
);

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

export type AuthUser = typeof users.$inferSelect;
