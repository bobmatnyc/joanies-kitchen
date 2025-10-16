# Mobile Development Guide

**Joanie's Kitchen - Mobile-First Development Standards**

Version: 0.45.0
Last Updated: 2025-10-16

---

## Overview

This guide establishes mobile-first development practices for Joanie's Kitchen. With 60-70% of users accessing the app on mobile devices, mobile optimization is a **critical priority**.

## Mobile-First Approach

**Philosophy**: Design and build for mobile first, then enhance for larger screens.

### Why Mobile-First?

1. **User Base**: 60-70% of users are on mobile devices
2. **Performance**: Mobile-first forces performance optimization
3. **Progressive Enhancement**: Easier to scale up than scale down
4. **Touch-First**: Natural touch interactions baked in from the start

---

## Breakpoints

Joanie's Kitchen uses the following responsive breakpoints:

| Breakpoint | Size | Device Type | Usage |
|------------|------|-------------|-------|
| `xs` | 320px | Extra small phones (iPhone SE) | Tightest layouts |
| `sm` | 640px | Small phones landscape | Mobile landscape |
| `md` | 768px | Tablets (iPad) | Tablet portrait |
| `lg` | 1024px | Small desktops / Tablet landscape | Desktop start |
| `xl` | 1280px | Large desktops | Wide layouts |
| `2xl` | 1536px | Extra large desktops | Maximum width |

### Breakpoint Usage in Code

```tsx
// Tailwind CSS classes
<div className="text-sm md:text-base lg:text-lg">
  Responsive text size
</div>

// JavaScript detection
import { useBreakpoint } from '@/hooks/useMobileDetect';

const isTablet = useBreakpoint('md');
const isDesktop = useBreakpoint('lg');
```

---

## Touch Targets

**Critical Rule**: All interactive elements MUST meet minimum touch target sizes.

### Standards

- **iOS Minimum**: 44x44px (Apple Human Interface Guidelines)
- **Material Design**: 48x48px (recommended)
- **Spacing**: Minimum 8px between touch targets

### Implementation

```tsx
// Use TouchTarget component
import { TouchTarget } from '@/components/mobile';

<TouchTarget onClick={handleClick}>
  <Icon />
</TouchTarget>

// Or use CSS classes
<button className="touch-target">
  Click Me
</button>

// For Material Design size
<button className="touch-target-material">
  Click Me
</button>
```

### Button Best Practices

```tsx
// ✅ GOOD - Full width on mobile, auto on desktop
<Link href="/recipes" className="w-full sm:w-auto">
  <Button className="w-full sm:w-auto touch-target">
    View Recipes
  </Button>
</Link>

// ❌ BAD - Too small on mobile
<button className="px-2 py-1 text-xs">
  Tiny Button
</button>
```

---

## Mobile Components

### MobileContainer

Responsive container with consistent padding and max-width.

```tsx
import { MobileContainer } from '@/components/mobile';

<MobileContainer maxWidth="xl">
  <YourContent />
</MobileContainer>

// Props
interface MobileContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}
```

**Features**:
- Responsive padding: `px-4 sm:px-6 md:px-8`
- Centered with auto margins
- Customizable max-width

### MobileSpacer

Responsive vertical spacing component.

```tsx
import { MobileSpacer } from '@/components/mobile';

<MobileSpacer size="md" />

// Sizes
- xs: 2/3 spacing (mobile/desktop)
- sm: 4/6 spacing
- md: 6/8 spacing (default)
- lg: 8/12 spacing
- xl: 12/16 spacing
- 2xl: 16/24 spacing
```

### TouchTarget

Touch-optimized interactive button.

```tsx
import { TouchTarget } from '@/components/mobile';

<TouchTarget onClick={handleClick} variant="ghost" size="large">
  <Icon />
</TouchTarget>

// Variants
- default: Active opacity feedback
- ghost: Background color feedback
- minimal: Scale feedback

// Sizes
- default: 44px minimum (iOS)
- large: 48px minimum (Material Design)
```

---

## Responsive Hooks

### useMobileDetect

Detect viewport size and device type.

```tsx
import { useMobileDetect } from '@/hooks/useMobileDetect';

function MyComponent() {
  const { isMobile, isTablet, isDesktop, width, height } = useMobileDetect();

  if (isMobile) {
    return <MobileView />;
  }

  return <DesktopView />;
}
```

### useBreakpoint

Check specific breakpoint match.

```tsx
import { useBreakpoint } from '@/hooks/useMobileDetect';

const isLargeScreen = useBreakpoint('lg');
```

### useOrientation

Detect device orientation.

```tsx
import { useOrientation } from '@/hooks/useMobileDetect';

const { isPortrait, isLandscape } = useOrientation();
```

### useTouchDevice

Detect touch capability.

```tsx
import { useTouchDevice } from '@/hooks/useMobileDetect';

const hasTouch = useTouchDevice();
```

---

## Mobile Utilities

Located in `src/lib/mobile-utils.ts`:

```tsx
import {
  isMobileDevice,
  isIOS,
  isAndroid,
  hasTouchScreen,
  getSafeAreaInsets,
  isMobileViewport,
  isTabletViewport,
  isDesktopViewport,
} from '@/lib/mobile-utils';

// Device detection
if (isMobileDevice()) {
  // Mobile-specific code
}

// Platform-specific
if (isIOS()) {
  // iOS-specific handling
}

// Safe area insets (notched devices)
const insets = getSafeAreaInsets();
console.log(insets.top, insets.bottom);
```

---

## Safe Area Insets

Handle notched devices (iPhone X+, etc.) properly.

### CSS Utilities

```tsx
// Individual insets
<div className="safe-top safe-bottom">
  Content
</div>

// Horizontal insets
<div className="safe-x">
  Content
</div>

// Vertical insets
<div className="safe-y">
  Content
</div>
```

### Auto-Applied

Safe area insets are automatically applied to:
- `<body>` - Top and bottom padding
- `<header>` - Left and right padding
- `<footer>` - Left, right, and bottom padding

---

## Typography

### Mobile Typography Rules

1. **Prevent iOS Zoom**: All inputs must be minimum 16px font-size
2. **Responsive Sizing**: Use responsive text classes
3. **Line Height**: Ensure readable line-height (1.5 minimum)

### Examples

```tsx
// ✅ GOOD - Responsive heading
<h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
  Joanie's Kitchen
</h1>

// ✅ GOOD - Responsive body text
<p className="text-base md:text-lg">
  Description text
</p>

// ❌ BAD - Too small on mobile
<input className="text-xs" />

// ✅ GOOD - Prevents zoom
<input className="text-base" />
```

---

## Layout Patterns

### Hero Section

```tsx
<section className="py-12 md:py-20">
  <MobileContainer maxWidth="xl" className="text-center">
    <h1 className="text-4xl sm:text-5xl md:text-6xl">
      Hero Title
    </h1>
    <p className="text-base md:text-lg">
      Hero description
    </p>
    <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
      <Link href="/action" className="w-full sm:w-auto">
        <Button className="w-full sm:w-auto touch-target">
          CTA Button
        </Button>
      </Link>
    </div>
  </MobileContainer>
</section>
```

### Grid Layouts

```tsx
// ✅ Mobile-first grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
  {items.map(item => (
    <ItemCard key={item.id} item={item} />
  ))}
</div>
```

### Content Sections

```tsx
<MobileContainer>
  <section className="mt-12 md:mt-16">
    <h2 className="text-3xl md:text-4xl mb-6 md:mb-8">
      Section Title
    </h2>
    <MobileSpacer size="md" />
    <Content />
  </section>
</MobileContainer>
```

---

## Touch Interactions

### Tap Feedback

```tsx
// Use tap-feedback class for visual feedback
<div className="tap-feedback">
  Interactive Element
</div>

// Or use active: pseudo-class
<button className="active:scale-95 transition-transform">
  Button
</button>
```

### Prevent Text Selection

```tsx
// Use no-select class on UI elements
<div className="no-select">
  UI Chrome (not selectable)
</div>
```

### Hover States

**Critical**: Hover states don't work on touch devices!

```tsx
// ✅ GOOD - Disabled hover on touch devices
<Card className="md:hover:shadow-lg active:scale-[0.98]">
  Content
</Card>

// Use media query for hover-capable devices
@media (hover: hover) and (pointer: fine) {
  .element:hover {
    /* Desktop hover styles */
  }
}
```

---

## Performance Optimization

### Image Optimization

```tsx
import Image from 'next/image';

// ✅ GOOD - Responsive images
<Image
  src={recipe.image}
  alt={recipe.name}
  width={800}
  height={600}
  loading="lazy"
  className="w-full h-auto"
/>
```

### Lazy Loading

```tsx
// Use loading="lazy" for images
<img src={url} loading="lazy" decoding="async" />

// Use React.lazy() for components
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

### Reduce Bundle Size

- Use dynamic imports for mobile-heavy features
- Implement code splitting at route level
- Minimize third-party dependencies

---

## Testing on Mobile

### Required Test Devices

Test on these viewport sizes (Chrome DevTools):

1. **iPhone SE** (375x667) - Small phone
2. **iPhone 14 Pro** (393x852) - Modern phone with notch
3. **iPad** (768x1024) - Tablet portrait
4. **iPad Landscape** (1024x768) - Tablet landscape

### Testing Checklist

- [ ] Touch targets are minimum 44x44px
- [ ] No horizontal scroll on any viewport
- [ ] Text is readable (minimum 16px inputs)
- [ ] Buttons are full-width on mobile when appropriate
- [ ] Images load properly and are responsive
- [ ] Safe area insets work on notched devices
- [ ] Tap feedback is visible on interactive elements
- [ ] No hover-dependent interactions

### Chrome DevTools

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device preset or custom size
4. Test touch events (enable touch emulation)

---

## Common Patterns

### Full-Width Mobile Buttons

```tsx
<Link href="/action" className="w-full sm:w-auto">
  <Button className="w-full sm:w-auto">
    Action
  </Button>
</Link>
```

### Responsive Spacing

```tsx
// Margins
<div className="mt-8 md:mt-12">

// Padding
<div className="p-4 md:p-6 lg:p-8">

// Gaps
<div className="flex gap-3 md:gap-4 lg:gap-6">
```

### Conditional Rendering

```tsx
const { isMobile } = useMobileDetect();

return (
  <>
    {isMobile ? <MobileNav /> : <DesktopNav />}
  </>
);
```

---

## Accessibility

### Touch Accessibility

1. **Minimum size**: 44x44px touch targets
2. **Spacing**: 8px minimum between targets
3. **Labels**: All interactive elements must have accessible labels
4. **Focus states**: Visible focus indicators

### ARIA Labels

```tsx
<button aria-label="Close dialog">
  <X className="w-4 h-4" />
</button>

<Link href="/recipe" aria-label={`View recipe: ${recipe.name}`}>
  <RecipeCard recipe={recipe} />
</Link>
```

---

## Common Pitfalls

### ❌ Don't

```tsx
// Too small touch targets
<button className="p-1 text-xs">×</button>

// Relies on hover
<div className="hover:bg-gray-100">
  Only visible on hover
</div>

// Fixed widths that break on mobile
<div className="w-[500px]">
  Fixed width content
</div>

// Tiny fonts on inputs (causes zoom)
<input className="text-xs" />
```

### ✅ Do

```tsx
// Proper touch targets
<TouchTarget onClick={handleClose}>
  <X className="w-5 h-5" />
</TouchTarget>

// Active states for mobile
<div className="active:bg-gray-100 md:hover:bg-gray-100">
  Touch-friendly
</div>

// Responsive widths
<div className="w-full max-w-2xl">
  Responsive content
</div>

// Proper input sizing
<input className="text-base" />
```

---

## Mobile Navigation

### Recommendations

1. **Hamburger Menu**: Use for >5 navigation items on mobile
2. **Bottom Tab Bar**: Consider for primary navigation
3. **Sticky Headers**: Keep important actions accessible
4. **Back Buttons**: Always provide clear navigation back

### Example Mobile Nav

```tsx
// TODO: Implement mobile navigation component
// See Phase 2 of Mobile Parity roadmap
```

---

## PWA Features

### Manifest Configuration

Already configured in `src/app/layout.tsx`:

- Viewport settings for notched devices
- Apple Web App capable
- Theme color
- Icons for home screen

### Future Enhancements

- Offline support (Service Worker)
- Install prompt
- Push notifications
- Background sync

---

## Resources

### Internal Documentation

- `CLAUDE.md` - Project overview and architecture
- `docs/reference/PROJECT_ORGANIZATION.md` - File structure
- `docs/guides/ENVIRONMENT_SETUP.md` - Environment setup

### External Resources

- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Touch Targets](https://material.io/design/usability/accessibility.html)
- [MDN Touch Events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events)
- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)

---

## Roadmap

### Phase 1: Foundation ✅ COMPLETE

- [x] Mobile-first CSS utilities
- [x] Viewport meta tags
- [x] Mobile components (MobileContainer, MobileSpacer, TouchTarget)
- [x] Mobile hooks (useMobileDetect, etc.)
- [x] Mobile utilities (mobile-utils.ts)
- [x] Updated homepage with mobile optimizations
- [x] Updated RecipeCard with mobile layout

### Phase 2: Navigation & UX (Next)

- [ ] Mobile navigation menu (hamburger)
- [ ] Bottom tab bar for primary actions
- [ ] Swipe gestures for image galleries
- [ ] Pull-to-refresh functionality
- [ ] Mobile-optimized forms

### Phase 3: Performance

- [ ] Image lazy loading improvements
- [ ] Route-based code splitting
- [ ] Mobile-specific bundle optimization
- [ ] Service Worker for offline support

### Phase 4: Advanced Features

- [ ] Install prompt for PWA
- [ ] Haptic feedback (vibration API)
- [ ] Share API integration
- [ ] Camera integration for recipe photos

---

## Support

For questions or issues related to mobile development:

1. Check this guide first
2. Review existing mobile components in `src/components/mobile/`
3. Test on actual devices when possible
4. Consider mobile-first in all new features

---

**Last Updated**: 2025-10-16
**Version**: 0.45.0 - Phase 1 Complete
**Next Phase**: Mobile Navigation & UX
