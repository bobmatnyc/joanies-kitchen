# Bundle Optimization Quick Start Guide

**Date**: 2025-10-18
**For**: Recipe Manager - Recipe Detail Page Optimization
**Estimated Time**: 4-6 hours
**Expected Bundle Reduction**: 50-100 KB

---

## TL;DR - Quick Wins

**Problem**: Recipe page loads 257 KB (154 KB route-specific code)
**Solution**: Lazy load export functionality and widgets
**Impact**: 50-100 KB reduction, faster initial page load

---

## Step 1: Dynamic Import Export Functionality

**File**: `src/app/recipes/[slug]/page.tsx`
**Time**: 30 minutes
**Impact**: ~50-100 KB reduction

### Before (Eager Loading)
```typescript
import { exportRecipeAsMarkdown, exportRecipeAsPDF } from '@/app/actions/recipe-export';

const handleExportMarkdown = useCallback(async () => {
  if (!recipe) return;
  try {
    setExporting(true);
    const result = await exportRecipeAsMarkdown(recipe.id);
    // ... download logic
  } catch (error) {
    toast.error('Failed to export recipe');
  } finally {
    setExporting(false);
  }
}, [recipe]);
```

### After (Lazy Loading)
```typescript
// Remove top-level import
// import { exportRecipeAsMarkdown, exportRecipeAsPDF } from '@/app/actions/recipe-export';

const handleExportMarkdown = useCallback(async () => {
  if (!recipe) return;
  try {
    setExporting(true);

    // Dynamically import only when user clicks Export
    const { exportRecipeAsMarkdown } = await import('@/app/actions/recipe-export');
    const result = await exportRecipeAsMarkdown(recipe.id);

    // ... download logic (same as before)
  } catch (error) {
    toast.error('Failed to export recipe');
  } finally {
    setExporting(false);
  }
}, [recipe]);

const handleExportPDF = useCallback(async () => {
  if (!recipe) return;
  try {
    setExporting(true);

    // Dynamically import only when user clicks Export
    const { exportRecipeAsPDF } = await import('@/app/actions/recipe-export');
    const result = await exportRecipeAsPDF(recipe.id);

    // ... download logic (same as before)
  } catch (error) {
    toast.error('Failed to export recipe as PDF');
  } finally {
    setExporting(false);
  }
}, [recipe]);
```

### Changes Required
1. **Remove** import line (line 24)
2. **Add** dynamic import inside `handleExportMarkdown` callback
3. **Add** dynamic import inside `handleExportPDF` callback
4. **Test** both export buttons work correctly

---

## Step 2: Lazy Load Similar Recipes Widget

**File**: `src/app/recipes/[slug]/page.tsx`
**Time**: 15 minutes
**Impact**: ~10-20 KB reduction

### Before (Eager Loading)
```typescript
import { SimilarRecipesWidget } from '@/components/recipe/SimilarRecipesWidget';

// At bottom of component
<div className="mt-8">
  <SimilarRecipesWidget recipeId={recipe.id} recipeName={recipe.name} limit={6} />
</div>
```

### After (Lazy Loading)
```typescript
import dynamic from 'next/dynamic';

// Lazy load with loading placeholder
const SimilarRecipesWidget = dynamic(
  () => import('@/components/recipe/SimilarRecipesWidget').then(mod => ({ default: mod.SimilarRecipesWidget })),
  {
    loading: () => (
      <div className="mt-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded-md w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    ),
    ssr: false, // Widget is not critical for SEO
  }
);

// Usage remains the same
<div className="mt-8">
  <SimilarRecipesWidget recipeId={recipe.id} recipeName={recipe.name} limit={6} />
</div>
```

### Changes Required
1. **Add** `import dynamic from 'next/dynamic'` at top
2. **Replace** `SimilarRecipesWidget` import with dynamic version
3. **Test** widget loads and shows placeholder correctly

---

## Step 3: Optimize Package Imports

**File**: `next.config.ts`
**Time**: 5 minutes
**Impact**: ~5-10 KB reduction

### Before
```typescript
experimental: {
  optimizePackageImports: ['lucide-react', 'react-icons', '@radix-ui/react-icons'],
},
```

### After
```typescript
experimental: {
  optimizePackageImports: [
    'lucide-react',
    'react-icons',
    '@radix-ui/react-icons',
    '@radix-ui/react-dialog',
    '@radix-ui/react-popover',
    '@radix-ui/react-alert-dialog',
    '@radix-ui/react-select',
    '@radix-ui/react-tabs',
    'sonner',
  ],
},
```

### Changes Required
1. **Add** more packages to `optimizePackageImports` array
2. **Rebuild** to see impact: `pnpm build`

---

## Step 4: Verify Optimizations

### Build and Compare
```bash
# Before optimization
pnpm build | grep "recipes/\[slug\]"
# Expected: ƒ /recipes/[slug]  63.9 kB  257 kB

# After optimization
pnpm build | grep "recipes/\[slug\]"
# Expected: ƒ /recipes/[slug]  63.9 kB  150-200 kB
```

### Test Functionality
1. ✅ Recipe page loads correctly
2. ✅ Export Markdown button works
3. ✅ Export PDF button works
4. ✅ Similar recipes widget loads (with skeleton first)
5. ✅ No console errors
6. ✅ No runtime errors

### Measure Performance
```bash
# Run Lighthouse audit
npx lighthouse http://localhost:3000/recipes/[actual-slug] --view

# Check key metrics:
# - First Contentful Paint (FCP)
# - Largest Contentful Paint (LCP)
# - Total Blocking Time (TBT)
# - Cumulative Layout Shift (CLS)
```

---

## Testing Checklist

### Functional Testing
- [ ] Recipe page renders correctly
- [ ] All buttons visible and clickable
- [ ] Export Markdown downloads correct file
- [ ] Export PDF downloads correct file
- [ ] Similar recipes widget appears after main content
- [ ] Widget skeleton shows while loading
- [ ] No JavaScript errors in console
- [ ] Mobile view works correctly

### Performance Testing
- [ ] Bundle size reduced (check build output)
- [ ] Page loads faster (subjective test)
- [ ] Export buttons respond quickly (< 500ms)
- [ ] Widget loads within 1-2 seconds
- [ ] Lighthouse score improved

### Regression Testing
- [ ] Copy recipe still works
- [ ] Print recipe still works
- [ ] Delete recipe still works (for owners)
- [ ] Edit recipe link works (for owners)
- [ ] All engagement buttons work (favorites, collections, clone)
- [ ] Image carousel works
- [ ] Semantic tags display correctly

---

## Rollback Plan

If optimizations cause issues:

### 1. Revert Export Changes
```bash
git checkout HEAD -- src/app/recipes/[slug]/page.tsx
```

### 2. Revert Widget Changes
Remove `dynamic` import and restore original import:
```typescript
import { SimilarRecipesWidget } from '@/components/recipe/SimilarRecipesWidget';
```

### 3. Revert Config Changes
```bash
git checkout HEAD -- next.config.ts
```

### 4. Rebuild
```bash
pnpm build
```

---

## Expected Results

### Bundle Size
**Before**: 257 KB total (154 KB route-specific)
**After**: 150-200 KB total (50-100 KB route-specific)
**Reduction**: 50-100 KB (20-40%)

### Load Time
**Before**: [Baseline from Lighthouse]
**After**: 0.3-0.8 seconds faster on 3G
**Improvement**: 15-30%

### User Experience
- Faster initial page load
- Recipe content visible sooner
- Export features load on-demand (no delay perceived by user)
- Similar recipes load progressively

---

## Advanced Optimizations (Optional)

### Image Carousel Optimization
**File**: `src/components/recipe/ImageCarousel.tsx`
**Time**: 1-2 hours
**Impact**: ~10-15 KB

Consider:
- Lazy load full-screen viewer
- Use native `loading="lazy"` for non-primary images
- Defer image preloading

### Engagement Component Optimization
**Files**: Various component files
**Time**: 2-3 hours
**Impact**: ~10-20 KB

Consider:
- Dynamic import for `AddToCollectionButton` (rarely used)
- Dynamic import for `CloneRecipeButton` (rarely used)
- Keep `FavoriteButton` (frequently used)

### Route-based Code Splitting
**Files**: App router structure
**Time**: 4-6 hours
**Impact**: Better long-term architecture

Consider:
- Create route groups for different recipe contexts
- Split authentication-required features
- Separate admin features

---

## Monitoring

### After Deployment

Track these metrics:
1. **Bundle Size**: Monitor in each build
2. **Export Usage**: Track how often users export recipes
3. **Widget Engagement**: Track similar recipe clicks
4. **Error Rate**: Monitor dynamic import failures
5. **Load Time**: Track via Real User Monitoring (RUM)

### Analytics Events
```typescript
// Track export usage
handleExportMarkdown() {
  analytics.track('recipe_export_markdown', { recipeId: recipe.id });
  // ... export logic
}

// Track widget visibility
useEffect(() => {
  if (widgetVisible) {
    analytics.track('similar_recipes_viewed', { recipeId: recipe.id });
  }
}, [widgetVisible]);
```

---

## Common Issues & Solutions

### Issue: Dynamic Import Fails
**Symptom**: "Failed to fetch dynamically imported module" error
**Solution**:
```typescript
try {
  const { exportRecipeAsMarkdown } = await import('@/app/actions/recipe-export');
} catch (error) {
  console.error('Failed to load export module:', error);
  toast.error('Export feature temporarily unavailable');
  // Fallback: show instructions to refresh page
}
```

### Issue: Similar Widget Doesn't Load
**Symptom**: Skeleton shows indefinitely
**Solution**:
- Check network tab for failed chunk load
- Verify widget component exports correctly
- Add timeout to show error message

### Issue: Bundle Size Didn't Reduce
**Symptom**: Build output shows same size
**Solution**:
- Clear `.next` cache: `rm -rf .next`
- Rebuild: `pnpm build`
- Verify dynamic imports are actually dynamic (check build output for separate chunks)

---

## Next Steps

After implementing these quick wins:

1. **Measure Impact**: Compare before/after metrics
2. **Document Results**: Update this guide with actual numbers
3. **Plan Phase 2**: Medium-impact optimizations
4. **Consider Architecture**: Long-term code splitting strategy

---

## Resources

### Next.js Documentation
- [Dynamic Imports](https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading)
- [Bundle Analyzer](https://nextjs.org/docs/app/building-your-application/optimizing/bundle-analyzer)
- [Code Splitting](https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming)

### Performance Tools
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [WebPageTest](https://webpagetest.org)
- [Bundle Analyzer](https://www.npmjs.com/package/@next/bundle-analyzer)

### Monitoring
- [Vercel Analytics](https://vercel.com/analytics)
- [Web Vitals](https://web.dev/vitals/)

---

**Guide Created**: 2025-10-18
**Last Updated**: 2025-10-18
**Estimated Completion**: 4-6 hours
**Expected Bundle Reduction**: 50-100 KB
