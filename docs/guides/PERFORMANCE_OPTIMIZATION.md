# Performance Optimization Guide - Joanie's Kitchen

**Next.js 15.5.3 | App Router | React 19 | Tailwind CSS v4**

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Wins](#quick-wins)
3. [Image Optimization](#image-optimization)
4. [Bundle Size Optimization](#bundle-size-optimization)
5. [Font Optimization](#font-optimization)
6. [Server vs Client Components](#server-vs-client-components)
7. [Monitoring Performance](#monitoring-performance)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide provides comprehensive performance optimization strategies for Joanie's Kitchen, targeting:

- **FCP (First Contentful Paint)**: < 1.0s
- **LCP (Largest Contentful Paint)**: < 2.0s
- **TBT (Total Blocking Time)**: < 200ms
- **CLS (Cumulative Layout Shift)**: < 0.1

### Performance Metrics Explained

| Metric | Description | Good Score | Impact |
|--------|-------------|------------|--------|
| **FCP** | Time until first content renders | < 1.8s | User sees content |
| **LCP** | Time until largest content renders | < 2.5s | Page feels loaded |
| **TBT** | Time main thread is blocked | < 200ms | Page feels responsive |
| **CLS** | Visual stability during load | < 0.1 | No layout jumps |

---

## Quick Wins

### 1. Re-Enable Image Optimization ✅

**Status**: FIXED in latest commit

**Before** (`next.config.ts`):
```typescript
images: {
  unoptimized: true, // ❌ BAD
}
```

**After**:
```typescript
images: {
  formats: ['image/webp', 'image/avif'],
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
  imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  minimumCacheTTL: 60,
}
```

**Impact**: 70-80% reduction in image sizes

### 2. Optimize Hero Image ✅

**Status**: FIXED in latest commit

**Before** (`src/app/page.tsx`):
```tsx
<img
  src="/joanie-portrait.png"
  alt="Joanie cooking"
  className="w-full h-auto"
/>
```

**After**:
```tsx
<Image
  src="/joanie-portrait.png"
  alt="Joanie cooking"
  width={600}
  height={800}
  priority  // Critical for LCP
  quality={85}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
  placeholder="blur"
  blurDataURL="..."
/>
```

**Impact**: 3.5MB → ~200-300KB (95% reduction)

### 3. Update RecipeCard Images ✅

**Status**: FIXED in latest commit

**Before**:
```tsx
<img
  src={displayImage}
  alt={recipe.name}
  loading="lazy"
  className="object-cover w-full h-full"
/>
```

**After**:
```tsx
<Image
  src={displayImage}
  alt={recipe.name}
  fill
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  loading="lazy"
  quality={75}
/>
```

**Impact**: Automatic WebP conversion, responsive images

---

## Image Optimization

### Best Practices

#### 1. Always Use Next.js Image Component

**Why**: Automatic optimization, WebP conversion, responsive images, lazy loading

```tsx
import Image from 'next/image';

// ✅ GOOD - Optimized
<Image
  src="/image.png"
  alt="Description"
  width={600}
  height={400}
  priority={isAboveFold}
  quality={75}  // 75-85 is optimal
  sizes="(max-width: 768px) 100vw, 600px"
/>

// ❌ BAD - Unoptimized
<img src="/image.png" alt="Description" />
```

#### 2. Priority Hints for Above-the-Fold Images

**Critical**: Add `priority` prop to LCP images

```tsx
// Hero image (above fold)
<Image
  src="/hero.png"
  priority  // ✅ Preload this image
  width={1200}
  height={800}
/>

// Below fold images
<Image
  src="/recipe.png"
  loading="lazy"  // ✅ Lazy load below fold
  width={400}
  height={300}
/>
```

#### 3. Responsive Images with `sizes` Prop

**Purpose**: Serve appropriately sized images for different screen sizes

```tsx
<Image
  src="/image.png"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  // Mobile: full width
  // Tablet: 50% width
  // Desktop: 33% width
/>
```

#### 4. Image Dimensions to Prevent Layout Shift

**Always** provide explicit dimensions:

```tsx
// ✅ GOOD - Explicit dimensions
<Image
  src="/image.png"
  width={600}
  height={400}
/>

// ✅ GOOD - Fill with aspect ratio container
<div className="aspect-video relative">
  <Image src="/image.png" fill />
</div>

// ❌ BAD - No dimensions (causes CLS)
<Image src="/image.png" />
```

#### 5. Blur Placeholders for Better UX

Generate blur placeholders:

```bash
# Using sharp to generate blur data URL
pnpm add -D sharp
```

```typescript
import sharp from 'sharp';

async function getBlurDataURL(imagePath: string) {
  const buffer = await sharp(imagePath)
    .resize(10)
    .blur()
    .toBuffer();

  return `data:image/png;base64,${buffer.toString('base64')}`;
}
```

Use in component:
```tsx
<Image
  src="/image.png"
  placeholder="blur"
  blurDataURL="data:image/png;base64,..."
/>
```

### Image Optimization Checklist

- [ ] All images use Next.js `<Image>` component
- [ ] Above-the-fold images have `priority` prop
- [ ] Below-the-fold images have `loading="lazy"`
- [ ] All images have explicit `width` and `height` OR use `fill`
- [ ] Responsive images use `sizes` prop
- [ ] Large images (<1MB) converted to WebP
- [ ] Blur placeholders implemented for key images
- [ ] Image quality set to 75-85 (not 100)

### Converting Images to WebP

```bash
# Using sharp CLI
pnpm add -D sharp-cli

# Convert single image
npx sharp -i joanie-portrait.png -o joanie-portrait.webp --format webp --quality 85

# Bulk convert
find public -name "*.png" -exec npx sharp -i {} -o {}.webp --format webp --quality 85 \;
```

---

## Bundle Size Optimization

### 1. Server Components First

**Default**: Use Server Components unless interactivity is needed

```tsx
// ✅ GOOD - Server Component (no 'use client')
export default async function RecipePage({ params }) {
  const recipe = await getRecipe(params.id);
  return <RecipeDisplay recipe={recipe} />;
}

// ❌ BAD - Unnecessary Client Component
'use client';
export default function RecipeCard({ recipe }) {
  return <div>{recipe.name}</div>;  // No interactivity!
}
```

### 2. Client Components Only When Needed

**When to use `'use client'`**:
- Event handlers (onClick, onChange, etc.)
- React hooks (useState, useEffect, etc.)
- Browser APIs (localStorage, window, etc.)
- Third-party libraries that require client-side

```tsx
// ✅ GOOD - Client component only for interactive part
'use client';
import { useState } from 'react';

export function FavoriteButton({ recipeId }) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <button onClick={() => setIsFavorite(!isFavorite)}>
      {isFavorite ? '❤️' : '🤍'}
    </button>
  );
}

// Server component can use it
export default async function RecipePage() {
  return (
    <div>
      <RecipeDetails />
      <FavoriteButton recipeId={id} />  {/* Only this is client */}
    </div>
  );
}
```

### 3. Dynamic Imports for Heavy Components

```tsx
import dynamic from 'next/dynamic';

// ✅ GOOD - Lazy load heavy component
const RecipeEditor = dynamic(() => import('@/components/recipe/RecipeEditor'), {
  loading: () => <p>Loading editor...</p>,
  ssr: false,  // If component requires browser APIs
});
```

### 4. Optimize Package Imports

**Already configured** in `next.config.ts`:

```typescript
experimental: {
  optimizePackageImports: ['lucide-react', 'react-icons', '@radix-ui/react-icons'],
}
```

**Tree-shaking**: Import only what you need

```tsx
// ✅ GOOD - Named imports
import { ChefHat, Clock } from 'lucide-react';

// ❌ BAD - Imports entire library
import * as Icons from 'lucide-react';
```

### Bundle Analysis

```bash
# Install analyzer
pnpm add -D @next/bundle-analyzer

# Update next.config.ts
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

module.exports = withBundleAnalyzer(nextConfig);

# Run analysis
ANALYZE=true pnpm build
```

---

## Font Optimization

### Current Setup (Already Optimized) ✅

`src/app/layout.tsx`:

```tsx
import { Playfair_Display, Lora, Inter } from "next/font/google";

const playfair = Playfair_Display({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",  // ✅ Prevents FOIT (Flash of Invisible Text)
});

const lora = Lora({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-ui",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
```

### Font Best Practices

1. **Use `next/font`** ✅ - Already implemented
2. **Set `display: "swap"`** ✅ - Prevents invisible text
3. **Preconnect to font sources** ✅ - Added in layout
4. **Load only needed weights** - Consider reducing if not all weights are used

### Font Loading Optimization

```tsx
// In layout.tsx <head>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="dns-prefetch" href="https://fonts.googleapis.com" />
```

---

## Server vs Client Components

### Decision Tree

```
Need interactivity? (onClick, useState, etc.)
  ├─ YES → Client Component ('use client')
  └─ NO → Server Component (default)
      ├─ Fetches data? → Use async Server Component
      ├─ Static content? → Server Component
      └─ Contains Client Component? → Server Component wrapper
```

### Examples

#### Server Component (Recommended)
```tsx
// No 'use client' directive
export default async function RecipeList() {
  const recipes = await fetchRecipes();  // Server-side data fetch

  return (
    <div>
      {recipes.map(recipe => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}
```

#### Client Component (When Necessary)
```tsx
'use client';  // Required for interactivity

import { useState } from 'react';

export function RecipeFilters() {
  const [cuisine, setCuisine] = useState('all');

  return (
    <select onChange={(e) => setCuisine(e.target.value)}>
      <option value="all">All Cuisines</option>
      <option value="italian">Italian</option>
    </select>
  );
}
```

#### Hybrid Approach (Best)
```tsx
// Server Component (wrapper)
export default async function RecipePage() {
  const recipe = await fetchRecipe();

  return (
    <div>
      <RecipeDetails recipe={recipe} />  {/* Server Component */}
      <RecipeActions recipeId={recipe.id} />  {/* Client Component */}
    </div>
  );
}

// Client Component (only interactive part)
'use client';
export function RecipeActions({ recipeId }) {
  return (
    <button onClick={() => favoriteRecipe(recipeId)}>
      Favorite
    </button>
  );
}
```

---

## Monitoring Performance

### 1. Use Performance Analysis Script

```bash
# Run performance analysis
tsx scripts/analyze-performance.ts

# Full analysis with details
tsx scripts/analyze-performance.ts --full
```

Output:
```
🔍 Performance Analysis for Joanie's Kitchen

📸 Analyzing Images...
Found 150 images
Total size: 12.5 MB

🔴 Large Images (>500KB):
  public/joanie-portrait.png: 3.5 MB
    - Large file size (3.5 MB)
    - Consider converting to WebP

💡 Recommendations:
  🔴 CRITICAL: 1 large images found (>500KB)
  🟡 HIGH: 5 PNG images could be converted to WebP
```

### 2. Lighthouse CI

```bash
# Install Lighthouse CI
pnpm add -D @lhci/cli

# Run Lighthouse
npx lhci autorun --collect.url=http://localhost:3002
```

### 3. Vercel Speed Insights ✅

Already integrated:

```tsx
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />  {/* ✅ Already tracking */}
      </body>
    </html>
  );
}
```

### 4. Next.js Build Analysis

```bash
# Build and see bundle sizes
pnpm build

# Output shows:
# Route (pages)                Size     First Load JS
# ○ /                          5.2 kB        180 kB
# ○ /recipes                   8.1 kB        183 kB
```

Look for:
- ⚠️ Routes > 200 KB First Load JS
- ⚠️ Shared chunks > 100 KB

---

## Best Practices

### Performance Checklist

#### Images
- [ ] All images use `<Image>` component
- [ ] Above-fold images have `priority` prop
- [ ] Images have explicit dimensions
- [ ] Large images converted to WebP
- [ ] Responsive images use `sizes` prop
- [ ] Lazy loading for below-fold images

#### JavaScript
- [ ] Use Server Components by default
- [ ] Client Components only for interactivity
- [ ] Dynamic imports for heavy components
- [ ] Tree-shaking for icon libraries
- [ ] Bundle size < 200 KB per page

#### Fonts
- [ ] Use `next/font` for Google Fonts
- [ ] Set `display: "swap"` to prevent FOIT
- [ ] Preconnect to font sources
- [ ] Load only necessary font weights

#### CSS
- [ ] Tailwind CSS purged unused classes
- [ ] CSS modules for component-specific styles
- [ ] No render-blocking CSS
- [ ] Critical CSS inlined

#### Monitoring
- [ ] Performance script runs on CI
- [ ] Lighthouse CI integrated
- [ ] Vercel Speed Insights enabled
- [ ] Bundle size tracked

---

## Troubleshooting

### Issue: Images Not Optimizing

**Symptoms**: Images still large, no WebP conversion

**Solution**:
1. Ensure `unoptimized: false` in `next.config.ts`
2. Verify using `<Image>` component, not `<img>`
3. Check image source is accessible
4. Clear `.next` cache: `rm -rf .next`

### Issue: Layout Shift (CLS)

**Symptoms**: Content jumps during load

**Solution**:
1. Add explicit dimensions to images
2. Use aspect ratio containers
3. Reserve space for dynamic content
4. Avoid inserting content above existing content

```tsx
// ✅ GOOD - No layout shift
<div className="aspect-video relative">
  <Image src="/image.png" fill />
</div>

// ❌ BAD - Causes layout shift
<Image src="/image.png" />  {/* No dimensions */}
```

### Issue: Slow First Load

**Symptoms**: FCP/LCP > 3 seconds

**Solution**:
1. Optimize hero image (biggest culprit)
2. Add `priority` to LCP image
3. Reduce bundle size
4. Enable Server Components
5. Preconnect to external domains

### Issue: Large Bundle Size

**Symptoms**: First Load JS > 200 KB

**Solution**:
1. Convert to Server Components
2. Dynamic import heavy components
3. Use `optimizePackageImports` in config
4. Tree-shake libraries (named imports)
5. Remove unused dependencies

### Issue: Fonts Loading Slowly

**Symptoms**: FOIT (Flash of Invisible Text)

**Solution**:
1. Use `next/font` (not external CSS)
2. Set `display: "swap"`
3. Preconnect to Google Fonts
4. Subset fonts (latin only)
5. Limit font weights

---

## Performance Targets

### Mobile (4G)
- FCP: < 1.5s
- LCP: < 2.5s
- TBT: < 300ms
- CLS: < 0.1

### Desktop (Fiber)
- FCP: < 0.8s
- LCP: < 1.5s
- TBT: < 150ms
- CLS: < 0.05

### Lighthouse Score
- Performance: > 85
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 95

---

## Resources

### Next.js Documentation
- [Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts)
- [Bundle Analysis](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)

### Tools
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

### Web Vitals
- [Core Web Vitals](https://web.dev/vitals/)
- [FCP](https://web.dev/fcp/)
- [LCP](https://web.dev/lcp/)
- [CLS](https://web.dev/cls/)

---

**Last Updated**: 2025-10-16
**Version**: 1.0.0
**Next Review**: After implementing optimizations
