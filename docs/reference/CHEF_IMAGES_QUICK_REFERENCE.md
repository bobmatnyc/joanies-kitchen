# Chef Profile Images - Quick Reference

**Quick guide for working with chef profile images in Joanie's Kitchen.**

## Quick Start

### Add a New Chef with Image

1. Add image to `/public/chef-images/[chef-slug].png`
2. Update `scripts/add-chef-images.ts` with image mapping
3. Run: `pnpm tsx scripts/add-chef-images.ts`

### Use ChefAvatar Component

```tsx
import { ChefAvatar } from '@/components/chef/ChefAvatar';

<ChefAvatar
  size="md"                    // sm | md | lg | xl
  imageUrl="/chef-images/chef.png"
  name="Chef Name"
  verified={true}              // Optional
/>
```

## Size Reference

| Size | Dimensions | Use Case |
|------|-----------|----------|
| `sm` | 32x32px | Inline mentions |
| `md` | 64x64px | Chef cards |
| `lg` | 100x100px | Profile headers |
| `xl` | 160-200px | Hero images |

## Image Specs

- **Format**: PNG or WebP
- **Size**: 400x400px (min 200x200px)
- **Aspect**: Square (1:1)
- **Max File Size**: < 500KB
- **Naming**: `[chef-slug].png`

## Scripts

### Create Joanie Profile
```bash
pnpm tsx scripts/create-joanie-chef.ts
```

### Update Chef Images
```bash
pnpm tsx scripts/add-chef-images.ts
```

## File Locations

- **Component**: `src/components/chef/ChefAvatar.tsx`
- **Images**: `public/chef-images/`
- **Joanie**: `public/joanie-portrait.png`
- **Scripts**: `scripts/create-joanie-chef.ts`, `scripts/add-chef-images.ts`

## Fallback Behavior

No image? ChefAvatar shows:
- Chef's first initial
- Brand olive background
- White text
- Sage border

## Verified Badge

Set `verified={true}` to show blue checkmark badge.

## Common Issues

**Image not showing?**
- Check file exists at path
- Verify URL starts with `/`
- Check browser console for 404

**Blurry image?**
- Ensure source is 400x400px
- Use PNG format
- Don't over-compress

## Full Documentation

See: `docs/guides/CHEF_PROFILE_IMAGES.md`
