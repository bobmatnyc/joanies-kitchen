# Chef Profile Images Implementation Guide

This guide covers the chef profile image system in Joanie's Kitchen, including the reusable ChefAvatar component, image management, and best practices.

## Overview

The chef profile image system provides:
- **Reusable ChefAvatar Component**: Consistent avatar display across all views
- **Multiple Size Variants**: sm, md, lg, xl for different contexts
- **Fallback Behavior**: Displays initials when no image available
- **Verified Badges**: Blue checkmark for verified chefs
- **Brand Consistency**: Uses Joanie's Kitchen color palette

## Architecture

### Components

1. **ChefAvatar Component** (`src/components/chef/ChefAvatar.tsx`)
   - Reusable avatar component with size variants
   - Handles image display with Next.js Image optimization
   - Fallback to chef initials
   - Optional verified badge

2. **ChefCard Component** (`src/components/chef/ChefCard.tsx`)
   - Uses ChefAvatar with `md` size
   - Displays chef info in card format
   - Used in chef listings and discovery

3. **Chef Profile Page** (`src/app/chef/[slug]/page.tsx`)
   - Uses ChefAvatar with `xl` size
   - Hero section with profile image
   - Full chef information display

### Database Schema

Chef profile images are stored in the `chefs` table:

```typescript
chefs: {
  id: uuid
  slug: text (unique)
  name: text
  display_name: text
  profile_image_url: text  // ← Profile image URL
  bio: text
  is_verified: boolean
  // ... other fields
}
```

## ChefAvatar Component

### Props

```typescript
interface ChefAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';  // Default: 'md'
  imageUrl?: string | null;
  name: string;
  verified?: boolean | null;
  className?: string;
}
```

### Size Variants

| Size | Dimensions | Use Case | Example |
|------|-----------|----------|---------|
| `sm` | 32x32px | Inline mentions, compact lists | Recipe attribution |
| `md` | 64x64px | Chef cards, list items | Chef discovery grid |
| `lg` | 100x100px | Profile headers | Chef profile sidebar |
| `xl` | 160-200px | Profile heroes | Chef profile page header |

### Usage Examples

#### Basic Usage

```tsx
import { ChefAvatar } from '@/components/chef/ChefAvatar';

// Simple avatar
<ChefAvatar
  size="md"
  imageUrl="/chef-images/joanie.png"
  name="Joanie"
/>

// With verified badge
<ChefAvatar
  size="lg"
  imageUrl="/chef-images/kenji-lopez-alt.png"
  name="Kenji López-Alt"
  verified={true}
/>

// Fallback to initials (no image)
<ChefAvatar
  size="md"
  imageUrl={null}
  name="Gordon Ramsay"
/>
```

#### In Chef Cards

```tsx
// In ChefCard.tsx
<ChefAvatar
  size="md"
  imageUrl={chef.profileImageUrl}
  name={chef.name}
  verified={chef.isVerified}
  className="flex-shrink-0"
/>
```

#### In Profile Pages

```tsx
// In chef/[slug]/page.tsx
<ChefAvatar
  size="xl"
  imageUrl={chef.profile_image_url}
  name={chef.name}
  verified={chef.is_verified}
  className="flex-shrink-0"
/>
```

## Image Management

### Directory Structure

```
public/
├── joanie-portrait.png       # Joanie's profile image (primary)
└── chef-images/             # Chef profile images directory
    ├── README.md            # Image guidelines
    ├── kenji-lopez-alt.png  # Example chef image
    └── [chef-slug].png      # Additional chef images
```

### Image Requirements

- **Format**: PNG or WebP
- **Size**: 400x400px (minimum 200x200px)
- **Aspect Ratio**: Square (1:1)
- **File Size**: < 500KB
- **Naming**: `[chef-slug].png` (matches database slug)

### Adding New Chef Images

#### Step 1: Prepare Image

```bash
# Crop to square (using ImageMagick)
convert input.jpg -gravity center -crop 1:1 output.jpg

# Resize to 400x400px
convert input.jpg -resize 400x400 output.png

# Optimize file size
pngquant --quality=80-95 output.png
```

#### Step 2: Add to Directory

```bash
cp path/to/image.png public/chef-images/chef-slug.png
```

#### Step 3: Update Script

Edit `scripts/add-chef-images.ts`:

```typescript
const CHEF_IMAGES: ChefImageMapping[] = [
  {
    slug: 'chef-slug',
    imageUrl: '/chef-images/chef-slug.png',
    source: 'Source URL or description',
    license: 'License type'
  }
];
```

#### Step 4: Run Update Script

```bash
pnpm tsx scripts/add-chef-images.ts
```

## Scripts

### 1. Create Joanie Chef Profile

Creates Joanie's chef profile with her portrait image.

```bash
pnpm tsx scripts/create-joanie-chef.ts
```

**What it does**:
- Creates chef entry for Joanie
- Sets profile image to `/joanie-portrait.png`
- Adds bio, specialties, social links
- Sets verified and active flags

**Output**:
```
🍳 Creating Joanie chef profile...
✅ Joanie chef profile created successfully!

Profile Details:
═══════════════════════════════════════════════════
ID:              [uuid]
Slug:            joanie
Name:            Joanie
Display Name:    Joanie from Joanie's Kitchen
Bio:             Trained chef, lifelong gardener, and volunteer firefighter...
Profile Image:   /joanie-portrait.png
Specialties:     seasonal, garden-to-table, improvisation
Verified:        ✓
Active:          ✓
Instagram:       https://www.instagram.com/terracesonward/
═══════════════════════════════════════════════════

🌐 View profile at: http://localhost:3004/chef/joanie
```

### 2. Add Chef Images

Updates existing chef profiles with profile images.

```bash
pnpm tsx scripts/add-chef-images.ts
```

**What it does**:
- Creates `/public/chef-images/` directory if needed
- Validates image files exist
- Updates chef profiles with image URLs
- Reports success/failure for each update

**Output**:
```
📸 Adding chef profile images...

Processing: kenji-lopez-alt
──────────────────────────────────────────────────
✅ Updated: J. Kenji López-Alt
   Image: /chef-images/kenji-lopez-alt.png
   Source: Serious Eats / Public profile photo
   License: Fair use - publicly available profile photo

═══════════════════════════════════════════════════
Summary:
  Updated: 1
  Skipped: 0
  Failed:  0
  Total:   1
═══════════════════════════════════════════════════
```

## Styling

### Brand Colors

The ChefAvatar component uses Joanie's Kitchen brand colors:

- **Avatar Border**: `jk-sage` (sage green)
- **Fallback Background**: `jk-olive` (olive green)
- **Fallback Text**: White
- **Verified Badge**: Blue (#3B82F6)

### CSS Classes

```tsx
// Avatar container
className={cn(
  'relative rounded-full overflow-hidden',
  'bg-jk-olive border-jk-sage shadow-md',
  'transition-transform hover:scale-105'
)}

// Initials fallback
className="w-full h-full flex items-center justify-center bg-jk-olive"
<span className="font-heading text-white font-bold">J</span>

// Verified badge
className="absolute rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-white"
```

### Responsive Design

ChefAvatar automatically adapts to screen size:

```typescript
// xl size: Responsive dimensions
container: 'w-32 h-32 md:w-40 md:h-40'
text: 'text-5xl md:text-6xl'

// Profile page: Center on mobile, left on desktop
<div className="flex flex-col md:flex-row items-center md:items-start gap-6">
  <ChefAvatar size="xl" ... />
  <div className="text-center md:text-left">...</div>
</div>
```

## Image Licensing

### Guidelines

**Always verify**:
- ✅ You have permission to use the image
- ✅ License allows commercial use
- ✅ Proper attribution provided (if required)
- ✅ Image is not watermarked

**Acceptable sources**:
- Direct permission from chef
- Creative Commons (CC0, CC-BY, CC-BY-SA)
- Public domain images
- Fair use (publicly available profile photos)

**Unacceptable sources**:
- ❌ Scraped images without permission
- ❌ Copyrighted professional photos
- ❌ Social media images (without permission)
- ❌ Watermarked images

### Documentation

For every image, document in `scripts/add-chef-images.ts`:

```typescript
{
  slug: 'chef-slug',
  imageUrl: '/chef-images/chef-slug.png',
  source: 'Where the image came from',
  license: 'License type or usage rights'
}
```

## Performance Optimization

### Next.js Image Optimization

ChefAvatar uses Next.js Image component for automatic optimization:

```tsx
<Image
  src={imageUrl}
  alt={name}
  fill
  className="object-cover"
  sizes={size === 'xl' ? '160px' : size === 'lg' ? '96px' :
         size === 'md' ? '64px' : '32px'}
  priority={size === 'xl'}  // Priority for hero images
/>
```

**Benefits**:
- Lazy loading (except `priority` images)
- Responsive image sizes
- WebP format conversion
- Automatic caching

### Image Size Guidelines

| Size | Dimensions | File Size Target |
|------|-----------|------------------|
| sm | 32x32px | < 10KB |
| md | 64x64px | < 30KB |
| lg | 100x100px | < 50KB |
| xl | 200x200px | < 100KB |

Original image at 400x400px should be < 500KB. Next.js will generate optimized versions.

## Fallback Behavior

When `imageUrl` is `null` or image fails to load:

1. **Display Initial**: First letter of chef's name
2. **Background**: Brand olive color (`jk-olive`)
3. **Text**: White, bold, heading font
4. **Border**: Brand sage color (`jk-sage`)

```tsx
{imageUrl ? (
  <Image src={imageUrl} ... />
) : (
  <div className="w-full h-full flex items-center justify-center bg-jk-olive">
    <span className={cn(sizes.text, 'font-heading text-white font-bold')}>
      {name.charAt(0).toUpperCase()}
    </span>
  </div>
)}
```

## Testing

### Manual Testing Checklist

- [ ] ChefAvatar displays correctly at all sizes (sm, md, lg, xl)
- [ ] Image loads and displays properly
- [ ] Fallback to initials works when no image
- [ ] Verified badge appears for verified chefs
- [ ] Hover effect (scale 1.05) works
- [ ] Responsive design: mobile vs desktop
- [ ] Image optimization: WebP conversion, lazy loading

### Test Scenarios

1. **With Image**:
   - Visit chef profile with image
   - Verify image loads and displays correctly
   - Check verified badge appears if chef is verified

2. **Without Image**:
   - Visit chef profile without image
   - Verify initial displays correctly
   - Check fallback styling matches brand

3. **Responsive**:
   - Test on mobile device (< 768px)
   - Test on tablet (768px - 1024px)
   - Test on desktop (> 1024px)
   - Verify avatar sizes adjust appropriately

## Troubleshooting

### Image Not Displaying

**Symptom**: Avatar shows initials even though image URL is set

**Solutions**:
1. Verify image file exists at specified path
2. Check file permissions (should be readable)
3. Ensure image URL starts with `/` (absolute path)
4. Check browser console for 404 errors

### Image Quality Issues

**Symptom**: Image appears blurry or pixelated

**Solutions**:
1. Ensure source image is at least 400x400px
2. Use PNG format for better quality
3. Avoid over-compression (use quality 80-95)
4. Check Next.js Image optimization settings

### Verified Badge Not Showing

**Symptom**: Blue checkmark doesn't appear for verified chefs

**Solutions**:
1. Verify `is_verified` is `true` in database
2. Check `verified` prop is passed to ChefAvatar
3. Ensure badge styling is not hidden by z-index issues

## Future Enhancements

Potential improvements to consider:

1. **Image Upload**: Allow chefs to upload their own images
2. **Image Moderation**: Admin approval for uploaded images
3. **Multiple Images**: Gallery of chef photos
4. **Avatar Customization**: Let users choose avatar style
5. **Social Media Sync**: Auto-import from social profiles

## References

- **Component**: `src/components/chef/ChefAvatar.tsx`
- **Chef Card**: `src/components/chef/ChefCard.tsx`
- **Profile Page**: `src/app/chef/[slug]/page.tsx`
- **Schema**: `src/lib/db/chef-schema.ts`
- **Scripts**: `scripts/create-joanie-chef.ts`, `scripts/add-chef-images.ts`
- **Image Guidelines**: `public/chef-images/README.md`
