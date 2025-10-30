# TheMealDB API Network Block Issue

## Problem Summary

The TheMealDB API (`www.themealdb.com`) is being blocked by **Eero Advanced Security** at the network level.

## Evidence

```bash
$ curl -v "http://www.themealdb.com/api/json/v1/1/categories.php"

< HTTP/1.1 303 See Other
< Location: https://blocked.eero.com?cat=advanced_security&reason=52&url=www.themealdb.com
```

**Block Details:**
- **Category**: Advanced Security
- **Reason Code**: 52
- **Blocked Domain**: www.themealdb.com

## Root Cause

Eero's Advanced Security feature is flagging and blocking access to www.themealdb.com, likely due to:
- Domain categorization (possibly flagged as content aggregation or scraping target)
- Security heuristics triggering on API endpoint patterns
- False positive in Eero's threat detection system

## Impact

- Cannot access TheMealDB API from this network
- Import scripts (`pnpm import:themealdb`) will fail with "fetch failed" errors
- DNS resolves to private IP `192.168.4.1` (Eero router) instead of actual server

## Solutions

### Option 1: Whitelist in Eero App (RECOMMENDED)

1. Open the Eero app on your phone
2. Go to **Settings** → **Advanced Security**
3. Scroll to **Blocked Sites** or **Activity**
4. Find `www.themealdb.com` in the blocked list
5. Tap the domain and select **Allow**
6. Wait 1-2 minutes for DNS cache to clear
7. Test: `curl "https://www.themealdb.com/api/json/v1/1/categories.php"`

### Option 2: Temporarily Disable Advanced Security

1. Open the Eero app
2. Go to **Settings** → **Advanced Security**
3. Toggle **Advanced Security** OFF
4. Run the import script
5. Re-enable Advanced Security when done

**Warning**: This disables network-wide security features temporarily.

### Option 3: Use VPN

1. Connect to a VPN service (e.g., Tailscale, WireGuard, commercial VPN)
2. This bypasses the Eero filtering
3. Run the import script while connected to VPN

### Option 4: Use Different Network

1. Connect to a different WiFi network or use mobile hotspot
2. Run the import script
3. Imported data will persist in the database

### Option 5: Use Proxy Service (FALLBACK)

If the domain cannot be unblocked, consider:
- Using a proxy service to fetch TheMealDB data
- Downloading recipes on a different network and importing locally
- Using cached/archived TheMealDB data

## Code Improvements Implemented

Even though this is a network issue, the code has been improved to handle similar failures better:

### 1. Request Timeout (30 seconds)
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000);
```

### 2. Retry Logic with Exponential Backoff
```typescript
// Retries: 3 attempts with 1s, 2s, 4s delays
for (let attempt = 1; attempt <= retries; attempt++) {
  // ... fetch logic ...
  const backoffMs = 1000 * Math.pow(2, attempt - 1);
  await this.delay(backoffMs);
}
```

### 3. Better Error Messages
```typescript
if (isNetworkError) {
  throw new Error(
    `TheMealDB API network error (${endpoint}): ${errorMessage}. Please check your internet connection.`
  );
}
```

### 4. User-Agent Header
```typescript
headers: {
  'User-Agent': 'recipe-manager/1.0',
  'Accept': 'application/json',
}
```

## Testing After Unblocking

Run the API test script:
```bash
pnpm import:themealdb:test
```

Expected output:
```
✅ All tests passed! TheMealDB API is accessible.
```

Then run pilot import:
```bash
pnpm import:themealdb:pilot
```

## Files Modified

1. `scripts/lib/themealdb-client.ts` - Added timeout, retry logic, better error handling
2. `scripts/test-themealdb-api.ts` - New test script to validate API connectivity
3. `package.json` - Added `import:themealdb:test` script

## Related Issues

- Import script fails with: "TheMealDB API request failed (categories.php): fetch failed"
- DNS resolves to `192.168.4.1` instead of actual IP
- Connection refused errors on port 443

## References

- **TheMealDB API Docs**: https://www.themealdb.com/api.php
- **Eero Advanced Security**: https://support.eero.com/hc/en-us/articles/360039837854-Advanced-Security
- **Eero Block Reason Codes**: Proprietary (reason=52 indicates advanced security block)

---

**Next Steps**: Whitelist www.themealdb.com in Eero app, then run `pnpm import:themealdb:test`
