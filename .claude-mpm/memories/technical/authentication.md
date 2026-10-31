# Recipe Manager - Authentication Technical Memory

## Auth.js (NextAuth v5) Implementation

Google is the only provider. Sessions are JWTs. Registration is closed: only a
Google email that has a `users` row (or is listed in `AUTH_ADMIN_EMAILS`) can
sign in. Admin comes from `AUTH_ADMIN_EMAILS` plus `users.is_admin`.
Legacy `users.id` values are Clerk-era ids (#22). Full guide:
`docs/guides/authentication.md`.

### Configuration Files
- `src/auth.config.ts` - Edge-safe config (Google provider, 7-day JWT sessions)
- `src/auth.ts` - Node-side config (Drizzle adapter, DB-backed signIn/jwt callbacks)
- `src/middleware.ts` - Session middleware; route rules in `src/lib/auth-routes.ts`
- `src/lib/session-user.ts` - `getSessionUser()` / `getSessionUserId()` for server code
- `src/lib/use-session-user.ts` - `useSessionUser()` for client components
- `src/lib/admin.ts` - `checkAdminAccess`, `requireAdmin` (re-read `users.is_admin`)
- `src/components/auth/AuthProvider.tsx` - Client SessionProvider

### Environment Variables
`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` (production
only), `AUTH_ADMIN_EMAILS`. With any of the first three missing, the app runs
signed-out.

### Server Action Pattern
```typescript
import { getSessionUserId } from '@/lib/session-user';

export async function serverAction() {
  const userId = await getSessionUserId();
  if (!userId) throw new Error('Unauthorized');

  // All queries scoped to userId
  const data = await db.query.table.findMany({
    where: eq(table.userId, userId)
  });
}
```

### Seeding Users
- `pnpm auth:seed-user --id <users.id> [--email <google-email>] [--admin]`

## Security Considerations
- Secrets (`AUTH_SECRET`, `AUTH_GOOGLE_SECRET`) never exposed to client
- All server actions validate userId before database operations
- Middleware ensures authentication on protected routes; admin checks re-read the database
