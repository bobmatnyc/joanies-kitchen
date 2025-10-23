# Chef Image Scraping - Usage Example

Step-by-step walkthrough of scraping chef images.

## Setup

### 1. Install Dependencies

Already included in the project - no additional packages needed!

### 2. Get SerpAPI Key

1. Visit [serpapi.com](https://serpapi.com/)
2. Sign up for free account (100 searches/month)
3. Copy your API key from dashboard

### 3. Configure Environment

Add to `.env.local`:

```bash
SERPAPI_API_KEY=sk_your_actual_api_key_here
```

## Basic Usage

### Preview Mode (Dry Run)

First, run in dry-run mode to see what images would be downloaded:

```bash
pnpm chef:images:scrape
```

**Example Output:**

```
🖼️  Chef Image Scraping with SerpAPI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ℹ️  Running in DRY RUN mode (preview only)
   Set APPLY_CHANGES=true to actually download images

📋 Found 20 verified chefs

🔍 Processing: Anne-Marie Bonneau (anne-marie-bonneau)
   🔎 Searching: "Anne-Marie Bonneau (Zero-Waste Chef)" chef portrait
   📷 Found 10 images
   📊 Top 3 images by score:
      1. Score: 14 (high resolution (1000px+), square aspect ratio, from preferred source, top search result, professional keywords)
      2. Score: 11 (good resolution (500px+), square aspect ratio, from preferred source, top 3 result, professional keywords)
      3. Score: 8 (good resolution (500px+), portrait aspect ratio, top 3 result, professional keywords)
   ✅ Selected image #1 from nytimes.com
   ℹ️  DRY RUN: Would download from https://nytimes.com/chef-portrait.jpg
   ℹ️  DRY RUN: Would save to /images/chefs/anne-marie-bonneau.jpg

🔍 Processing: Vivian Li (vivian-li)
   🔎 Searching: "Vivian Li (Omnivore's Cookbook)" chef portrait
   📷 Found 8 images
   📊 Top 3 images by score:
      1. Score: 12 (high resolution (1000px+), portrait aspect ratio, from preferred source, top search result, professional keywords)
      2. Score: 9 (good resolution (500px+), square aspect ratio, top 3 result, professional keywords)
      3. Score: 7 (good resolution (500px+), top 3 result)
   ✅ Selected image #1 from omnivorescookbook.com
   ℹ️  DRY RUN: Would download from https://omnivorescookbook.com/vivian-li-portrait.jpg
   ℹ️  DRY RUN: Would save to /images/chefs/vivian-li.jpg

...

🖼️  Chef Image Scraping Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chefs to Process: 20
Chefs with Existing Images: 0 (none)
Chefs Needing Images: 20

Search Results:
  ✅ Anne-Marie Bonneau: Found 10 images, selected #1
     URL: https://nytimes.com/chef-portrait.jpg
     Size: 1200x1200px
  ✅ Vivian Li: Found 8 images, selected #1
     URL: https://omnivorescookbook.com/vivian-li-portrait.jpg
     Size: 1000x1333px
  ...

⚠️  DRY RUN MODE - No images downloaded or database updated
   Set APPLY_CHANGES=true to actually download images

Summary:
  Images Found: 18/20
  Expected Success: ~18/20 (90%)

✅ Chef image scraping complete!
```

### Apply Changes (Actually Download)

If the preview looks good, run with `APPLY_CHANGES=true`:

```bash
pnpm chef:images:scrape:apply
```

**Example Output:**

```
🖼️  Chef Image Scraping with SerpAPI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Found 20 verified chefs

🔍 Processing: Anne-Marie Bonneau (anne-marie-bonneau)
   🔎 Searching: "Anne-Marie Bonneau (Zero-Waste Chef)" chef portrait
   📷 Found 10 images
   📊 Top 3 images by score:
      1. Score: 14 (high resolution (1000px+), square aspect ratio, from preferred source, top search result, professional keywords)
   ✅ Selected image #1 from nytimes.com
   ⬇️  Downloading image...
   ✅ Downloaded: 523847 bytes → /Users/masa/Projects/recipe-manager/public/images/chefs/anne-marie-bonneau.jpg
   ✅ Database updated: profile_image_url = "/images/chefs/anne-marie-bonneau.jpg"

🔍 Processing: Vivian Li (vivian-li)
   🔎 Searching: "Vivian Li (Omnivore's Cookbook)" chef portrait
   📷 Found 8 images
   📊 Top 3 images by score:
      1. Score: 12 (high resolution (1000px+), portrait aspect ratio, from preferred source, top search result, professional keywords)
   ✅ Selected image #1 from omnivorescookbook.com
   ⬇️  Downloading image...
   ✅ Downloaded: 412931 bytes → /Users/masa/Projects/recipe-manager/public/images/chefs/vivian-li.jpg
   ✅ Database updated: profile_image_url = "/images/chefs/vivian-li.jpg"

...

🖼️  Chef Image Scraping Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Chefs to Process: 20
Chefs with Existing Images: 0 (none)
Chefs Needing Images: 20

Downloads:
  ✅ 18 images downloaded successfully
  ❌ 2 failed downloads

Database Updates:
  ✅ 18 chefs updated with image URLs

Summary:
  Success: 18/20 (90%)
  Failed: 2/20
  Images Found: 18/20

✅ Chef image scraping complete!
```

## Verify Results

### Check Downloaded Images

```bash
ls -lh public/images/chefs/
```

**Example Output:**

```
total 9.8M
-rw-r--r-- 1 user user 523K Oct 22 23:45 anne-marie-bonneau.jpg
-rw-r--r-- 1 user user 412K Oct 22 23:46 vivian-li.jpg
-rw-r--r-- 1 user user 678K Oct 22 23:47 lidia-bastianich.jpg
-rw-r--r-- 1 user user 401K Oct 22 23:48 tamar-adler.jpg
...
```

### Check Database

```sql
SELECT
  slug,
  name,
  profile_image_url
FROM chefs
WHERE is_verified = true
ORDER BY name;
```

**Example Result:**

```
           slug           |         name          |       profile_image_url
--------------------------+-----------------------+--------------------------------
 alice-waters             | Alice Waters          | /images/chefs/alice-waters.jpg
 anne-marie-bonneau       | Anne-Marie Bonneau    | /images/chefs/anne-marie-bonneau.jpg
 bren-smith               | Bren Smith            | /images/chefs/bren-smith.jpg
 bryant-terry             | Bryant Terry          | /images/chefs/bryant-terry.jpg
 ...
```

### Test in Application

Visit chef profile pages:

```
http://localhost:3002/chef/anne-marie-bonneau
http://localhost:3002/chef/vivian-li
http://localhost:3002/chef/lidia-bastianich
```

Images should now display!

## Advanced Usage

### Force Re-Download

Re-download images even if they already exist:

```bash
pnpm chef:images:scrape:force
```

**Use Cases:**
- Updating outdated images
- Replacing low-quality images
- Refreshing after chef rebranding

### Resume Interrupted Session

If the script is interrupted, it will automatically resume:

```bash
# First run (interrupted after 10 chefs)
pnpm chef:images:scrape:apply
^C  # Ctrl+C to interrupt

# Resume (skips first 10 chefs)
pnpm chef:images:scrape:apply
```

**Progress File:**
```bash
cat tmp/chef-image-scraping-progress.json
```

```json
{
  "lastProcessedSlug": "joshua-mcfadden",
  "processedSlugs": [
    "anne-marie-bonneau",
    "vivian-li",
    "lidia-bastianich",
    "tamar-adler",
    "joshua-mcfadden"
  ],
  "failedSlugs": [],
  "skippedSlugs": [
    "jacques-pepin",
    "alice-waters"
  ],
  "timestamp": "2025-10-22T23:45:00.000Z"
}
```

### Reset Progress

To start fresh:

```bash
rm tmp/chef-image-scraping-progress.json
pnpm chef:images:scrape:apply
```

## Troubleshooting

### Missing Images

If some chefs have no images found:

**Check why:**

```bash
# Run dry-run mode and look for errors
pnpm chef:images:scrape 2>&1 | grep "❌"
```

**Common reasons:**
1. All results from stock photo sites (filtered out)
2. Generic name (too many unrelated results)
3. Low-quality results (all filtered)

**Solution:**
Manually add image:

```bash
# Download image manually
curl -o public/images/chefs/chef-slug.jpg "https://example.com/chef-image.jpg"

# Update database
psql $DATABASE_URL -c "
  UPDATE chefs
  SET profile_image_url = '/images/chefs/chef-slug.jpg'
  WHERE slug = 'chef-slug'
"
```

### API Rate Limit

If you hit the rate limit:

```
❌ SerpAPI request failed: 429 Too Many Requests
```

**Solutions:**
1. Wait for monthly reset (free tier)
2. Upgrade to paid tier ($50/month)
3. Process in batches (modify script)

### Download Failures

If downloads fail:

```
❌ Download timeout (30000ms)
```

**Solutions:**
1. Retry the scraper (failed downloads will retry)
2. Increase timeout (edit `CONFIG.TIMEOUT_MS` in script)
3. Check internet connection

## Integration Example

### React Component

```tsx
import Image from 'next/image';

interface ChefProfileProps {
  chef: {
    slug: string;
    name: string;
    profile_image_url?: string | null;
  };
}

export function ChefProfile({ chef }: ChefProfileProps) {
  return (
    <div className="flex items-center gap-4">
      <Image
        src={chef.profile_image_url || '/default-chef-avatar.jpg'}
        alt={`${chef.name} portrait`}
        width={200}
        height={200}
        className="rounded-full object-cover"
      />
      <div>
        <h1 className="text-2xl font-bold">{chef.name}</h1>
        <p className="text-gray-600">Professional Chef</p>
      </div>
    </div>
  );
}
```

### Chef Directory Page

```tsx
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq } from 'drizzle-orm';
import { ChefCard } from '@/components/chef/ChefCard';

export default async function ChefsPage() {
  const allChefs = await db
    .select()
    .from(chefs)
    .where(eq(chefs.is_verified, true))
    .orderBy(chefs.name);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-4xl font-bold mb-8">Sustainable Chefs</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {allChefs.map((chef) => (
          <ChefCard key={chef.id} chef={chef} />
        ))}
      </div>
    </div>
  );
}
```

### ChefCard Component

```tsx
import Image from 'next/image';
import Link from 'next/link';

export function ChefCard({ chef }) {
  return (
    <Link href={`/chef/${chef.slug}`}>
      <div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
        <div className="flex flex-col items-center gap-4">
          <Image
            src={chef.profile_image_url || '/default-chef-avatar.jpg'}
            alt={chef.name}
            width={150}
            height={150}
            className="rounded-full object-cover"
          />
          <div className="text-center">
            <h3 className="text-xl font-semibold">{chef.display_name || chef.name}</h3>
            {chef.specialties && (
              <div className="flex flex-wrap gap-2 mt-2">
                {chef.specialties.slice(0, 3).map((specialty) => (
                  <span
                    key={specialty}
                    className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
```

## Performance Tips

### Optimize Images

After downloading, optimize for web:

```bash
# Install sharp (if not already)
pnpm add sharp

# Optimize images (create separate script)
pnpm exec tsx scripts/optimize-chef-images.ts
```

### Generate Multiple Sizes

Create thumbnails, medium, and large versions:

```bash
# Example optimization script
import sharp from 'sharp';

const sizes = {
  thumbnail: 150,
  medium: 400,
  large: 800,
};

for (const [size, width] of Object.entries(sizes)) {
  await sharp(`public/images/chefs/${slug}.jpg`)
    .resize(width, width, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toFile(`public/images/chefs/${slug}-${size}.jpg`);
}
```

### Use CDN

Upload to Vercel Blob or Cloudinary:

```bash
# Example upload to Vercel Blob
import { put } from '@vercel/blob';

const blob = await put(
  `chefs/${chef.slug}.jpg`,
  file,
  { access: 'public' }
);

// Update database with blob.url
```

## Next Steps

1. **Review Downloaded Images:**
   - Check quality
   - Verify correct chefs
   - Look for licensing issues

2. **Manual Overrides:**
   - Replace any poor-quality images
   - Add missing images manually

3. **Test Integration:**
   - Verify images display correctly
   - Test responsive layouts
   - Check performance

4. **Schedule Updates:**
   - Set up monthly refresh
   - Update as chefs change photos
   - Add new chefs periodically

---

**Questions?** Check the [full guide](/docs/guides/CHEF_IMAGE_SCRAPING.md) or [quick reference](/scripts/README-CHEF-IMAGE-SCRAPING.md).
