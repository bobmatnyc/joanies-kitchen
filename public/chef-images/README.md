# Chef Profile Images

This directory contains profile images for chef profiles in Joanie's Kitchen.

## Image Guidelines

### Requirements

- **Format**: PNG or WebP preferred
- **Size**: Minimum 200x200px, ideal 400x400px
- **Aspect Ratio**: Square (1:1)
- **Quality**: High resolution, professional quality
- **File Size**: Optimized for web (< 500KB per image)

### Naming Convention

Images should be named using the chef's slug:
- `[chef-slug].png` (e.g., `kenji-lopez-alt.png`)
- Use lowercase with hyphens for spaces
- Match the chef's slug in the database exactly

### Adding New Chef Images

1. **Prepare the Image**:
   - Crop to square aspect ratio
   - Resize to at least 400x400px
   - Optimize for web (use tools like TinyPNG, Squoosh, or ImageOptim)
   - Save as PNG or WebP

2. **Add to Directory**:
   ```bash
   cp path/to/image.png public/chef-images/chef-slug.png
   ```

3. **Update Database**:
   - Add entry to `scripts/add-chef-images.ts`
   - Include source and license information
   - Run the script: `pnpm tsx scripts/add-chef-images.ts`

### Example

```typescript
// In scripts/add-chef-images.ts
const CHEF_IMAGES: ChefImageMapping[] = [
  {
    slug: 'kenji-lopez-alt',
    imageUrl: '/chef-images/kenji-lopez-alt.png',
    source: 'Serious Eats / Public profile photo',
    license: 'Fair use - publicly available profile photo'
  }
];
```

## Image Rights & Licensing

### Important Legal Considerations

When adding chef profile images, you MUST verify:
- ✅ You have permission to use the image
- ✅ The image license allows commercial use
- ✅ Proper attribution is provided (if required)
- ✅ The image is not watermarked or copyrighted

### Acceptable Sources

1. **Direct Permission**: Images provided directly by the chef
2. **Creative Commons**: CC0, CC-BY, CC-BY-SA licenses
3. **Public Domain**: Verified public domain images
4. **Fair Use**: Publicly available profile photos (with proper attribution)

### Unacceptable Sources

- ❌ Images scraped from websites without permission
- ❌ Copyrighted photos from professional photographers
- ❌ Social media images (unless explicitly permitted)
- ❌ Watermarked images

### Documentation Requirements

For every image added, document:
- **Source**: Where the image came from
- **License**: License type or usage rights
- **Attribution**: Credit requirements (if any)
- **Date Added**: When the image was added

## Existing Images

### Joanie (Primary Chef)
- **File**: `joanie-portrait.png` (in `/public/`)
- **Size**: 400x400px
- **License**: Original content
- **Notes**: Primary chef profile for Joanie's Kitchen

### Kenji López-Alt
- **File**: `kenji-lopez-alt.png`
- **Source**: Publicly available profile photo
- **License**: Fair use
- **Notes**: Placeholder - replace with properly licensed image

## Optimization Tips

### Before Adding Images

1. **Crop to Square**:
   ```bash
   # Using ImageMagick
   convert input.jpg -gravity center -crop 1:1 output.jpg
   ```

2. **Resize to Target Size**:
   ```bash
   # Using ImageMagick
   convert input.jpg -resize 400x400 output.png
   ```

3. **Optimize File Size**:
   ```bash
   # Using pngquant
   pngquant --quality=80-95 input.png
   ```

### Recommended Tools

- **Online**: [Squoosh](https://squoosh.app/), [TinyPNG](https://tinypng.com/)
- **CLI**: ImageMagick, pngquant, cwebp
- **Desktop**: ImageOptim (macOS), GIMP, Photoshop

## Fallback Behavior

If a chef profile image is not available:
- The ChefAvatar component will display the chef's initial
- Background color: Brand olive green (`jk-olive`)
- Text color: White
- Border: Brand sage green (`jk-sage`)

This ensures a consistent user experience even without profile images.

## Next.js Image Optimization

All chef images are automatically optimized by Next.js:
- Lazy loading by default
- Responsive image sizes
- WebP format conversion (when supported)
- Automatic caching

No manual optimization needed beyond initial file preparation.

## Questions?

If you're unsure about image rights or licensing, contact the project maintainer before adding images.
