# Chef Image Scraping - Quick Reference

## Quick Start

### 1. Setup SerpAPI Key

Get your free API key from [serpapi.com](https://serpapi.com/) (100 free searches/month).

Add to `.env.local`:
```bash
SERPAPI_API_KEY=your_api_key_here
```

### 2. Preview (Dry Run)

See what images would be downloaded:
```bash
pnpm chef:images:scrape
```

### 3. Download Images

Actually download and update database:
```bash
pnpm chef:images:scrape:apply
```

### 4. Force Re-Download

Re-download existing images:
```bash
pnpm chef:images:scrape:force
```

## Commands Reference

| Command | Description | API Calls | Database Updates |
|---------|-------------|-----------|------------------|
| `pnpm chef:images:scrape` | Dry run preview | ✅ Yes | ❌ No |
| `pnpm chef:images:scrape:apply` | Download images | ✅ Yes | ✅ Yes |
| `pnpm chef:images:scrape:force` | Force re-download | ✅ Yes | ✅ Yes |
| `pnpm chef:images:scrape:test` | Run unit tests | ❌ No | ❌ No |

## What It Does

1. **Searches** for professional chef images using Google Image Search
2. **Filters** out stock photos, low quality, and inappropriate images
3. **Scores** images based on quality, source, and relevance
4. **Downloads** the best image for each chef
5. **Updates** database with image URLs
6. **Tracks** progress (can resume if interrupted)

## Image Quality Criteria

✅ **Preferred:**
- High resolution (1000px+)
- Square or portrait aspect ratio
- From official/news sources (NY Times, Food & Wine, chef's website)
- Professional photography

❌ **Filtered Out:**
- Stock photo sites (Shutterstock, Getty Images, etc.)
- Product images
- Low resolution (<500px)
- Small file size (<10KB)
- Extreme aspect ratios (too wide or tall)

## Output Example

```
🖼️  Chef Image Scraping Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chefs to Process: 20
Chefs with Existing Images: 8 (skipped)
Chefs Needing Images: 12

Summary:
  Success: 10/12 (83%)
  Failed: 2/12
  Images Found: 10/12
```

## Files Created

- **Images:** `/public/images/chefs/{chef-slug}.jpg`
- **Progress:** `/tmp/chef-image-scraping-progress.json`
- **Database:** Updates `chefs.profile_image_url`

## Cost Estimate

**Free Tier (100 searches/month):**
- 20 chefs × 2 avg searches = 40 searches
- **Cost:** Free
- **Time:** ~60 seconds total

**Paid Tier ($50/month = 5,000 searches):**
- Unlimited for this use case
- **Cost:** ~$0.40 for 20 chefs
- **Time:** Same (~60 seconds)

## Troubleshooting

### No API Key Error
```
❌ SERPAPI_API_KEY environment variable is required
```
**Fix:** Add `SERPAPI_API_KEY` to `.env.local`

### Rate Limit Hit
```
❌ SerpAPI request failed: 429 Too Many Requests
```
**Fix:** Wait for monthly reset or upgrade to paid tier

### No Images Found
```
❌ No suitable images found after trying all search queries
```
**Fix:** Manually add image or adjust search terms

### Download Failed
```
❌ Download timeout (30000ms)
```
**Fix:** Retry later (slow image server)

## Progress Tracking

**View progress:**
```bash
cat tmp/chef-image-scraping-progress.json
```

**Reset progress:**
```bash
rm tmp/chef-image-scraping-progress.json
```

**Check downloaded images:**
```bash
ls -lh public/images/chefs/
```

## Manual Override

If scraping fails, manually add image:

1. Save image to `public/images/chefs/{chef-slug}.jpg`
2. Update database:
```sql
UPDATE chefs
SET profile_image_url = '/images/chefs/{chef-slug}.jpg'
WHERE slug = '{chef-slug}';
```

## Full Documentation

See [CHEF_IMAGE_SCRAPING.md](/docs/guides/CHEF_IMAGE_SCRAPING.md) for:
- Detailed configuration options
- Image scoring algorithm
- Search strategy details
- Legal/fair use considerations
- Integration examples
- Advanced troubleshooting

## Related Scripts

- `seed-sustainable-chefs.ts` - Seeds 20 sustainable chefs
- `add-chef-images.ts` - Manual image addition
- `generate-lidia-images.ts` - DALL-E image generation
- `verify-chef-system.ts` - Verify chef data integrity

---

**Quick Help:**
- GitHub Issues: [Create Issue](https://github.com/yourusername/recipe-manager/issues)
- SerpAPI Docs: [https://serpapi.com/images-results](https://serpapi.com/images-results)
- SerpAPI Support: [https://serpapi.com/contact](https://serpapi.com/contact)
