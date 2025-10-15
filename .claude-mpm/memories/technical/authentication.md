# Recipe Manager - Authentication Technical Memory

## Clerk Dual-Environment Implementation

### Configuration Files
- `src/middleware.ts` - Dynamic Clerk middleware with environment detection
- `src/components/auth/AuthProvider.tsx` - Client-side environment switcher
- `src/lib/auth-config.ts` - Auth configuration logic
- `src/lib/clerk-proxy.ts` - Clerk API proxy utilities
- `src/app/api/clerk-config/route.ts` - Configuration endpoint
- `src/app/api/clerk-proxy/[...path]/route.ts` - API proxy for dual-env

### Environment Detection Logic
1. Check URL parameter: `?env=prod` or `?env=dev`
2. Check localStorage: `clerk_environment` key
3. Default to development environment

### Environment Variables Pattern
```env
# Development
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Production (on localhost)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD=pk_live_...
CLERK_SECRET_KEY_PROD=sk_live_...
```

### Middleware Implementation
- Reads environment from request (query param or cookie)
- Dynamically sets Clerk configuration
- Protects routes except: /sign-in, /sign-up, /api/clerk-*, /shared, /discover
- Validates userId on all protected routes

### Server Action Pattern
```typescript
import { auth } from '@clerk/nextjs/server';

export async function serverAction() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // All queries scoped to userId
  const data = await db.query.table.findMany({
    where: eq(table.userId, userId)
  });
}
```

### Validation Commands
- `pnpm auth:validate` - Validates Clerk configuration
- `node scripts/validate-auth.js` - Comprehensive auth testing
- `node scripts/test-production-keys.js` - Tests production keys on localhost

## Security Considerations
- API keys (CLERK_SECRET_KEY) never exposed to client
- All server actions validate userId before database operations
- Middleware ensures authentication on protected routes
- Environment switcher UI only visible in development mode
