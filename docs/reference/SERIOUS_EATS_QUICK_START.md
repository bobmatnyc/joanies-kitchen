# Serious Eats Scraper - Quick Start

**One-page reference for scraping and importing Serious Eats recipes**

## 🚀 Quick Commands

```bash
# 1. Test (3 recipes, ~15 seconds)
source venv/bin/activate
python scripts/test-serious-eats-scraper.py

# 2. Scrape (50 recipes, ~5 minutes)
python scripts/ingest-serious-eats-top50.py

# 3. Import (50 recipes, ~20 seconds)
npx tsx scripts/import-serious-eats-recipes.ts

# 4. Verify
pnpm db:studio
```

## 📁 Files

| File | Purpose |
|------|---------|
| `scripts/serious-eats-top50-urls.json` | 50 curated URLs |
| `scripts/ingest-serious-eats-top50.py` | Production scraper |
| `scripts/test-serious-eats-scraper.py` | Quick test (3 recipes) |
| `scripts/import-serious-eats-recipes.ts` | Database import |
| `data/recipes/incoming/serious-eats/top50-transformed.json` | Output |

## ✅ Success Criteria

- ✅ Test: 3/3 recipes scraped
- ✅ Production: ≥ 45/50 recipes (90%)
- ✅ All recipes have: name, ingredients, instructions, image

## 🔧 Troubleshooting

| Issue | Fix |
|-------|-----|
| `ModuleNotFoundError` | `source venv/bin/activate` |
| 404 errors | Update URLs in `serious-eats-top50-urls.json` |
| Rate limiting | Increase `RATE_LIMIT_SECONDS` in script |
| Import fails | Check database connection: `pnpm db:studio` |

## 📊 Expected Output

```
✅ Successful: 48/50 (96.0%)
📊 With images: 48/48
📊 With prep time: 45/48
📊 With cook time: 46/48
🎉 SUCCESS! Ready for database import
```

## 📚 Detailed Docs

- **Full Guide**: `docs/guides/SERIOUS_EATS_SCRAPING_GUIDE.md`
- **Script README**: `scripts/README_SERIOUS_EATS_SCRAPER.md`
- **Implementation Summary**: `SERIOUS_EATS_IMPLEMENTATION_COMPLETE.md`

## 💰 Cost

**$0** (uses recipe-scrapers library, no LLM parsing)

---

**Last Updated**: 2025-10-16
