# Chef Avatar System

## Directory Structure

```
public/chefs/
├── avatars/           # Chef profile avatars
│   ├── kenji-alt.jpg
│   ├── madhur-jaffrey.jpg
│   ├── jacques-pepin.jpg
│   └── ...
└── README.md          # This file
```

## Naming Convention

**Format**: `{chef-name-slug}.jpg`

**Rules**:
- All lowercase
- Hyphens separate name parts
- Use full name or common professional name
- File extension: `.jpg` or `.webp` (prefer WebP for better compression)

**Examples**:
- Kenji López-Alt → `kenji-alt.jpg`
- Madhur Jaffrey → `madhur-jaffrey.jpg`
- Jacques Pépin → `jacques-pepin.jpg`
- Nigella Lawson → `nigella-lawson.jpg`
- Alton Brown → `alton-brown.jpg`
- Samin Nosrat → `samin-nosrat.jpg`
- Yotam Ottolenghi → `yotam-ottolenghi.jpg`
- Lidia Bastianich → `lidia-bastianich.jpg`
- Nancy Silverton → `nancy-silverton.jpg`

## Image Specifications

### Required Specifications
- **Dimensions**: 512x512px (1:1 aspect ratio)
- **Format**: JPEG or WebP
- **File Size**: Target <100KB per image
- **Quality**: 80-85% JPEG quality or equivalent WebP

### Optimization Guidelines
1. **Resize**: All images to 512x512px
2. **Crop**: Center-crop faces for consistent framing
3. **Compress**: Use ImageOptim, Squoosh, or sharp
4. **Format**: WebP preferred for 25-35% smaller file sizes

### Optimization Commands

#### Using ImageMagick
```bash
# Resize and optimize JPEG
convert input.jpg -resize 512x512^ -gravity center -extent 512x512 -quality 85 output.jpg

# Convert to WebP
convert input.jpg -resize 512x512^ -gravity center -extent 512x512 -quality 85 output.webp
```

#### Using sharp (Node.js)
```javascript
const sharp = require('sharp');

await sharp('input.jpg')
  .resize(512, 512, { fit: 'cover' })
  .jpeg({ quality: 85 })
  .toFile('output.jpg');

// Or WebP
await sharp('input.jpg')
  .resize(512, 512, { fit: 'cover' })
  .webp({ quality: 85 })
  .toFile('output.webp');
```

## Usage in Code

### Static Path Reference
```typescript
// In components
const avatarUrl = `/chefs/avatars/${chefSlug}.jpg`;

// Example
<img
  src="/chefs/avatars/kenji-alt.jpg"
  alt="Kenji López-Alt"
  width={512}
  height={512}
/>
```

### Next.js Image Component
```tsx
import Image from 'next/image';

<Image
  src="/chefs/avatars/kenji-alt.jpg"
  alt="Kenji López-Alt"
  width={512}
  height={512}
  className="rounded-full"
/>
```

### Database Integration
```typescript
// In chef profiles table
{
  id: 'uuid',
  name: 'Kenji López-Alt',
  slug: 'kenji-alt',
  avatarUrl: '/chefs/avatars/kenji-alt.jpg',
  // ... other fields
}
```

## Adding New Chef Avatars

1. **Source Image**: Obtain high-quality image (minimum 512x512px)
2. **Create Slug**: Convert name to slug format (e.g., "Gordon Ramsay" → "gordon-ramsay")
3. **Optimize**: Resize to 512x512px, compress to <100KB
4. **Name File**: Save as `{slug}.jpg` or `{slug}.webp`
5. **Place File**: Save to `public/chefs/avatars/`
6. **Update Database**: Add chef profile entry with avatarUrl path

## Current Chef Avatars

| Chef Name          | Slug              | File Name              |
|--------------------|-------------------|------------------------|
| Kenji López-Alt    | kenji-alt         | kenji-alt.jpg          |
| Madhur Jaffrey     | madhur-jaffrey    | madhur-jaffrey.jpg     |
| Jacques Pépin      | jacques-pepin     | jacques-pepin.jpg      |
| Nigella Lawson     | nigella-lawson    | nigella-lawson.jpg     |
| Alton Brown        | alton-brown       | alton-brown.jpg        |
| Samin Nosrat       | samin-nosrat      | samin-nosrat.jpg       |
| Yotam Ottolenghi   | yotam-ottolenghi  | yotam-ottolenghi.jpg   |
| Lidia Bastianich   | lidia-bastianich  | lidia-bastianich.jpg   |
| Nancy Silverton    | nancy-silverton   | nancy-silverton.jpg    |

## Fallback/Placeholder

If a chef avatar is not available, use a placeholder:

```typescript
// Fallback avatar generation
const getChefAvatar = (chefSlug: string) => {
  const avatarPath = `/chefs/avatars/${chefSlug}.jpg`;
  const fallback = `/chefs/avatars/default.jpg`; // or generate initials

  return avatarPath; // Handle 404 in Image component with fallback
};
```

## Image Attribution

All chef avatar images should have proper attribution and usage rights:
- Personal use: Public domain or properly licensed images
- Commercial use: Ensure appropriate licensing
- Attribution: Maintain source information in version control

## Performance Considerations

1. **Lazy Loading**: Use `loading="lazy"` for images below fold
2. **Preload**: Preload critical chef avatars (featured on homepage)
3. **CDN**: Consider CDN for image delivery in production
4. **WebP Support**: Provide JPEG fallback for older browsers

```tsx
<picture>
  <source srcSet="/chefs/avatars/kenji-alt.webp" type="image/webp" />
  <img src="/chefs/avatars/kenji-alt.jpg" alt="Kenji López-Alt" />
</picture>
```

## Security & Privacy

- Only use publicly available images with appropriate rights
- Verify image sources and licensing
- Respect chef's public image preferences
- Do not use images without permission for commercial purposes

---

**Last Updated**: 2025-10-17
**Maintained By**: Recipe Manager Team
