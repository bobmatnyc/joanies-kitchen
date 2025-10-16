# Performance Audit Report - Joanie's Kitchen

**Date**: 2025-10-16
**Target**: Next.js 15.5.3 with App Router
**Environment**: Development (localhost:3002)
**Auditor**: Claude Code - NextJS Engineer

---

## Executive Summary

### Critical Performance Issues Identified

1. **🔴 CRITICAL: Unoptimized Hero Image (3.5MB PNG)**
   - `joanie-portrait.png` is **3.5MB** - single largest bottleneck
   - Not using Next.js Image component
   - No WebP conversion
   - No responsive sizing
   - **Impact**: Massive LCP degradation (likely 3-5+ seconds)

2. **🔴 CRITICAL: Image Optimization Disabled**
   - `next.config.ts` has `unoptimized: true`
   - Disables all Next.js image optimization
   - No WebP conversion, no responsive sizes, no lazy loading

3. **🟡 HIGH: Missing Image Dimensions**
   - Many images lack explicit width/height
   - Causes layout shift (CLS issues)
   - Browser cannot reserve space during load

4. **🟡 HIGH: Excessive Client Components (53 files)**
   - Many components marked `'use client'` unnecessarily
   - Increases client-side JavaScript bundle
   - Reduces Server Components benefits

5. **🟡 HIGH: Large Logo Images**
   - `joanies-kitchen-logo.png` is 1MB (unused)
   - Multiple logo variants not optimized

6. **🟢 MEDIUM: No Font Preloading**
   - Custom fonts (Playfair Display, Lora, Inter) not preloaded
   - Fonts loaded via `next/font` (good) but no preconnect hints

---

## Detailed Analysis

### 1. First Contentful Paint (FCP) Issues

**Current Bottlenecks**:
- Unoptimized images delay initial render
- Client-side JavaScript bundle size (53 client components)
- Font loading without preload hints
- Disabled Next.js image optimization

**Expected Current FCP**: 2-3 seconds (BAD)
**Target FCP**: < 1.0 seconds (EXCELLENT)

**Root Causes**:
- Homepage loads 3.5MB image immediately
- No priority hints on above-the-fold content
- Render-blocking resources

### 2. Largest Contentful Paint (LCP) Issues

**Primary LCP Elements**:
1. **Homepage Hero Image** (`joanie-portrait.png` - 3.5MB)
   - Not using Next.js Image component
   - No WebP conversion (could be 80% smaller)
   - No responsive sizes
   - Line 171-177 in `src/app/page.tsx`

2. **Recipe Card Images** (lazy loaded but not optimized)
   - Using `<img>` instead of `<Image>` in RecipeCard
   - Line 48-57 in `src/components/recipe/RecipeCard.tsx`

**Expected Current LCP**: 3-5+ seconds (VERY BAD)
**Target LCP**: < 2.0 seconds (GOOD) or < 1.2 seconds (EXCELLENT)

**Impact Analysis**:
- 3.5MB image on slow 3G: ~7 seconds download
- On fast 4G: ~2-3 seconds
- On fiber: ~1 second
- **User Impact**: High bounce rate, poor mobile experience

### 3. Bundle Size Analysis

**Client Components** (53 files with `'use client'`):
- Many could be Server Components
- Examples of unnecessary client components:
  - RecipeCard (line 1) - could be server
  - RecipeList (could be server with client children)
  - SharedRecipeCard (could be server)

**Optimization Opportunities**:
- Convert static display components to Server Components
- Only mark interactive parts as Client Components
- Reduce client-side JavaScript by 30-40%

### 4. Image Optimization Disabled

**Current Configuration** (`next.config.ts`, line 12):
```typescript
images: {
  unoptimized: true, // ❌ DISABLES ALL OPTIMIZATION
}
```

**Why This Is Critical**:
- No WebP conversion (loses 70-80% size reduction)
- No responsive images (wastes bandwidth on mobile)
- No lazy loading optimization
- No blur placeholder support

**Fix Required**: Remove `unoptimized: true` and configure properly

### 5. Homepage Performance Issues

**File**: `src/app/page.tsx`

**Issues**:
1. **Line 36-44**: Hero logo using Next Image ✅ (GOOD) with priority ✅
2. **Line 171-177**: Joanie portrait using plain `<img>` ❌ (BAD)
   - 3.5MB PNG
   - No Next.js optimization
   - No WebP support
   - No responsive sizes

**Expected Load Time**:
- Current: 3-5 seconds on mobile
- After fix: 0.5-1 second

### 6. Recipe Detail Page Issues

**File**: `src/app/recipes/[id]/page.tsx`

**Issues**:
- Client Component (line 1) - should be Server Component
- Uses dynamic imports which is good
- ImageCarousel component needs optimization

### 7. Font Loading

**Current Setup** (`src/app/layout.tsx`):
- Using `next/font` ✅ (GOOD)
- `display: "swap"` ✅ (GOOD)
- No preconnect hints ⚠️ (could be better)

**Font Sizes**:
- Playfair Display: ~50-80KB
- Lora: ~40-60KB
- Inter: ~30-50KB
- **Total**: ~150KB (acceptable)

---

## Performance Scores Estimation

### Before Optimization
- **FCP**: 2.5-3.5 seconds ❌
- **LCP**: 3.5-5.5 seconds ❌
- **TBT**: 300-500ms ❌
- **CLS**: 0.15-0.25 ⚠️ (layout shifts from images)
- **Lighthouse Score**: 40-60/100 ❌

### After Optimization (Projected)
- **FCP**: 0.8-1.2 seconds ✅
- **LCP**: 1.2-2.0 seconds ✅
- **TBT**: 100-200ms ✅
- **CLS**: < 0.1 ✅
- **Lighthouse Score**: 85-95/100 ✅

**Expected Improvement**: 60-80% faster page loads

---

## Root Cause Analysis

### Why Images Are Unoptimized

**Hypothesis**: Image optimization was likely disabled to allow external recipe images without configuration errors.

**Evidence**:
- 175 remote patterns configured in `next.config.ts`
- Many external recipe sources (Epicurious, Bon Appétit, etc.)
- Developer likely hit image optimization errors and disabled it entirely

**Problem**: Disabling optimization globally affects ALL images, including local static assets.

**Correct Solution**: Keep optimization enabled, configure remote patterns properly

---

## Critical Path to Fix

### Priority 1: Enable Image Optimization
1. Remove `unoptimized: true` from `next.config.ts`
2. Add proper image configuration with WebP support
3. Configure loader for external images

### Priority 2: Optimize Hero Image
1. Convert `joanie-portrait.png` to WebP
2. Create responsive sizes (400w, 600w, 800w, 1200w)
3. Use Next.js Image component with priority
4. Reduce original size from 3.5MB to ~200-300KB

### Priority 3: Fix Homepage Images
1. Update Joanie portrait to use Next Image
2. Add explicit dimensions
3. Add priority flag for above-the-fold
4. Implement blur placeholder

### Priority 4: Optimize RecipeCard
1. Update RecipeCard to use Next Image
2. Add lazy loading for below-fold
3. Add explicit dimensions
4. Generate blur placeholders

### Priority 5: Convert to Server Components
1. Audit 53 client components
2. Convert non-interactive components to Server Components
3. Reduce client bundle size by 30-40%

---

## File-Level Issues

### High Priority Files

| File | Issue | Impact | Priority |
|------|-------|--------|----------|
| `next.config.ts` | Image optimization disabled | CRITICAL | 🔴 P0 |
| `src/app/page.tsx` | 3.5MB unoptimized hero image | CRITICAL | 🔴 P0 |
| `src/components/recipe/RecipeCard.tsx` | Using `<img>` not `<Image>` | HIGH | 🟡 P1 |
| `src/app/recipes/[id]/page.tsx` | Unnecessary Client Component | HIGH | 🟡 P1 |
| `public/joanie-portrait.png` | 3.5MB PNG file | CRITICAL | 🔴 P0 |

### Medium Priority Files

| File | Issue | Impact | Priority |
|------|-------|--------|----------|
| `src/components/recipe/SharedRecipeCard.tsx` | Likely using `<img>` | MEDIUM | 🟢 P2 |
| `src/components/chef/ChefAvatar.tsx` | Image optimization needed | MEDIUM | 🟢 P2 |
| Multiple components | Unnecessary Client Components | MEDIUM | 🟢 P2 |

---

## Browser-Specific Impacts

### Mobile (4G Connection)
- **Current**: 4-6 second load time
- **After Fix**: 1-2 second load time
- **Improvement**: 66-75% faster

### Desktop (Fiber)
- **Current**: 1.5-2.5 second load time
- **After Fix**: 0.5-1 second load time
- **Improvement**: 60-70% faster

### Slow 3G (Worst Case)
- **Current**: 8-12 second load time
- **After Fix**: 2-3 second load time
- **Improvement**: 75-80% faster

---

## Recommendations

### Immediate Actions (Today)
1. ✅ Optimize `joanie-portrait.png` (convert to WebP, reduce size)
2. ✅ Re-enable image optimization in `next.config.ts`
3. ✅ Fix homepage hero image component
4. ✅ Add explicit image dimensions everywhere

### Short-Term (This Week)
1. Update all image components to use Next.js Image
2. Generate blur placeholders for images
3. Audit and reduce client components
4. Add font preloading hints

### Long-Term (This Month)
1. Implement image CDN for external recipes
2. Add responsive images for all screen sizes
3. Implement lazy loading for all below-fold content
4. Set up automated Lighthouse CI monitoring

---

## Testing Checklist

### Before Deployment
- [ ] Run Lighthouse on homepage
- [ ] Run Lighthouse on `/recipes/[id]` page
- [ ] Test on slow 3G network (Chrome DevTools)
- [ ] Test on real mobile devices (iOS, Android)
- [ ] Verify WebP images load correctly
- [ ] Check image fallbacks work
- [ ] Measure bundle size reduction
- [ ] Verify no layout shift (CLS < 0.1)

### Success Criteria
- ✅ FCP < 1.0s on desktop
- ✅ FCP < 1.8s on mobile
- ✅ LCP < 1.2s on desktop
- ✅ LCP < 2.5s on mobile
- ✅ TBT < 200ms
- ✅ CLS < 0.1
- ✅ Lighthouse score > 85

---

## Next Steps

See `docs/guides/PERFORMANCE_OPTIMIZATION.md` for implementation guide.

---

**Audit Complete**
**Estimated Fix Time**: 2-4 hours
**Expected Performance Gain**: 60-80% improvement in FCP/LCP
