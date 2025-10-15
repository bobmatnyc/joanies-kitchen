# Using Production Clerk Keys on Localhost

## Overview

This guide explains how the Recipe Manager application is configured to use production Clerk keys (domain-restricted to `recipes.help`) on localhost for development purposes.

## Configuration Summary

The application uses a **satellite mode** configuration that allows production keys to work on localhost by:

1. **Satellite Mode**: Configuring Clerk to run in satellite mode where localhost acts as a satellite application to the primary `recipes.help` domain
2. **Domain Override**: Overriding domain validation checks in development
3. **Proxy Configuration**: Setting up API proxies to handle cross-domain requests
4. **Environment Variables**: Using specific flags to enable production keys in development

## Key Components

### 1. Environment Variables (.env.local)

```env
# Main Clerk Keys (Production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA
CLERK_SECRET_KEY=sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg

# Enable Authentication
ENABLE_DEV_AUTH=true

# Production Keys Configuration
ALLOW_PRODUCTION_KEYS_IN_DEV=true
FORCE_PRODUCTION_KEYS=true
USE_PRODUCTION_CLERK=true

# Satellite Configuration
CLERK_DOMAIN=recipes.help
CLERK_IS_SATELLITE=true
CLERK_PRIMARY_URL=https://recipes.help
SKIP_CLERK_DOMAIN_VALIDATION=true
ALLOW_LIVE_KEYS_IN_DEV=true
```

### 2. Configuration Files

- **`/src/config/clerk-dev.ts`**: Development configuration for using production keys
- **`/src/lib/auth-config.ts`**: Enhanced auth configuration with production key support
- **`/src/lib/clerk-proxy.ts`**: Proxy configuration for domain bypass
- **`/src/components/auth/AuthProvider.tsx`**: Modified to handle satellite mode

### 3. API Routes

- **`/api/clerk-proxy/[...path]`**: Proxies Clerk API requests with domain override
- **`/api/clerk-config`**: Provides configuration for production keys on localhost

## How It Works

### Satellite Mode

When the application detects:
1. Production keys (`pk_live_*` and `sk_live_*`)
2. Development environment
3. Configuration flags enabled

It automatically:
1. Configures Clerk in satellite mode
2. Sets the primary domain as `recipes.help`
3. Allows authentication to work on `localhost:3004`

### Request Flow

1. **Client Side**:
   - Clerk SDK is initialized with production keys
   - Satellite mode is enabled
   - Requests are made to localhost

2. **Proxy Layer**:
   - Intercepts Clerk API requests
   - Modifies headers to appear as from `recipes.help`
   - Forwards to Clerk API

3. **Response**:
   - Clerk API validates the production keys
   - Returns authentication data
   - Proxy adjusts response for localhost

## Testing the Configuration

Run the test script to verify everything is working:

```bash
node scripts/test-production-keys.js
```

This will check:
- Server availability
- Clerk configuration
- Environment variables
- Sign-in page accessibility
- Proxy endpoint functionality

## Accessing the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Access the application at:
   ```
   http://localhost:3004
   ```

3. Authentication pages:
   - Sign In: `http://localhost:3004/sign-in`
   - Sign Up: `http://localhost:3004/sign-up`

## Troubleshooting

### "Production Keys are only allowed for domain recipes.help" Error

If you see this error:

1. **Verify Environment Variables**: Ensure all production key flags are set in `.env.local`
2. **Restart Server**: Stop and restart the development server
3. **Clear Cache**: Clear browser cache and cookies for localhost
4. **Check Console**: Look for `[AuthProvider] Configuration` logs in browser console

### Authentication Not Working

1. **Check Keys**: Verify the production keys are correctly set
2. **Enable Dev Auth**: Ensure `ENABLE_DEV_AUTH=true`
3. **Satellite Mode**: Verify satellite configuration is active
4. **Network Tab**: Check browser network tab for failed Clerk API calls

### Build Errors

The TypeScript configuration uses `any` type for Clerk options to allow flexible satellite configuration. This is intentional for development flexibility.

## Security Considerations

⚠️ **Important**: This configuration is for **development only**. In production:

1. Use proper domain-matched keys
2. Disable proxy endpoints
3. Remove development overrides
4. Use secure HTTPS connections

## Benefits

This setup allows:
- ✅ Testing production authentication flow locally
- ✅ Debugging production-specific issues
- ✅ Consistent auth behavior across environments
- ✅ No need for separate test Clerk instance

## Limitations

- 🔸 Some Clerk features may not work perfectly in satellite mode
- 🔸 OAuth providers need additional configuration
- 🔸 Webhooks will still go to production domain
- 🔸 Session management may have minor differences

## Summary

The application is now configured to use production Clerk keys on localhost through a combination of:
- Satellite mode configuration
- Domain override settings
- Proxy endpoints for API requests
- Environment variable flags

This allows full authentication functionality with production keys during local development.