# Performance Optimization - Quick Reference

**One-page reference for performance best practices**

---

## Commands

```bash
# Performance Analysis
pnpm perf:analyze              # Quick analysis
pnpm perf:analyze:full          # Full analysis with details

# Development
pnpm dev                        # Start dev server (port 3002)
pnpm build                      # Build and check bundle size

# Lighthouse Testing
npx lighthouse http://localhost:3002 --view
```

---

## Image Optimization Checklist

### ✅ Always Use Next.js Image
```tsx
import Image from 'next/image';

// ✅ GOOD
<Image src="/image.png" width={600} height={400} alt="..." />

// ❌ BAD
<img src="/image.png" alt="..." />
```

### ✅ Priority for Above-the-Fold
```tsx
// Hero/LCP image
<Image src="/hero.png" priority width={1200} height={800} />

// Below fold
<Image src="/recipe.png" loading="lazy" width={400} height={300} />
```

### ✅ Responsive Images
```tsx
<Image
  src="/image.png"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  fill
/>
```

### ✅ Explicit Dimensions
```tsx
// Fixed dimensions
<Image src="/image.png" width={600} height={400} />

// Fill with container
<div className="aspect-video relative">
  <Image src="/image.png" fill />
</div>
```

### ✅ Optimize Quality
```tsx
<Image src="/image.png" quality={75} /> // 75-85 is optimal
```

---

## Server vs Client Components

### Decision Tree
```
Need interactivity? (onClick, useState, etc.)
  ├─ YES → 'use client'
  └─ NO  → Server Component (default)
```

### Examples

```tsx
// ✅ Server Component (default)
export default async function RecipeList() {
  const recipes = await fetchRecipes();
  return <div>{recipes.map(...)}</div>;
}

// ✅ Client Component (when needed)
'use client';
export function FavoriteButton() {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(!liked)}>...</button>;
}
```

---

## Font Optimization

### ✅ Use next/font
```tsx
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',  // Prevents FOIT
});
```

### ✅ Preconnect
```tsx
<head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
</head>
```

---

## Performance Targets

| Metric | Target | Excellent |
|--------|--------|-----------|
| FCP    | < 1.8s | < 1.0s    |
| LCP    | < 2.5s | < 1.2s    |
| TBT    | < 300ms| < 200ms   |
| CLS    | < 0.1  | < 0.05    |

---

## Common Issues & Fixes

### Issue: Large Images
**Fix**: Use Next.js Image with WebP conversion
```tsx
<Image src="/large.png" width={600} height={400} quality={85} />
```

### Issue: Layout Shift
**Fix**: Always specify dimensions
```tsx
<Image src="/image.png" width={600} height={400} />
// OR
<div className="aspect-video relative">
  <Image src="/image.png" fill />
</div>
```

### Issue: Slow Font Loading
**Fix**: Use display: swap
```tsx
const font = Inter({ display: 'swap' });
```

### Issue: Unnecessary Client Components
**Fix**: Remove 'use client' if no interactivity
```tsx
// ❌ BAD - No interactivity needed
'use client';
export function RecipeCard({ recipe }) {
  return <div>{recipe.name}</div>;
}

// ✅ GOOD - Server Component
export function RecipeCard({ recipe }) {
  return <div>{recipe.name}</div>;
}
```

---

## Next.js Config

```typescript
// next.config.ts
export default {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['lucide-react', 'react-icons'],
  },
};
```

---

## Documentation Links

- **Full Audit**: `docs/performance/PERFORMANCE_AUDIT.md`
- **Complete Guide**: `docs/guides/PERFORMANCE_OPTIMIZATION.md`
- **Fix Summary**: `docs/performance/PERFORMANCE_FIX_SUMMARY.md`

---

## Testing

```bash
# Chrome DevTools
1. Open DevTools > Network
2. Set throttling to "Slow 3G"
3. Reload page
4. Check waterfall chart

# Lighthouse
1. Open DevTools > Lighthouse
2. Select "Performance" + "Mobile"
3. Run analysis
4. Target: Score > 85
```

---

**Updated**: 2025-10-16
