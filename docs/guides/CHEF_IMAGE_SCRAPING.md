# Chef Image Scraping Guide

Automated professional chef image collection using SerpAPI Google Image Search.

## Overview

The chef image scraping script (`scripts/scrape-chef-images.ts`) uses SerpAPI to search for and download professional chef photographs. It implements intelligent search strategies, quality filtering, and safe defaults.

## Prerequisites

### 1. SerpAPI Account

1. Sign up at [serpapi.com](https://serpapi.com/)
2. Get your API key from the dashboard
3. Free tier includes 100 searches/month (sufficient for initial setup)

### 2. Environment Configuration

Add to your `.env.local`:

```bash
SERPAPI_API_KEY=your_serpapi_api_key_here
```

## Usage

### Dry Run (Preview Only)

See what images would be downloaded without actually downloading:

```bash
pnpm chef:images:scrape
# or
tsx scripts/scrape-chef-images.ts
```

### Apply Changes (Actually Download)

Download images and update database:

```bash
pnpm chef:images:scrape:apply
# or
APPLY_CHANGES=true tsx scripts/scrape-chef-images.ts
```

### Force Re-Download

Re-download images even if chefs already have profile images:

```bash
pnpm chef:images:scrape:force
# or
APPLY_CHANGES=true tsx scripts/scrape-chef-images.ts --force
```

## How It Works

### 1. Search Strategy

For each chef, the script tries multiple search queries in priority order:

1. `"{chef.display_name || chef.name} chef portrait"`
2. `"{chef.display_name || chef.name} chef professional photo"`
3. `"{chef.display_name || chef.name} chef headshot"`
4. `"{chef.display_name || chef.name} chef photograph"`
5. `{chef.display_name || chef.name} chef` (fallback)

Stops at first query returning quality results.

### 2. Image Quality Filtering

**Automatic Filtering:**
- ✅ Photo type only (no illustrations)
- ✅ Minimum 500px width
- ✅ Minimum 10KB file size
- ✅ Safe search enabled
- ❌ Filters out stock photo sites (Shutterstock, Getty, etc.)
- ❌ Filters out product images
- ❌ Filters out images with extreme aspect ratios

**Preferred Sources:**
- Chef's own website (from `chef.website` field)
- News outlets (NY Times, Guardian, Washington Post)
- Food media (Bon Appétit, Food & Wine, Serious Eats, Eater)

### 3. Image Scoring System

Each image is scored based on:

| Criteria | Points | Description |
|----------|--------|-------------|
| High resolution (1000px+) | +3 | Excellent quality |
| Good resolution (500px+) | +1 | Acceptable quality |
| Square aspect ratio (0.8-1.2) | +3 | Perfect for avatars |
| Portrait aspect ratio (0.6-0.9) | +2 | Good for profiles |
| Preferred/official source | +5 | Trustworthy source |
| Top search result | +2 | Likely most relevant |
| Top 3 result | +1 | Still relevant |
| Professional keywords | +1 | "portrait", "headshot", "chef" |

**Best image wins!**

### 4. Download & Storage

**File Storage:**
- Downloads to `/public/images/chefs/{chef-slug}.jpg`
- Publicly accessible at `/images/chefs/{chef-slug}.jpg`

**Database Update:**
- Updates `chefs.profile_image_url` field
- Only updates if download succeeds
- Skips chefs that already have images (unless `--force`)

### 5. Progress Tracking

**State File:** `tmp/chef-image-scraping-progress.json`

Tracks:
- Last processed chef
- Successfully processed chefs
- Failed chefs
- Skipped chefs
- Timestamp

**Resume Support:** Can resume if interrupted (checks processed slugs).

## Configuration

Edit `CONFIG` object in script:

```typescript
const CONFIG = {
  SERPAPI_API_KEY: process.env.SERPAPI_API_KEY,
  APPLY_CHANGES: process.env.APPLY_CHANGES === 'true',
  FORCE_REDOWNLOAD: process.argv.includes('--force'),
  API_RATE_LIMIT_MS: 1000, // 1 second between API calls
  MIN_IMAGE_WIDTH: 500, // Minimum width in pixels
  MIN_IMAGE_SIZE_BYTES: 10 * 1024, // 10KB minimum
  MAX_IMAGES_PER_QUERY: 10, // Results per search
  TIMEOUT_MS: 30000, // 30 seconds download timeout
};
```

## Output Example

```
🖼️  Chef Image Scraping Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chefs to Process: 20
Chefs with Existing Images: 8 (skipped)
Chefs Needing Images: 12

Search Results:
  ✅ Anne-Marie Bonneau: Found 10 images, selected #1
     URL: https://example.com/anne-marie-bonneau.jpg
     Size: 1200x1200px
  ✅ Vivian Li: Found 8 images, selected #2
     URL: https://example.com/vivian-li.jpg
     Size: 1000x1333px
  ❌ [Chef Name]: No suitable images found

Downloads:
  ✅ 10 images downloaded successfully
  ❌ 2 failed downloads

Database Updates:
  ✅ 10 chefs updated with image URLs

Summary:
  Success: 10/12 (83%)
  Failed: 2/12
  Images Found: 10/12
```

## Rate Limiting

**SerpAPI Limits:**
- Free tier: 100 searches/month
- Paid tier: Varies by plan
- Script automatically adds 1-second delay between requests

**Safety Features:**
- 1 second between API calls
- 1 second between processing chefs
- 30 second timeout per download
- Graceful error handling

## Error Handling

### Common Errors

**1. No API Key**
```
❌ SERPAPI_API_KEY environment variable is required
```
**Solution:** Add `SERPAPI_API_KEY` to `.env.local`

**2. API Rate Limit**
```
❌ SerpAPI request failed: 429 Too Many Requests
```
**Solution:** Wait for rate limit to reset (monthly for free tier)

**3. No Images Found**
```
❌ No suitable images found after trying all search queries
```
**Reasons:**
- All results from banned stock photo sites
- All results fail quality filters
- Chef name too generic/common

**Solution:** Manually add image via database or try different search terms

**4. Download Failed**
```
❌ Download timeout (30000ms)
```
**Solution:** Image server slow/unavailable, retry later

### Troubleshooting

**Check Progress:**
```bash
cat tmp/chef-image-scraping-progress.json
```

**Reset Progress:**
```bash
rm tmp/chef-image-scraping-progress.json
```

**Check Downloaded Images:**
```bash
ls -lh public/images/chefs/
```

**Verify Database Updates:**
```sql
SELECT slug, name, profile_image_url
FROM chefs
WHERE is_verified = true
ORDER BY name;
```

## Safety & Legal

### Image Rights

**The script prefers:**
1. Chef's official website images
2. News/editorial images (typically fair use for factual profiles)
3. Food media publications

**Avoiding:**
- Stock photo sites (paid/licensed)
- Social media thumbnails
- Images with watermarks/text overlays
- Product/book covers (unless no other options)

### Best Practices

1. **Attribution**: Consider adding image source attribution in database
2. **Review**: Manually review downloaded images before going live
3. **Compliance**: Ensure usage complies with fair use doctrine
4. **Backup**: Keep backups of downloaded images
5. **Documentation**: Document image sources for each chef

### Fair Use Considerations

Using chef images for factual profiles may qualify as fair use under:
- **Transformative use**: Creating chef directory/database
- **Educational purpose**: Teaching about sustainable cooking
- **Minimal use**: Single profile photo, not full galleries
- **No market harm**: Not replacing original image sources

**Disclaimer:** This is not legal advice. Consult with legal counsel if uncertain.

## Manual Fallback

If scraping fails or returns poor results:

### Option 1: Manual Upload

1. Find professional image manually
2. Save to `public/images/chefs/{chef-slug}.jpg`
3. Update database:

```sql
UPDATE chefs
SET profile_image_url = '/images/chefs/{chef-slug}.jpg'
WHERE slug = '{chef-slug}';
```

### Option 2: Direct URL

Use external URL (less reliable):

```sql
UPDATE chefs
SET profile_image_url = 'https://example.com/chef-image.jpg'
WHERE slug = '{chef-slug}';
```

## Performance

**Processing Time:**
- ~3 seconds per chef (1s API + 1s download + 1s rate limit)
- 20 chefs = ~60 seconds total
- Parallelization possible but risks rate limiting

**API Costs:**
- Free tier: 100 searches/month (enough for 20 chefs)
- Each chef uses 1-5 searches (avg 2)
- 20 chefs ≈ 40 searches

**Storage:**
- Average image: 100-500KB
- 20 chefs ≈ 5-10MB total

## Integration

### Next.js Image Component

Use with Next.js Image:

```tsx
import Image from 'next/image';

<Image
  src={chef.profile_image_url}
  alt={chef.name}
  width={200}
  height={200}
  className="rounded-full"
/>
```

### ChefAvatar Component

Already integrated:

```tsx
import { ChefAvatar } from '@/components/chef/ChefAvatar';

<ChefAvatar chef={chef} size="lg" />
```

## Monitoring

### Check Status

```bash
# View progress file
cat tmp/chef-image-scraping-progress.json

# Count downloaded images
ls -1 public/images/chefs/ | wc -l

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM chefs WHERE profile_image_url IS NOT NULL;"
```

### Success Metrics

- **Target:** 90%+ success rate (18/20 chefs)
- **Acceptable:** 80%+ success rate (16/20 chefs)
- **Needs manual intervention:** <80% (review search strategies)

## Future Improvements

- [ ] Add image attribution tracking
- [ ] Support custom search queries per chef
- [ ] Implement image format conversion (WebP)
- [ ] Add image optimization (compression, resizing)
- [ ] Parallel processing (with rate limit management)
- [ ] Add retry logic with exponential backoff
- [ ] Support multiple image sources per chef
- [ ] Add image validation (face detection, quality checks)
- [ ] Generate multiple sizes (thumbnail, medium, large)
- [ ] Add CDN upload support (Vercel Blob, Cloudinary, etc.)

## Related Documentation

- [SUSTAINABLE_CHEFS.md](/docs/roadmap/sustainable-chefs.md) - Chef selection criteria
- [CHEF_SCHEMA.md](/docs/reference/chef-schema.md) - Database schema
- [AUTHENTICATION_GUIDE.md](/docs/guides/AUTHENTICATION_GUIDE.md) - API keys setup

## Support

**Issues?** Create a GitHub issue or check:
- SerpAPI status: [https://serpapi.com/status](https://serpapi.com/status)
- API documentation: [https://serpapi.com/images-results](https://serpapi.com/images-results)
- Script logs: Check console output for detailed errors

---

**Last Updated:** 2025-10-22
**Version:** 1.0
**Maintainer:** Recipe Manager Team
