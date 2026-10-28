# Authentication

Joanie's Kitchen signs users in with **Auth.js (NextAuth v5)** and **Google** only. Clerk was removed in #22.

## How it works

| Piece | File | Role |
|---|---|---|
| Edge config | `src/auth.config.ts` | Google provider, 7-day JWT sessions, maps the token to `session.user.{id,isAdmin}`. No database. Used by middleware. |
| Node config | `src/auth.ts` | Adds the Drizzle adapter (`users`, `accounts`) and the DB-backed `signIn` and `jwt` callbacks. |
| Callbacks | `src/lib/auth-callbacks.ts` | `authorizeSignIn` (closed registration) and `refreshAdminClaim` (admin flag in the JWT). |
| Route handler | `src/app/api/auth/[...nextauth]/route.ts` | `/api/auth/*` endpoints. |
| Middleware | `src/middleware.ts`, `src/lib/auth-routes.ts` | Redirects signed-out users away from protected and admin routes. |
| Server shim | `src/lib/auth.ts` | Clerk-shaped `auth()` → `{ userId, sessionClaims, user, … }`. |
| Client shim | `src/lib/auth-client.tsx` | Clerk-shaped `useAuth`, `useUser`, `SignInButton` over `useSession`. |
| Admin checks | `src/lib/admin.ts` | `checkAdminAccess`, `requireAdmin`, `authorizeAdminOrCronSecret`. |

The two shims let existing callers keep their call sites. A follow-up PR replaces them with direct Auth.js calls.

### Closed registration

Only an email that already has a row in `users` can sign in. The `signIn` callback denies when:

- the provider is not Google,
- Google has not verified the email,
- the email is missing or empty,
- no `users` row has that email, or
- the database lookup fails.

A denied login lands on `/sign-in?error=AccessDenied`. On the first allowed sign-in, Auth.js links the Google account to the seeded row by email and writes an `accounts` row.

### Admin

`users.is_admin` is the only source of admin rights.

- `checkAdminAccess()` and `requireAdmin()` re-read `users.is_admin` on every call. A revoked admin is refused at once. A database error denies.
- The JWT carries a copy (`session.user.isAdmin`), refreshed from the database at most every 5 minutes. Middleware and UI hints read this copy, so a revoked admin can still pass middleware for up to 5 minutes. The admin layout and every admin action then refuse them.
- A failed refresh clears the copy. A deleted `users` row ends the session.
- The `CRON_SECRET` bearer path in `authorizeAdminOrCronSecret` is unchanged.

## Setup

### 1. Google OAuth client

In Google Cloud Console → APIs & Services → Credentials, create an OAuth client ID of type **Web application**:

- Authorized JavaScript origins: `https://joanies.kitchen`, `http://localhost:3002`
- Authorized redirect URIs: `https://joanies.kitchen/api/auth/callback/google`, `http://localhost:3002/api/auth/callback/google`
- Set the OAuth consent screen publishing status to **In production**.

Google does not accept wildcard redirect URIs, so Vercel preview deployments cannot sign in. Test locally and in production.

### 2. Environment variables

| Variable | Where | Value |
|---|---|---|
| `AUTH_SECRET` | all | Random secret. `npx auth secret` or `openssl rand -base64 32`. Rotating it signs everyone out. |
| `AUTH_GOOGLE_ID` | all | Google client ID |
| `AUTH_GOOGLE_SECRET` | all | Google client secret |
| `AUTH_URL` | Vercel Production only | `https://joanies.kitchen` |

When any of the first three is missing, the app runs signed-out: `auth()` returns no user, and middleware sends protected routes to `/sign-in`.

The `CLERK_*`, `NEXT_PUBLIC_CLERK_*`, `ADMIN_USER_IDS` and `NEXT_PUBLIC_ADMIN_USER_IDS` variables are no longer read. Remove them from Vercel after the rollback window.

### 3. Apply migration 0023

`drizzle/0023_authjs_users.sql` creates `users`, `accounts` and `verification_tokens`. It changes no existing table. Production is managed by hand (see `drizzle/README.md`): do **not** run `drizzle-kit migrate` against it.

Dry-run first on a Neon branch, inside a transaction that is rolled back:

```bash
psql "$BRANCH_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -c 'BEGIN' -f drizzle/0023_authjs_users.sql -c '\dt users' -c 'ROLLBACK'
```

Apply to production, with the owner's confirmation:

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -1 -f drizzle/0023_authjs_users.sql
```

Rollback (drops only the three new tables; existing data is untouched):

```bash
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f drizzle/rollback/0023_authjs_users.down.sql
```

The new tables are inert if the deployment is rolled back, so the rollback SQL is only needed to abandon Auth.js entirely.

### 4. Seed sign-in users

```bash
pnpm auth:seed-user --id <users.id> --email <google-email> [--admin] [--dry-run]
# or: make auth-seed-user ID=<users.id> EMAIL=<google-email> ADMIN=1
```

- `--id` is the app user id. For a user who existed under Clerk, pass their old Clerk user id so their recipes, favorites and profile stay attached. New users can use any unique id.
- `--email` is the Google account email. It is stored lower-case.
- `--admin` sets `is_admin = true`. Re-running without `--admin` sets it back to `false`.
- `--dry-run` prints what would be written, with the email masked.

The script upserts by id. It fails if the email already belongs to a different id. It reads `DATABASE_URL` from `.env.local` or the environment. Never commit ids or emails used here.

## Local development

1. Put the three `AUTH_*` values in `.env.local`.
2. Apply migration 0023 to your development database and seed yourself.
3. `pnpm dev`, then open `http://localhost:3002/sign-in`.

## Tests

- `src/lib/__tests__/auth-callbacks.test.ts` — sign-in gate and JWT admin refresh.
- `src/lib/__tests__/admin-db-check.test.ts` — `requireAdmin` and `checkAdminAccess` read the database every call and deny on failure.
- `src/lib/__tests__/auth-shim.test.ts`, `auth-client.test.tsx`, `auth-config.test.ts`, `auth-routes.test.ts`, `auth-seed.test.ts`.
