# Image Storage Architecture

**Last Updated**: October 26, 2025
**Status**: ✅ Migrated to Vercel Blob Storage

---

## Overview

Joanie's Kitchen uses **Vercel Blob Storage** for all image assets. As of October 2025, all 3,185+ images (~3.5GB) have been migrated from git-tracked files to CDN-backed Blob storage.

---

## Storage Configuration

### Vercel Blob Store
- **Store ID**: `store_LjqhvY0FRzhUIgV1`
- **Dashboard**: https://vercel.com/1-m/joanies-kitchen/stores/blob/store_LjqhvY0FRzhUIgV1
- **Package**: `@vercel/blob` v2.0.0
- **Access**: Public (CDN-backed)

### Environment Variables
```env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

---

## Image Categories

| Category | Count | Size | Base URL Pattern |
|----------|-------|------|------------------|
| **Ingredients** | 3,037 | ~3.2GB | `{base}/ingredients/{name}.png` |
| **Recipes** | 101 | 184MB | `{base}/recipes/{name}.png` |
| **Tools** | 23 | 25MB | `{base}/tools/{name}.png` |
| **Chefs** | 19 | 12MB | `{base}/chefs/{name}.jpg` |
| **Backgrounds** | 5 | 15MB | `{base}/backgrounds/{name}.JPG` |
| **TOTAL** | **3,185** | **~3.5GB** | |

**Base URL**: `https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com`

---

## URL Structure

### Pattern
```
https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/{category}/{filename}
```

### Examples

**Ingredient Image**:
```
https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/ingredients/tomato.png
```

**Recipe Image**:
```
https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/recipes/joanie-crab-salad.jpg
```

**Chef Avatar**:
```
https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/chefs/rene-redzepi.jpg
```

**Tool Image**:
```
https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/tools/wooden_spoon.png
```

**Background**:
```
https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/backgrounds/IMG_3040.JPG
```

---

## Next.js Configuration

### Image Remote Patterns

```typescript
// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ljqhvy0frzhuigv1.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
      // Wildcard for all Vercel Blob domains
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};
```

### Usage in Components

```tsx
import Image from 'next/image';

// Direct Blob URL
<Image
  src="https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/ingredients/tomato.png"
  alt="Tomato"
  width={200}
  height={200}
/>

// From database
<Image
  src={ingredient.image_blob_url}
  alt={ingredient.name}
  width={200}
  height={200}
/>
```

---

## Database Schema

### Image URL Fields

Images are stored as Blob URLs in the database:

**Ingredients**:
```typescript
ingredients.image_url: string // Blob URL
```

**Recipes**:
```typescript
recipes.images: string // JSON array of Blob URLs
```

**Chefs**:
```typescript
chefs.avatar_url: string // Blob URL
```

**Tools**:
```typescript
tools.image_url: string // Blob URL
```

**Hero Backgrounds**:
```typescript
heroBackgrounds.image_url: string // Blob URL
```

---

## Upload API

### Server-Side Upload

```typescript
import { put } from '@vercel/blob';

// Upload an image
const blob = await put('ingredients/new-ingredient.png', imageBuffer, {
  access: 'public',
  addRandomSuffix: false, // Keep original filename
});

console.log(blob.url);
// https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/ingredients/new-ingredient.png
```

### Client-Side Upload

```typescript
import { upload } from '@vercel/blob/client';

// From admin interface
const blob = await upload(file.name, file, {
  access: 'public',
  handleUploadUrl: '/api/upload', // Your API route
});
```

---

## Migration History

### October 26, 2025 - Full Migration to Vercel Blob

**Migrated**: 3,185 images (3.5GB)
**Source**: `public/images/` (git-tracked)
**Destination**: Vercel Blob Storage (CDN-backed)
**Result**: 95% repository size reduction (7.5GB → 500MB)

**Migration Script**: `scripts/migrate-local-images-to-blob.ts`

**Results**:
- ✅ 100% success rate (3,185/3,185)
- ✅ All images accessible via CDN
- ✅ No downtime during migration
- ✅ Local files retained for safety period

**Documentation**:
- Migration Plan: `tmp/VERCEL-BLOB-MIGRATION-PLAN.md`
- Status Report: `tmp/MIGRATION-STATUS-REPORT.md`
- Results: `tmp/migration-results-{category}-*.json`

---

## Cost Analysis

### Vercel Blob Pricing (as of 2025)

**Storage**: $0.15/GB/month
- 3.5GB × $0.15 = **$0.53/month**

**Bandwidth**: $0.15/GB (varies by traffic)
- Estimated: $0.50-4/month

**Total Estimated Cost**: **$1-5/month**

### Benefits
- ✅ CDN-backed delivery (fast global access)
- ✅ No git bloat (95% repo size reduction)
- ✅ Professional asset management
- ✅ Automatic optimization
- ✅ High availability (99.9% SLA)

---

## Best Practices

### 1. Always Use Next.js Image Component

```tsx
// ✅ GOOD - Optimized, cached, responsive
<Image src={blobUrl} alt="..." width={200} height={200} />

// ❌ BAD - No optimization
<img src={blobUrl} alt="..." />
```

### 2. Store URLs in Database

Don't generate URLs dynamically. Always store the full Blob URL:

```typescript
// ✅ GOOD
const ingredient = {
  name: 'Tomato',
  image_url: 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/ingredients/tomato.png'
};

// ❌ BAD - Don't construct URLs
const ingredient = {
  name: 'Tomato',
  image_filename: 'tomato.png' // Would need to construct URL
};
```

### 3. Handle Missing Images

```tsx
<Image
  src={ingredient.image_url || '/images/placeholder.png'}
  alt={ingredient.name}
  onError={(e) => {
    e.currentTarget.src = '/images/placeholder.png';
  }}
/>
```

### 4. Use Descriptive Filenames

```
✅ GOOD: tomato.png, joanie-crab-salad.jpg, rene-redzepi.jpg
❌ BAD: img1.png, photo.jpg, 12345.png
```

---

## Upload Workflow

### For New Images

1. **Upload to Blob**:
   ```typescript
   const blob = await put(`ingredients/${name}.png`, buffer, {
     access: 'public',
     addRandomSuffix: false,
   });
   ```

2. **Save URL to Database**:
   ```typescript
   await db.insert(ingredients).values({
     name: 'New Ingredient',
     image_url: blob.url,
   });
   ```

3. **Use in Components**:
   ```tsx
   <Image src={ingredient.image_url} alt={ingredient.name} />
   ```

---

## Troubleshooting

### Image Not Loading

**Check**:
1. URL is correct and accessible: `curl -I {blob-url}`
2. Next.js remotePatterns includes Blob domain
3. Image exists in Vercel Blob dashboard
4. BLOB_READ_WRITE_TOKEN is set in environment

### Upload Fails

**Common Issues**:
1. Missing or invalid `BLOB_READ_WRITE_TOKEN`
2. File too large (max 4.5MB per file)
3. Invalid filename characters
4. Network timeout (retry with exponential backoff)

### Performance Issues

**Solutions**:
1. Use Next.js Image component (automatic optimization)
2. Specify width/height to prevent layout shift
3. Use `priority` prop for above-the-fold images
4. Consider lazy loading for below-the-fold images

---

## Monitoring

### Vercel Blob Dashboard

Monitor usage at: https://vercel.com/dashboard/stores

**Metrics Available**:
- Storage used (GB)
- Bandwidth used (GB)
- Request count
- Cost estimation

### Alerts

Set up alerts for:
- Storage usage >90% of quota
- Unexpected bandwidth spikes
- Upload failures

---

## Migration Scripts

### Migrate Local Images

```bash
# Single category
pnpm tsx scripts/migrate-local-images-to-blob.ts --category=ingredients

# All categories
pnpm tsx scripts/migrate-local-images-to-blob.ts --category=all

# Dry run (test without uploading)
pnpm tsx scripts/migrate-local-images-to-blob.ts --category=backgrounds --dry-run
```

### Migration Results

Results saved to: `tmp/migration-results-{category}-{timestamp}.json`

Each result includes:
- Original file path
- Blob URL
- File size
- Success/failure status
- Error message (if failed)

---

## Security

### Access Control

- **Public Access**: All images are publicly accessible (required for CDN)
- **Write Access**: Restricted to server-side code with `BLOB_READ_WRITE_TOKEN`
- **No Listing**: Directory listing is disabled

### Best Practices

1. **Never expose token client-side**:
   ```typescript
   // ❌ BAD - Client-side
   import { put } from '@vercel/blob';

   // ✅ GOOD - Server action
   'use server';
   import { put } from '@vercel/blob';
   ```

2. **Validate uploads**:
   - Check file type (images only)
   - Validate file size (<4.5MB)
   - Sanitize filenames

3. **Rate limiting**:
   - Implement upload rate limits
   - Use exponential backoff for retries

---

## Future Considerations

### Potential Enhancements

1. **Image Processing**: Add server-side image optimization before upload
2. **Multiple Sizes**: Generate and store multiple resolutions
3. **Metadata**: Store image dimensions, alt text in database
4. **Lazy Loading**: Implement progressive image loading
5. **Webp Conversion**: Auto-convert to WebP for better compression

### Scaling

Current setup supports:
- ✅ Thousands of images
- ✅ Global CDN delivery
- ✅ Automatic caching
- ✅ High availability

For larger scale (millions of images), consider:
- Dedicated image CDN (e.g., Cloudinary, Imgix)
- Image processing pipeline
- Multi-region storage

---

## References

- **Vercel Blob Docs**: https://vercel.com/docs/storage/vercel-blob
- **Next.js Image**: https://nextjs.org/docs/app/api-reference/components/image
- **Migration Plan**: `tmp/VERCEL-BLOB-MIGRATION-PLAN.md`
- **Store Dashboard**: https://vercel.com/1-m/joanies-kitchen/stores/blob/store_LjqhvY0FRzhUIgV1

---

## Quick Reference

```typescript
// Upload image
import { put } from '@vercel/blob';
const blob = await put('category/name.png', buffer, { access: 'public' });

// Use in component
import Image from 'next/image';
<Image src={blobUrl} alt="..." width={200} height={200} />

// Check if Blob URL
const isBlobUrl = url.includes('blob.vercel-storage.com');

// Base URL
const BASE_URL = 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com';
```

---

**Status**: ✅ Production-ready
**Migration Date**: October 26, 2025
**Total Images**: 3,185 images (3.5GB)
**Success Rate**: 100%
