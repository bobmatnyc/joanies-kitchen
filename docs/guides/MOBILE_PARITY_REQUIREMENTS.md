# Mobile Parity Requirements

**Version**: 0.45.0
**Priority**: 🔴 CRITICAL
**Target**: November 2024 (1-2 weeks)
**Status**: PLANNED

---

## Overview

Mobile parity ensures that Joanie's Kitchen provides an excellent experience on mobile devices (phones and tablets) BEFORE adding advanced features. This is critical because:

- **60-70% of recipe site traffic** comes from mobile devices
- Users often cook with their phones/tablets in hand
- Mobile experience is a key factor in user retention
- Foundation for future PWA features (Version 0.8.0)

**Goal**: Ensure every page and feature works flawlessly on mobile devices with screen sizes from 320px to 768px.

---

## Table of Contents

1. [Responsive Design Requirements](#responsive-design-requirements)
2. [Touch Optimization](#touch-optimization)
3. [Mobile Navigation](#mobile-navigation)
4. [Performance Requirements](#performance-requirements)
5. [Typography & Readability](#typography--readability)
6. [Mobile-Specific Features](#mobile-specific-features)
7. [Testing Requirements](#testing-requirements)
8. [Implementation Checklist](#implementation-checklist)
9. [Success Metrics](#success-metrics)

---

## Responsive Design Requirements

### Tailwind CSS Breakpoints

```typescript
// tailwind.config.ts
const breakpoints = {
  'sm': '640px',   // Small phones (landscape)
  'md': '768px',   // Tablets
  'lg': '1024px',  // Small desktops
  'xl': '1280px',  // Large desktops
  '2xl': '1536px'  // Extra large
}
```

### Mobile-First Approach

**Strategy**: Design for mobile first, then enhance for larger screens

```css
/* ✅ CORRECT: Mobile-first */
.recipe-card {
  @apply w-full;           /* Mobile: Full width */
  @apply md:w-1/2;         /* Tablet: Half width */
  @apply lg:w-1/3;         /* Desktop: Third width */
}

/* ❌ INCORRECT: Desktop-first */
.recipe-card {
  @apply w-1/3 lg:w-full;  /* Don't do this */
}
```

### Layout Requirements

#### Recipe Card Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
  {/* Mobile: 1 column */}
  {/* Tablet: 2 columns */}
  {/* Desktop: 3-4 columns */}
</div>
```

#### Recipe Detail Page
- **Mobile**: Single column, stack all sections
- **Tablet**: 2 columns (ingredients left, instructions right)
- **Desktop**: 3 columns (add nutrition sidebar)

#### Forms
- **Mobile**: Single column, full-width inputs
- **Tablet**: Maintain single column for simplicity
- **Desktop**: Optional 2-column layout

### Container Sizing

```tsx
// src/components/layout/Container.tsx
<div className="
  w-full
  px-4 sm:px-6 md:px-8 lg:px-12
  max-w-screen-2xl
  mx-auto
">
  {children}
</div>
```

### Image Handling

```tsx
// Recipe images - responsive
<Image
  src={recipe.image}
  alt={recipe.name}
  width={800}
  height={600}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
  className="w-full h-auto object-cover"
  priority={false}
  loading="lazy"
/>
```

---

## Touch Optimization

### Touch Target Sizes

**Minimum sizes** (following Apple/Material guidelines):
- **Buttons**: 44x44px (iOS), 48x48px (Material Design)
- **Links**: 44x44px minimum clickable area
- **Icons**: 24x24px icon + 12px padding = 48x48px target

```tsx
// ✅ CORRECT: Proper touch target
<button className="
  h-12 px-6               // 48px height, adequate padding
  min-w-[120px]           // Minimum width
  touch-manipulation      // Prevent double-tap zoom
  active:scale-95         // Tap feedback
">
  Submit
</button>

// ❌ INCORRECT: Too small
<button className="h-8 px-2">  // 32px height - too small!
  Submit
</button>
```

### Touch Target Spacing

```css
/* Minimum 8px spacing between interactive elements */
.button-group {
  @apply flex gap-2;  /* 8px gap */
}

/* Comfortable spacing: 16px */
.action-buttons {
  @apply flex gap-4;  /* 16px gap */
}
```

### Touch Feedback

```tsx
// Visual feedback on touch
<button className="
  transition-all duration-150
  active:scale-95
  active:bg-olive-600
  touch-manipulation
">
  {children}
</button>
```

### Swipe Gestures

```tsx
// Image gallery with swipe support
import { useSwipeable } from 'react-swipeable';

const ImageGallery = ({ images }) => {
  const handlers = useSwipeable({
    onSwipedLeft: () => nextImage(),
    onSwipedRight: () => prevImage(),
    trackMouse: false, // Disable on desktop
    trackTouch: true,
  });

  return <div {...handlers}>{/* Gallery content */}</div>;
};
```

### Prevent Accidental Touches

```css
/* Prevent text selection on interactive elements */
.interactive {
  @apply select-none;
  -webkit-touch-callout: none;  /* Disable iOS callout */
}

/* Prevent double-tap zoom on buttons/inputs */
.no-zoom {
  touch-action: manipulation;
}
```

---

## Mobile Navigation

### Header Design

```tsx
// src/components/layout/Header.tsx
<header className="
  sticky top-0 z-50
  bg-linen border-b border-sage-200
  transition-transform duration-300
  {isScrollingDown ? '-translate-y-full' : 'translate-y-0'}
">
  {/* Mobile: Hamburger menu */}
  {/* Desktop: Full navigation */}
</header>
```

### Hamburger Menu (Mobile)

```tsx
// Mobile menu (< 768px)
<nav className="md:hidden">
  <button
    onClick={toggleMenu}
    className="h-12 w-12 flex items-center justify-center"
    aria-label="Toggle menu"
  >
    <MenuIcon className="w-6 h-6" />
  </button>

  {isMenuOpen && (
    <div className="
      fixed inset-0 z-50
      bg-linen
      overflow-y-auto
    ">
      {/* Fullscreen menu content */}
    </div>
  )}
</nav>
```

### Bottom Navigation Bar

```tsx
// Thumb-zone friendly navigation
<nav className="
  fixed bottom-0 left-0 right-0
  h-16 bg-white border-t border-sage-200
  flex justify-around items-center
  md:hidden
  pb-safe  /* Account for iOS home indicator */
">
  <NavItem icon={HomeIcon} label="Home" />
  <NavItem icon={SearchIcon} label="Search" />
  <NavItem icon={HeartIcon} label="Favorites" />
  <NavItem icon={UserIcon} label="Profile" />
</nav>
```

### Collapsible Header on Scroll

```tsx
// Hide header when scrolling down, show when scrolling up
const [isScrollingDown, setIsScrollingDown] = useState(false);
const [lastScrollY, setLastScrollY] = useState(0);

useEffect(() => {
  const handleScroll = () => {
    const currentScrollY = window.scrollY;
    setIsScrollingDown(currentScrollY > lastScrollY && currentScrollY > 100);
    setLastScrollY(currentScrollY);
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, [lastScrollY]);
```

### Mobile Breadcrumbs

```tsx
// Simplified breadcrumbs on mobile
<nav className="flex items-center text-sm">
  {/* Mobile: Show only current and parent */}
  <div className="md:hidden">
    <BackButton /> <span>{currentPage}</span>
  </div>

  {/* Desktop: Full breadcrumb trail */}
  <div className="hidden md:flex">
    {breadcrumbs.map((crumb) => (
      <Breadcrumb key={crumb.id} {...crumb} />
    ))}
  </div>
</nav>
```

---

## Performance Requirements

### Performance Targets

| Metric | Target (Mobile 3G) | Target (Mobile 4G) |
|--------|-------------------|-------------------|
| **First Contentful Paint (FCP)** | < 1.5s | < 1.0s |
| **Largest Contentful Paint (LCP)** | < 2.5s | < 1.5s |
| **Time to Interactive (TTI)** | < 3.0s | < 2.0s |
| **Cumulative Layout Shift (CLS)** | < 0.1 | < 0.1 |
| **First Input Delay (FID)** | < 100ms | < 50ms |
| **Total Bundle Size** | < 200KB (gzipped) | < 200KB |
| **Lighthouse Mobile Score** | 90+ | 95+ |

### Image Optimization

```tsx
// next.config.ts
export default {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [320, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
};
```

**Image size targets**:
- Mobile: < 50KB per image
- Tablet: < 75KB per image
- Desktop: < 100KB per image

### Lazy Loading

```tsx
// Component lazy loading
import dynamic from 'next/dynamic';

const RecipeDetail = dynamic(() => import('@/components/recipe/RecipeDetail'), {
  loading: () => <RecipeDetailSkeleton />,
  ssr: true,
});

// Image lazy loading (automatic with next/image)
<Image
  src={recipe.image}
  alt={recipe.name}
  loading="lazy"  // Default for images below fold
  priority={false}
/>
```

### Code Splitting

```tsx
// Route-based code splitting (automatic in Next.js App Router)
// app/recipes/[id]/page.tsx - automatically split

// Component-based splitting
const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  ssr: false, // Skip SSR if not needed
  loading: () => <Skeleton />,
});
```

### Font Optimization

```tsx
// app/layout.tsx
import { Playfair_Display, Lora } from 'next/font/google';

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
  preload: true,
  fallback: ['Georgia', 'serif'],
});

const lora = Lora({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-lora',
  preload: true,
  fallback: ['Georgia', 'serif'],
});
```

### CSS Optimization

```bash
# Tailwind automatically purges unused CSS in production
# Verify with:
pnpm build
# Check .next/static/css/*.css file sizes
```

### Bundle Size Monitoring

```bash
# Analyze bundle size
pnpm build
pnpm analyze  # If @next/bundle-analyzer is configured

# Target: Initial load < 200KB (gzipped)
```

---

## Typography & Readability

### Font Sizes (Mobile-Optimized)

```css
/* Base font size: 16px (never go below!) */
body {
  @apply text-base;  /* 16px */
}

/* Heading sizes (mobile) */
h1 { @apply text-2xl md:text-4xl; }    /* 24px → 36px */
h2 { @apply text-xl md:text-3xl; }     /* 20px → 30px */
h3 { @apply text-lg md:text-2xl; }     /* 18px → 24px */
h4 { @apply text-base md:text-xl; }    /* 16px → 20px */

/* Body text */
p { @apply text-base md:text-lg; }     /* 16px → 18px */

/* Small text */
.text-small { @apply text-sm; }        /* 14px (minimum) */
```

### Line Height

```css
/* Optimal readability */
body {
  @apply leading-relaxed;  /* 1.625 */
}

h1, h2, h3 {
  @apply leading-tight;    /* 1.25 */
}

p {
  @apply leading-relaxed;  /* 1.625 */
  @apply md:leading-loose; /* 2 on desktop */
}
```

### Text Contrast (WCAG AA)

```css
/* Minimum contrast ratios */
/* Normal text: 4.5:1 */
/* Large text (18px+): 3:1 */

/* Joanie's Kitchen colors (verified for accessibility) */
.text-olive {
  @apply text-olive;       /* #5B6049 on #FAF5EE = 7.2:1 ✅ */
}

.text-sage {
  @apply text-sage-700;    /* Ensure 4.5:1 contrast */
}
```

### Preventing Text Zoom Issues

```html
<!-- Prevent iOS text size adjustment -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">

<!-- Allow zoom but prevent automatic adjustment -->
<style>
  body {
    -webkit-text-size-adjust: 100%;
    -moz-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }
</style>
```

### Readable Line Lengths

```css
/* Optimal: 50-75 characters per line */
.recipe-content {
  @apply max-w-prose;  /* ~65ch (characters) */
  @apply mx-auto;
}
```

---

## Mobile-Specific Features

### Viewport Configuration

```html
<!-- app/layout.tsx -->
<head>
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
  />
  <meta name="theme-color" content="#5B6049" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
</head>
```

### Safe Area Insets (Notches, Home Indicators)

```css
/* Account for iOS notch and home indicator */
.header {
  padding-top: env(safe-area-inset-top);
}

.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Tailwind plugin for safe areas */
/* Add to tailwind.config.ts */
module.exports = {
  theme: {
    extend: {
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      }
    }
  }
}
```

### Dark Mode Optimization

```tsx
// Respect system preference
<html className="dark" suppressHydrationWarning>
  {/* Dark mode styles automatically applied via Tailwind */}
</html>

// Colors for dark mode
.recipe-card {
  @apply bg-white dark:bg-olive-900;
  @apply text-olive dark:text-linen;
}
```

### Loading Skeletons

```tsx
// RecipeCardSkeleton.tsx
export const RecipeCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="bg-sage-200 h-48 rounded-t-lg" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-sage-200 rounded w-3/4" />
      <div className="h-3 bg-sage-200 rounded w-full" />
      <div className="h-3 bg-sage-200 rounded w-5/6" />
    </div>
  </div>
);
```

### Error States (Mobile-Friendly)

```tsx
// MobileErrorState.tsx
export const MobileErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <AlertCircle className="w-16 h-16 text-tomato mb-4" />
    <h3 className="text-lg font-semibold mb-2">Oops! Something went wrong</h3>
    <p className="text-sm text-olive-600 mb-6">{message}</p>
    <button
      onClick={onRetry}
      className="h-12 px-6 bg-tomato text-white rounded-lg"
    >
      Try Again
    </button>
  </div>
);
```

### Offline Indicators

```tsx
// OfflineIndicator.tsx
export const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-tomato text-white text-center py-2 text-sm z-50">
      You're offline. Some features may be unavailable.
    </div>
  );
};
```

---

## Testing Requirements

### Device Testing Matrix

| Device Category | Devices | Screen Sizes |
|----------------|---------|--------------|
| **Small Phones** | iPhone SE, Pixel 4a | 320px - 375px |
| **Standard Phones** | iPhone 13, Galaxy S21 | 375px - 414px |
| **Large Phones** | iPhone 14 Pro Max, Pixel 7 Pro | 414px - 428px |
| **Tablets** | iPad, Galaxy Tab | 768px - 1024px |

### Browser Testing

- **iOS Safari** (primary)
- **Chrome (Android)** (primary)
- **Samsung Internet**
- **Firefox Mobile**
- **Edge Mobile**

### Chrome DevTools Testing

```bash
# Device emulation modes to test:
- iPhone SE (375x667)
- iPhone 12 Pro (390x844)
- iPhone 14 Pro Max (430x932)
- iPad Air (820x1180)
- Galaxy S20 (360x800)
- Pixel 5 (393x851)

# Network throttling:
- Fast 3G
- Slow 3G
- Offline
```

### Testing Checklist

#### Layout Testing
- [ ] All pages render correctly at 320px width (smallest phones)
- [ ] No horizontal scrolling on any page
- [ ] Images scale properly and don't overflow
- [ ] Text is readable without zooming
- [ ] Buttons and links are easily tappable
- [ ] Forms are usable on mobile
- [ ] Modals/dialogs fit on screen

#### Interaction Testing
- [ ] All buttons have proper touch targets (44x44px minimum)
- [ ] Touch feedback works (visual/haptic)
- [ ] Swipe gestures work smoothly
- [ ] Scrolling is smooth (no janky animations)
- [ ] Pull-to-refresh works (if implemented)
- [ ] No accidental touches due to poor spacing

#### Performance Testing
- [ ] Pages load in < 3s on 3G
- [ ] Images load progressively
- [ ] No layout shifts during load
- [ ] Animations run at 60fps
- [ ] Lighthouse Mobile Score: 90+

#### Navigation Testing
- [ ] Mobile menu opens/closes smoothly
- [ ] Back button works correctly
- [ ] Breadcrumbs are clear on mobile
- [ ] Bottom navigation is accessible
- [ ] Header collapses on scroll (if implemented)

#### Content Testing
- [ ] Text is readable (16px minimum)
- [ ] Headings scale appropriately
- [ ] Line lengths are comfortable
- [ ] Contrast meets WCAG AA standards
- [ ] Images have proper alt text

#### Form Testing
- [ ] Inputs are large enough to type in
- [ ] Keyboard doesn't obscure inputs
- [ ] Validation messages are visible
- [ ] Submit buttons are accessible
- [ ] Autocomplete works properly

---

## Implementation Checklist

### Phase 1: Layout & Responsiveness (Week 1, Days 1-3)

- [ ] Audit all pages for mobile layout issues
- [ ] Implement mobile-first CSS for all components
- [ ] Add responsive grid layouts
- [ ] Optimize recipe card grid (1/2/3/4 columns)
- [ ] Update recipe detail page layout
- [ ] Implement responsive navigation
- [ ] Add hamburger menu (mobile)
- [ ] Create mobile-friendly forms
- [ ] Ensure modals work on mobile

### Phase 2: Touch & Interaction (Week 1, Days 4-5)

- [ ] Audit touch target sizes
- [ ] Increase button sizes to 44x44px minimum
- [ ] Add proper spacing between interactive elements
- [ ] Implement touch feedback (active states)
- [ ] Add swipe gestures for image galleries
- [ ] Prevent accidental touches
- [ ] Add pull-to-refresh (if applicable)

### Phase 3: Performance (Week 2, Days 1-2)

- [ ] Optimize images (Next.js Image, WebP)
- [ ] Implement lazy loading for images
- [ ] Add code splitting for heavy components
- [ ] Optimize fonts (preload, subset)
- [ ] Reduce bundle size to < 200KB
- [ ] Add loading skeletons
- [ ] Run Lighthouse audits (target 90+)
- [ ] Test on 3G network throttling

### Phase 4: Polish & Testing (Week 2, Days 3-5)

- [ ] Add safe area insets for iOS
- [ ] Implement dark mode optimization
- [ ] Add offline indicators
- [ ] Create mobile-friendly error states
- [ ] Test on real devices (iOS, Android)
- [ ] Test all screen sizes (320px - 768px)
- [ ] Fix any mobile-specific bugs
- [ ] Final Lighthouse audit

---

## Success Metrics

### Quantitative Metrics

- ✅ **Lighthouse Mobile Score**: 90+ (target: 95+)
- ✅ **First Contentful Paint**: < 1.5s on 3G
- ✅ **Time to Interactive**: < 3s on 3G
- ✅ **Cumulative Layout Shift**: < 0.1
- ✅ **Bundle Size**: < 200KB (gzipped)
- ✅ **All touch targets**: ≥ 44x44px
- ✅ **Mobile traffic retention**: Match or exceed desktop

### Qualitative Metrics

- ✅ All pages render correctly on mobile (320px+)
- ✅ No horizontal scrolling on any page
- ✅ Touch interactions feel smooth and responsive
- ✅ Images load efficiently and progressively
- ✅ Forms are easy to complete on mobile
- ✅ Navigation is intuitive on small screens
- ✅ Text is readable without zooming
- ✅ No mobile-specific bugs in production

### User Acceptance Criteria

- ✅ Users can browse recipes on mobile without frustration
- ✅ Users can search and filter recipes easily
- ✅ Users can view recipe details clearly
- ✅ Users can create and edit recipes on mobile
- ✅ Users can navigate the app with one hand (thumb-zone)
- ✅ Users don't encounter layout issues or bugs

---

## Implementation Notes

### Priority Order

1. **Week 1**: Layout & responsiveness (foundation)
2. **Week 1**: Touch optimization (usability)
3. **Week 2**: Performance (speed)
4. **Week 2**: Polish & testing (quality)

### Common Pitfalls to Avoid

❌ **Don't**: Use fixed widths (e.g., `w-[400px]`)
✅ **Do**: Use responsive widths (e.g., `w-full md:w-1/2`)

❌ **Don't**: Forget about touch target sizes
✅ **Do**: Ensure all buttons are ≥ 44x44px

❌ **Don't**: Load full-size images on mobile
✅ **Do**: Use Next.js Image with proper sizes

❌ **Don't**: Hide content on mobile without alternatives
✅ **Do**: Adapt content for smaller screens

❌ **Don't**: Test only on desktop Chrome DevTools
✅ **Do**: Test on real mobile devices

### Resources

- [Next.js Image Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/images)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Apple Human Interface Guidelines (Touch)](https://developer.apple.com/design/human-interface-guidelines/touch)
- [Material Design Touch Targets](https://m3.material.io/foundations/interaction/input-controls/touch-targets)
- [Web.dev Mobile Performance](https://web.dev/mobile/)
- [Lighthouse Scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring/)

---

## Next Steps

After completing mobile parity (Version 0.45.0):
- **Version 0.5.0**: Smart Features (ingredients, search)
- **Version 0.8.0**: PWA features (offline, install)
- **Version 1.0**: Production release

Mobile parity is the **foundation** for all future mobile enhancements.

---

**Last Updated**: October 15, 2025
**Version**: 0.45.0
**Status**: PLANNED
