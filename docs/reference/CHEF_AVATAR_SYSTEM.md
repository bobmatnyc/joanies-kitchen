# Chef Avatar System Reference

## Overview

The Chef Avatar System provides a standardized way to store, reference, and display chef profile images throughout the Recipe Manager application. This system ensures consistency, performance, and maintainability.

## Architecture

### Storage Location
```
public/chefs/avatars/
```

All chef avatar images are stored in the public directory for direct static file serving by Next.js.

### Access Pattern
```
URL: https://yourdomain.com/chefs/avatars/{chef-slug}.jpg
Local: /chefs/avatars/{chef-slug}.jpg
```

### Database Integration
Chef avatars are referenced in the database through the `chefProfiles` table:

```typescript
// Schema definition (src/lib/db/schema.ts or chef-profiles-schema.ts)
export const chefProfiles = pgTable('chef_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  avatarUrl: text('avatar_url'), // e.g., '/chefs/avatars/kenji-alt.jpg'
  bio: text('bio'),
  website: text('website'),
  socialLinks: jsonb('social_links'), // { twitter, instagram, etc. }
  specialties: jsonb('specialties'), // Array of cuisine types/specialties
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

## File Naming Convention

### Format
```
{chef-name-slug}.{extension}
```

### Rules
1. **Lowercase only**: All characters must be lowercase
2. **Hyphens for spaces**: Use hyphens to separate name parts
3. **ASCII characters**: No special characters (é → e, ñ → n)
4. **Professional name**: Use the name the chef is professionally known by
5. **Extension**: `.jpg` or `.webp` (prefer WebP)

### Examples
| Chef Name          | Slug              | File Name              |
|--------------------|-------------------|------------------------|
| Kenji López-Alt    | kenji-alt         | kenji-alt.jpg          |
| Madhur Jaffrey     | madhur-jaffrey    | madhur-jaffrey.jpg     |
| Jacques Pépin      | jacques-pepin     | jacques-pepin.jpg      |
| Nigella Lawson     | nigella-lawson    | nigella-lawson.jpg     |

## Image Specifications

### Technical Requirements
- **Dimensions**: 512x512px (1:1 aspect ratio)
- **Format**: JPEG (primary) or WebP (preferred)
- **File Size**: Target <100KB (max 150KB)
- **Quality**: JPEG 80-85% or WebP 85%
- **Color Space**: sRGB
- **Resolution**: 72 DPI (web standard)

### Quality Guidelines
- **Clarity**: Sharp, in-focus images
- **Lighting**: Well-lit, evenly exposed
- **Framing**: Face centered, head and shoulders visible
- **Background**: Clean, uncluttered (solid color or subtle blur preferred)
- **Expression**: Professional, welcoming

## Image Optimization

### Using ImageMagick
```bash
# Install ImageMagick
brew install imagemagick

# Optimize JPEG
convert input.jpg \
  -resize 512x512^ \
  -gravity center \
  -extent 512x512 \
  -quality 85 \
  -strip \
  kenji-alt.jpg

# Convert to WebP
convert input.jpg \
  -resize 512x512^ \
  -gravity center \
  -extent 512x512 \
  -quality 85 \
  -strip \
  kenji-alt.webp
```

### Using sharp (Node.js)
```javascript
const sharp = require('sharp');

async function optimizeChefAvatar(inputPath, outputSlug) {
  // JPEG version
  await sharp(inputPath)
    .resize(512, 512, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({
      quality: 85,
      progressive: true,
      mozjpeg: true
    })
    .toFile(`public/chefs/avatars/${outputSlug}.jpg`);

  // WebP version (optional, better compression)
  await sharp(inputPath)
    .resize(512, 512, {
      fit: 'cover',
      position: 'center'
    })
    .webp({
      quality: 85,
      effort: 6 // Higher effort = better compression
    })
    .toFile(`public/chefs/avatars/${outputSlug}.webp`);
}

// Usage
optimizeChefAvatar('downloads/kenji.jpg', 'kenji-alt');
```

### Automation Script
Create `scripts/optimize-chef-avatar.ts`:

```typescript
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

interface OptimizeOptions {
  inputPath: string;
  chefSlug: string;
  format?: 'jpg' | 'webp' | 'both';
  quality?: number;
}

async function optimizeChefAvatar(options: OptimizeOptions) {
  const {
    inputPath,
    chefSlug,
    format = 'both',
    quality = 85
  } = options;

  const outputDir = path.join(process.cwd(), 'public', 'chefs', 'avatars');

  // Ensure directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const image = sharp(inputPath);

  if (format === 'jpg' || format === 'both') {
    await image
      .clone()
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .jpeg({ quality, progressive: true, mozjpeg: true })
      .toFile(path.join(outputDir, `${chefSlug}.jpg`));

    console.log(`✓ Created ${chefSlug}.jpg`);
  }

  if (format === 'webp' || format === 'both') {
    await image
      .clone()
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .webp({ quality, effort: 6 })
      .toFile(path.join(outputDir, `${chefSlug}.webp`));

    console.log(`✓ Created ${chefSlug}.webp`);
  }

  // Get file sizes
  const jpgPath = path.join(outputDir, `${chefSlug}.jpg`);
  const webpPath = path.join(outputDir, `${chefSlug}.webp`);

  try {
    const jpgStats = await fs.stat(jpgPath);
    console.log(`  JPG size: ${(jpgStats.size / 1024).toFixed(2)}KB`);
  } catch {}

  try {
    const webpStats = await fs.stat(webpPath);
    console.log(`  WebP size: ${(webpStats.size / 1024).toFixed(2)}KB`);
  } catch {}
}

// Example usage
if (require.main === module) {
  const [inputPath, chefSlug] = process.argv.slice(2);

  if (!inputPath || !chefSlug) {
    console.error('Usage: tsx scripts/optimize-chef-avatar.ts <input-path> <chef-slug>');
    console.error('Example: tsx scripts/optimize-chef-avatar.ts ~/Downloads/kenji.jpg kenji-alt');
    process.exit(1);
  }

  optimizeChefAvatar({ inputPath, chefSlug })
    .then(() => console.log('\n✓ Avatar optimization complete'))
    .catch(console.error);
}

export { optimizeChefAvatar };
```

## Usage in Components

### Basic Image Tag
```tsx
// Simple image tag
<img
  src={`/chefs/avatars/${chefSlug}.jpg`}
  alt={chefName}
  width={512}
  height={512}
  className="rounded-full"
/>
```

### Next.js Image Component
```tsx
import Image from 'next/image';

function ChefAvatar({ chef }) {
  return (
    <Image
      src={`/chefs/avatars/${chef.slug}.jpg`}
      alt={chef.name}
      width={512}
      height={512}
      className="rounded-full object-cover"
      priority={false} // Set to true for above-fold images
    />
  );
}
```

### Responsive Picture Element (WebP + JPEG Fallback)
```tsx
function ChefAvatarPicture({ chef, size = 'md' }) {
  const sizes = {
    sm: { width: 128, height: 128 },
    md: { width: 256, height: 256 },
    lg: { width: 512, height: 512 },
  };

  const { width, height } = sizes[size];

  return (
    <picture>
      <source
        srcSet={`/chefs/avatars/${chef.slug}.webp`}
        type="image/webp"
      />
      <img
        src={`/chefs/avatars/${chef.slug}.jpg`}
        alt={chef.name}
        width={width}
        height={height}
        className="rounded-full object-cover"
        loading="lazy"
      />
    </picture>
  );
}
```

### Reusable Chef Avatar Component
```tsx
// src/components/chefs/ChefAvatar.tsx
import Image from 'next/image';
import { type ChefProfile } from '@/lib/db/chef-profiles-schema';

interface ChefAvatarProps {
  chef: Pick<ChefProfile, 'name' | 'slug' | 'avatarUrl'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  priority?: boolean;
}

const sizeMap = {
  xs: 64,
  sm: 128,
  md: 256,
  lg: 384,
  xl: 512,
};

export function ChefAvatar({
  chef,
  size = 'md',
  className = '',
  priority = false,
}: ChefAvatarProps) {
  const dimension = sizeMap[size];
  const avatarUrl = chef.avatarUrl || `/chefs/avatars/${chef.slug}.jpg`;

  return (
    <div className={`relative overflow-hidden rounded-full ${className}`}>
      <Image
        src={avatarUrl}
        alt={chef.name}
        width={dimension}
        height={dimension}
        className="object-cover"
        priority={priority}
        onError={(e) => {
          // Fallback to default avatar
          e.currentTarget.src = '/chefs/avatars/default.jpg';
        }}
      />
    </div>
  );
}
```

## Database Queries

### Get Chef with Avatar
```typescript
import { db } from '@/lib/db';
import { chefProfiles } from '@/lib/db/chef-profiles-schema';
import { eq } from 'drizzle-orm';

async function getChefBySlug(slug: string) {
  const chef = await db.query.chefProfiles.findFirst({
    where: eq(chefProfiles.slug, slug),
  });

  return chef;
}

// Usage in component
const chef = await getChefBySlug('kenji-alt');
// chef.avatarUrl => '/chefs/avatars/kenji-alt.jpg'
```

### List All Chefs with Avatars
```typescript
async function getAllChefs() {
  const chefs = await db.select().from(chefProfiles);
  return chefs;
}
```

## Fallback Strategy

### Default Avatar
Create a default avatar for chefs without images:

```bash
# Generate default avatar with initials or icon
# Place at: public/chefs/avatars/default.jpg
```

### Avatar Helper Function
```typescript
// src/lib/utils/chef-avatar.ts
export function getChefAvatarUrl(chef: { slug: string; avatarUrl?: string | null }) {
  return chef.avatarUrl || `/chefs/avatars/${chef.slug}.jpg`;
}

export function getChefAvatarWithFallback(chef: { slug: string; avatarUrl?: string | null }) {
  // Try custom avatarUrl first, then slug-based, then default
  return chef.avatarUrl || `/chefs/avatars/${chef.slug}.jpg` || '/chefs/avatars/default.jpg';
}
```

## Performance Optimization

### Image Loading Strategies
1. **Above the fold**: Use `priority={true}` on Next.js Image
2. **Below the fold**: Use `loading="lazy"`
3. **List views**: Use smaller sizes (128x128 or 256x256)
4. **Detail views**: Use full size (512x512)

### CDN Configuration
For production, configure CDN caching:

```nginx
# Nginx example
location /chefs/avatars/ {
  expires 30d;
  add_header Cache-Control "public, immutable";
}
```

### Next.js Image Optimization
```javascript
// next.config.js
module.exports = {
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [128, 256, 384, 512],
    imageSizes: [64, 128, 256, 512],
  },
};
```

## Adding New Chef Avatars

### Step-by-Step Process

1. **Obtain Image**
   - Source high-quality image (minimum 512x512px)
   - Verify usage rights and licensing

2. **Create Chef Slug**
   ```typescript
   function createChefSlug(name: string): string {
     return name
       .toLowerCase()
       .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
       .replace(/\s+/g, '-')          // Replace spaces with hyphens
       .replace(/-+/g, '-')           // Remove consecutive hyphens
       .trim();
   }

   // Examples:
   // "Kenji López-Alt" => "kenji-lopez-alt"
   // "Jacques Pépin"   => "jacques-pepin"
   ```

3. **Optimize Image**
   ```bash
   # Using the optimization script
   tsx scripts/optimize-chef-avatar.ts ~/Downloads/chef-photo.jpg gordon-ramsay
   ```

4. **Add to Database**
   ```typescript
   await db.insert(chefProfiles).values({
     name: 'Gordon Ramsay',
     slug: 'gordon-ramsay',
     avatarUrl: '/chefs/avatars/gordon-ramsay.jpg',
     bio: 'British chef and television personality...',
     specialties: ['British', 'French', 'Fine Dining'],
   });
   ```

5. **Verify**
   - Check file exists at `public/chefs/avatars/gordon-ramsay.jpg`
   - Verify file size is <100KB
   - Test image loads correctly in browser

## Maintenance

### Periodic Audits
```bash
# Check for orphaned avatar files (no matching database entry)
# Check for missing avatars (database entry but no file)
# Verify file sizes and quality
```

### Cleanup Script
```typescript
// scripts/audit-chef-avatars.ts
import { db } from '@/lib/db';
import { chefProfiles } from '@/lib/db/chef-profiles-schema';
import { promises as fs } from 'fs';
import path from 'path';

async function auditChefAvatars() {
  const avatarsDir = path.join(process.cwd(), 'public', 'chefs', 'avatars');
  const files = await fs.readdir(avatarsDir);
  const chefs = await db.select().from(chefProfiles);

  // Check for orphaned files
  const chefSlugs = new Set(chefs.map(c => c.slug));
  const orphanedFiles = files.filter(file => {
    const slug = file.replace(/\.(jpg|webp)$/, '');
    return !chefSlugs.has(slug) && file !== 'default.jpg';
  });

  // Check for missing files
  const missingAvatars = chefs.filter(chef => {
    const jpgExists = files.includes(`${chef.slug}.jpg`);
    const webpExists = files.includes(`${chef.slug}.webp`);
    return !jpgExists && !webpExists;
  });

  console.log('Orphaned files:', orphanedFiles);
  console.log('Missing avatars:', missingAvatars.map(c => c.slug));
}
```

## Security & Privacy

### Image Rights
- Only use images with proper licensing
- Verify commercial use rights for production
- Maintain attribution records
- Respect chef's public image preferences

### Privacy Considerations
- Use publicly available professional images
- No candid or private photos without permission
- Allow chefs to update/remove their avatars
- Provide opt-out mechanism

### File Security
- Validate file types on upload
- Scan for malicious content
- Set proper file permissions (644)
- Use secure CDN with DDoS protection

## Migration Strategy

If migrating from an existing system:

1. **Export existing avatars**
2. **Standardize naming** using slug format
3. **Optimize images** to meet specifications
4. **Update database** with new paths
5. **Test thoroughly** before production deploy
6. **Keep backups** of original images

## Troubleshooting

### Image Not Loading
```typescript
// Check file exists
const fs = require('fs');
const path = require('path');
const avatarPath = path.join(process.cwd(), 'public', 'chefs', 'avatars', 'kenji-alt.jpg');
console.log('Exists:', fs.existsSync(avatarPath));
```

### File Size Too Large
```bash
# Re-optimize with lower quality
convert input.jpg -resize 512x512^ -gravity center -extent 512x512 -quality 75 output.jpg
```

### Poor Image Quality
- Source higher resolution original
- Adjust crop/framing before resize
- Use higher quality setting (90%)

---

**Last Updated**: 2025-10-17
**Version**: 1.0.0
**Maintained By**: Recipe Manager Team
