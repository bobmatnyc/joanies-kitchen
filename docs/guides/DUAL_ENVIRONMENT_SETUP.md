# Dual Environment Clerk Authentication Setup

This document describes the complete dual-environment configuration that allows the Recipe Manager application to work seamlessly in both development (localhost) and production (recipes.help) environments.

## Overview

The application now supports:
- **Development Environment**: localhost:3004/3005 using Clerk test keys
- **Production Environment**: recipes.help using Clerk live keys
- **Automatic Environment Detection**: Keys are selected based on the current environment
- **Secure Key Management**: Environment-specific variables prevent accidental key misuse

## Problem Solved

Previously, the application was getting the error:
```
Production Keys are only allowed for domain recipes.help
```

This happened because:
1. Production keys (pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA) are restricted to the recipes.help domain
2. Development was trying to use production keys on localhost
3. No environment-specific key selection was in place

## Solution Architecture

### 1. Environment-Specific Key Selection

The system automatically selects the correct keys based on the environment:

```typescript
// Development Environment
if (isDevelopment()) {
  // Uses test keys for localhost
  publishableKey: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV ||
                 (starts with pk_test_ ? NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY : undefined)
}

// Production Environment
if (isProduction()) {
  // Uses live keys for recipes.help
  publishableKey: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD ||
                 (starts with pk_live_ ? NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY : undefined)
}
```

### 2. Environment Detection Logic

```typescript
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' ||
         process.env.VERCEL_ENV === 'production' ||
         process.env.NEXT_PUBLIC_APP_URL?.includes('recipes.help') ||
         (typeof window !== 'undefined' && window.location.hostname === 'recipes.help');
}
```

### 3. Configuration Validation

The system validates:
- Key format (pk_test_/pk_live_ prefixes)
- Environment mismatch detection
- Domain restrictions
- Missing key scenarios

## Environment Configuration

### Development (.env.local)

```bash
# Option 1: Environment-specific keys (Recommended)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV=pk_test_cG93ZXJmdWwtc2FsbW9uLTk5LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY_DEV=sk_test_nFAuhX4acFXAEtPkuWlvHJH9qUMKYtlVyd3qqgoPcp

# Option 2: Auto-selection (fallback)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cG93ZXJmdWwtc2FsbW9uLTk5LmNsZXJrLmFjY291bnRzLmRldiQ
CLERK_SECRET_KEY=sk_test_nFAuhX4acFXAEtPkuWlvHJH9qUMKYtlVyd3qqgoPcp

# Enable dev authentication
ENABLE_DEV_AUTH=true
NEXT_PUBLIC_APP_URL=http://localhost:3004
```

### Production (Vercel/Environment Variables)

```bash
# Production keys for recipes.help
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD=pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA
CLERK_SECRET_KEY_PROD=sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg

# Or use auto-selection
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA
CLERK_SECRET_KEY=sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg

# Production settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://recipes.help
```

## Key Files Modified

### 1. `/src/lib/auth-config.ts`

Enhanced with:
- Environment detection functions
- Environment-specific key selection
- Comprehensive validation
- Detailed logging for development

### 2. `/src/middleware.ts`

Updated with:
- Environment-aware configuration loading
- Better error handling for missing keys
- Detailed logging for debugging

### 3. Environment Files

- `.env.example`: Updated with dual-environment examples
- `.env.local.example`: Development-focused configuration
- `.env.production.example`: Production deployment guide

## Verification Steps

### Development Environment

1. **Start Development Server**:
   ```bash
   npm run dev
   ```

2. **Check Console Logs**:
   ```
   [Auth Config] {
     isConfigured: true,
     isEnabled: true,
     environment: 'development',
     keyType: 'test',
     domainCheck: false
   }
   ```

3. **Test Public Routes**: `http://localhost:3004/` should load
4. **Test Protected Routes**: `http://localhost:3004/recipes/new` should redirect to sign-in

### Production Environment

1. **Deploy to Production**: Push to your production environment
2. **Verify Domain**: Ensure the app runs on `recipes.help`
3. **Check Key Selection**: Production logs should show `keyType: 'live'`
4. **Test Authentication**: Sign-up/sign-in should work on production domain

## Security Features

### 1. Domain Restrictions
- Production keys only work on `recipes.help`
- Development keys work on localhost
- Cross-environment usage is blocked

### 2. Key Validation
- Format validation (pk_/sk_ prefixes)
- Environment mismatch detection
- Placeholder key detection

### 3. Error Handling
- Graceful fallback when keys are missing
- Clear error messages for configuration issues
- Service unavailable response in production when keys are missing

## Troubleshooting

### Common Issues

1. **"Production Keys are only allowed for domain recipes.help"**
   - Solution: Verify you're using test keys in development
   - Check: `ENABLE_DEV_AUTH=true` is set

2. **Authentication not working in development**
   - Solution: Set `ENABLE_DEV_AUTH=true` in `.env.local`
   - Check: Clerk keys are properly configured

3. **Environment mismatch warnings**
   - Solution: Use environment-specific key variables
   - Check: Key prefixes match environment (test/live)

### Debug Commands

```bash
# Check current environment variables
env | grep CLERK

# Check application logs
npm run dev  # Look for [Auth Config] logs

# Test route protection
curl -I http://localhost:3004/recipes/new
```

## Deployment Checklist

### Development Setup
- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Set test Clerk keys
- [ ] Set `ENABLE_DEV_AUTH=true`
- [ ] Verify localhost works

### Production Deployment
- [ ] Set production environment variables in deployment platform
- [ ] Use live Clerk keys for recipes.help
- [ ] Set `NODE_ENV=production`
- [ ] Set `NEXT_PUBLIC_APP_URL=https://recipes.help`
- [ ] Test authentication on production domain

## Next Steps

### Clerk Dashboard Configuration

1. **Development Instance**:
   - Configure localhost URLs in authorized domains
   - Set up OAuth providers for development testing
   - Configure webhook endpoints for localhost

2. **Production Instance**:
   - Configure recipes.help domain
   - Set up production OAuth providers
   - Configure production webhook endpoints

### Monitoring and Alerts

1. **Authentication Monitoring**:
   - Set up alerts for authentication failures
   - Monitor key usage and rotation
   - Track environment configuration issues

2. **Security Monitoring**:
   - Monitor for cross-environment key usage attempts
   - Alert on configuration validation failures
   - Track unauthorized access attempts

## Summary

The dual-environment setup provides:

✅ **Seamless Development**: localhost works with test keys
✅ **Secure Production**: recipes.help works with live keys
✅ **Automatic Selection**: No manual key switching needed
✅ **Error Prevention**: Validation prevents key misuse
✅ **Easy Deployment**: Environment-aware configuration
✅ **Clear Debugging**: Comprehensive logging and validation

The application now supports development on localhost:3004 and production on recipes.help with proper domain restrictions and automatic key selection.