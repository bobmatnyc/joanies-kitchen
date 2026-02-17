# TheMealDB Import Scripts

Quick reference for TheMealDB recipe imports.

## Quick Start

```bash
# 1. Test API connectivity (ALWAYS RUN FIRST)
pnpm import:themealdb:test

# 2. Pilot import (10 recipes for validation)
pnpm import:themealdb:pilot

# 3. Full import (~280 recipes)
pnpm import:themealdb
```

## If Test Fails

**Common Error**: `fetch failed` or `Connection refused`

**Most Likely Cause**: Network blocking (Eero, Pi-hole, firewall)

**Quick Fix**:
1. Check if domain is blocked: `curl http://www.themealdb.com/api/json/v1/1/categories.php`
2. If blocked, whitelist in network settings (Eero app, Pi-hole admin, etc.)
3. Wait 1-2 minutes for DNS cache to clear
4. Re-run: `pnpm import:themealdb:test`

See `THEMEALDB_NETWORK_BLOCK.md` for detailed troubleshooting.

## Import Options

```bash
# Import specific category
tsx scripts/import-themealdb.ts --category=Chicken

# Limit number of recipes
tsx scripts/import-themealdb.ts --max=50

# Pilot mode (10 recipes)
tsx scripts/import-themealdb.ts --pilot
```

## Features

- ✅ 30-second request timeout
- ✅ 3 retry attempts with exponential backoff
- ✅ Progress tracking with resume capability
- ✅ Duplicate detection
- ✅ Rate limiting (1 second between requests)
- ✅ Comprehensive error messages

## API Details

- **Base URL**: https://www.themealdb.com/api/json/v1/1/
- **Free Tier**: 280+ recipes, no API key required
- **Rate Limit**: Self-imposed 1 second between requests
- **License**: EDUCATIONAL_USE (personal/non-commercial)

## Troubleshooting

| Error | Likely Cause | Solution |
|-------|--------------|----------|
| `fetch failed` | Network blocking | Whitelist domain in network settings |
| `timeout after 30s` | Slow connection | Check internet speed, try VPN |
| `HTTP 429` | Rate limiting | Wait and retry (auto-handled) |
| `Recipe already exists` | Duplicate | Normal - skipped automatically |
| `HTTP 404` | Recipe not found | Normal - some IDs may be invalid |

## Related Scripts

- `scripts/lib/themealdb-client.ts` - API client implementation
- `scripts/import-themealdb.ts` - Main import script
- `scripts/test-themealdb-api.ts` - Connectivity test script

## Documentation

- **Network Block Issue**: `THEMEALDB_NETWORK_BLOCK.md`
- **Fix Summary**: `THEMEALDB_FIX_SUMMARY.md`
- **API Docs**: https://www.themealdb.com/api.php
