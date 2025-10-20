# Tasty API - Quick Reference Card

**One-page cheat sheet for Tasty recipe import**

---

## Setup (One-Time)

### 1. Get API Key
Visit: https://rapidapi.com/apidojo/api/tasty

### 2. Add to .env.local
```env
RAPIDAPI_KEY=your_key_here
RAPIDAPI_HOST=tasty.p.rapidapi.com
```

---

## Commands

### Test API Connection
```bash
pnpm import:tasty:test
```

### Pilot Import (10 recipes)
```bash
pnpm import:tasty:pilot
```

### Full Import (500 recipes)
```bash
pnpm import:tasty
```

### Custom Limits
```bash
pnpm import:tasty -- --max=50
```

### Filter by Tag
```bash
pnpm import:tasty -- --tag=under_30_minutes
```

---

## API Pricing

| Tier | Cost | Requests/Month | Recipes |
|------|------|----------------|---------|
| Free | $0 | 500 | ~500 |
| Pro | $9.99 | 10,000 | ~10,000 |

---

## Expected Results

### Pilot Import (10 recipes)
- Time: ~1-2 minutes
- Video URLs: 8-9 recipes (80-90%)
- Success rate: 100%

### Full Import (500 recipes)
- Time: ~10-15 minutes
- Video URLs: 380-440 recipes (80-90%)
- Success rate: ~96-98%

---

## Progress File

Location: `tmp/import-progress-tasty.json`

To reset and start fresh:
```bash
rm tmp/import-progress-tasty.json
```

---

## Data Quality

Each recipe includes:
- ✅ Name, description
- ✅ Ingredients with measurements
- ✅ Step-by-step instructions
- ✅ Prep/cook time, servings
- ✅ Image URL
- ✅ Video URL (80-90% of recipes)
- ✅ Tags (dietary, meal type, cuisine)
- ✅ Nutrition info

---

## Troubleshooting

### API Key Error
```bash
# Check if API key is set
echo $RAPIDAPI_KEY
```

### Rate Limited
Wait 60 seconds (automatic retry)

### Connection Failed
- Verify API key at RapidAPI dashboard
- Check internet connection
- Verify subscription is active

---

## Monitor API Usage

Dashboard: https://rapidapi.com/developer/dashboard

---

## Video URLs

All imported Tasty recipes include `video_url` field:
```typescript
recipe.video_url // e.g., "https://video.tasty.co/..."
```

---

## Next Steps After Import

1. Check imported recipes:
```sql
SELECT name, video_url FROM recipes WHERE source LIKE 'Tasty%' LIMIT 10;
```

2. Generate embeddings:
```bash
pnpm embeddings:generate
```

3. Test on frontend at `/discover`

---

## Documentation

Full guide: `scripts/README-TASTY.md`
Implementation: `TASTY_IMPLEMENTATION_SUMMARY.md`

---

**Quick Help**: `pnpm import:tasty:test` for validation
