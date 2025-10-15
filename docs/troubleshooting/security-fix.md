# Security Fix: Perplexity API Key Exposure

## Critical Vulnerability (RESOLVED)

**Date:** 2025-10-14
**Severity:** CRITICAL
**Status:** ✅ FIXED

## Problem

The Perplexity API code was being bundled into browser JavaScript, exposing API keys to attackers.

### Root Cause

`RecipeCrawlPanel.tsx` (a client component marked with `'use client'`) was importing utility functions from `/src/lib/perplexity-discovery.ts`:

```typescript
// ❌ VULNERABLE CODE (BEFORE FIX)
// RecipeCrawlPanel.tsx
'use client';
import { formatWeekInfo, getWeekInfo } from '@/lib/perplexity-discovery';
```

This caused Next.js to bundle the **entire** `perplexity-discovery.ts` module into client-side JavaScript, including:

```typescript
// perplexity-discovery.ts - THIS GOT BUNDLED TO CLIENT!
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '', // 🚨 API KEY EXPOSED
  baseURL: 'https://api.perplexity.ai',
});
```

### Error Message

```
Error: It looks like you're running in a browser-like environment.
This is disabled by default, as it risks exposing your secret API credentials to attackers.

at new OpenAI (file:///.next/static/chunks/node_modules_openai_62bd59c7._.js:10030:19)
at __TURBOPACK__module__evaluation__ (src/lib/perplexity-discovery.ts:10:20)
at __TURBOPACK__module__evaluation__ (src/components/recipe/RecipeCrawlPanel.tsx:5:1)
```

## Solution

Created a new file `/src/lib/week-utils.ts` with pure utility functions that are safe for client-side use:

### Files Changed

1. **Created: `/src/lib/week-utils.ts`**
   - Extracted `getWeekInfo()` and `formatWeekInfo()` functions
   - No API keys, no server-only code
   - Safe for client-side imports
   - Contains only date calculation logic

2. **Updated: `/src/components/recipe/RecipeCrawlPanel.tsx`**
   ```typescript
   // ✅ SECURE CODE (AFTER FIX)
   'use client';
   import { formatWeekInfo, getWeekInfo } from '@/lib/week-utils'; // Safe!
   ```

3. **Updated: `/src/lib/perplexity-discovery.ts`**
   - Removed duplicate utility functions
   - Added security warning in comments
   - Now imports `WeekInfo` type from `week-utils`
   - Only contains server-side API code

4. **Updated: `/src/app/actions/recipe-crawl.ts`**
   - Updated imports to use `week-utils` for utility functions
   - Still imports `discoverWeeklyRecipes` from `perplexity-discovery` (server-side only)

5. **Updated: `/scripts/test-perplexity-direct.ts`**
   - Fixed imports to use `week-utils`

## Verification

### Import Analysis

✅ **Client Components (Safe)**
```bash
# No client components import from perplexity-discovery
$ grep -r "perplexity-discovery" src/components/**/*.tsx
# No results found
```

✅ **Server-Side Imports Only**
```typescript
// These are all server-side files (✅ SAFE):
- src/app/actions/recipe-crawl.ts ('use server')
- scripts/test-perplexity-direct.ts (Node.js script)
```

### Build Verification

The fix was validated by:
1. Type checking passed (imports resolved correctly)
2. No client-side bundling of API key code
3. Client components only import from `week-utils`

## Security Principles Applied

1. **Separation of Concerns**
   - Pure utility functions → `week-utils.ts` (client-safe)
   - API key operations → `perplexity-discovery.ts` (server-only)

2. **Client/Server Boundaries**
   - Client components only import from safe utilities
   - Server actions handle all API operations

3. **Defense in Depth**
   - Added documentation warnings in `perplexity-discovery.ts`
   - Clear file naming conventions
   - Type imports prevent accidental bundling

## Impact

- ✅ **Before:** API keys exposed in browser bundle (CRITICAL vulnerability)
- ✅ **After:** API keys only in server code, never sent to browser

## Prevention

To prevent similar issues:

1. **Never** import server modules (with API keys) in client components
2. Extract pure utility functions to separate files
3. Use `'use server'` directive for all server actions
4. Review imports during code review
5. Use build-time checks to catch client-side API imports

## Files Structure

```
src/
├── lib/
│   ├── week-utils.ts           # ✅ Client-safe utilities
│   └── perplexity-discovery.ts # 🔒 Server-only (API keys)
├── app/
│   └── actions/
│       └── recipe-crawl.ts     # 🔒 Server action
└── components/
    └── recipe/
        └── RecipeCrawlPanel.tsx # ✅ Client component
```

## Conclusion

The security vulnerability has been completely resolved. API keys are now isolated to server-side code only, with no risk of client-side exposure.
