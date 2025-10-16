# Logo & Favicon Quick Reference

## Files Created/Updated

### New Logo Files
```
/public/joanies-kitchen-logo.png  # Main logo (1024x1024)
/public/icon.png                  # 32x32 favicon
/public/icon-192.png              # 192x192 PWA
/public/icon-512.png              # 512x512 PWA
/public/apple-touch-icon.png      # 180x180 iOS
/public/manifest.json             # PWA manifest
```

### Updated Source Files
```
/src/app/layout.tsx               # Metadata + header logo
/src/app/page.tsx                 # Hero logo
/src/app/global-error.tsx         # Fixed <html>/<body>
/tsconfig.json                    # Excluded scripts
/scripts/generate-favicons.ts     # New favicon generator
```

### Deleted Files
```
/public/joanies-logo.svg          # Old SVG logo
/public/icon.svg                  # Old favicon
```

## Logo Usage

### In Code
```tsx
import Image from 'next/image';

// Header/Navigation (48x48)
<Image
  src="/joanies-kitchen-logo.png"
  alt="Joanie's Kitchen"
  width={48}
  height={48}
  priority
  className="h-12 w-12 object-contain"
/>

// Hero/Large Display (120x120)
<Image
  src="/joanies-kitchen-logo.png"
  alt="Joanie's Kitchen Logo"
  width={120}
  height={120}
  priority
  className="h-28 w-28 object-contain"
/>
```

## Favicon Management

### Regenerate All Favicons
```bash
npx tsx scripts/generate-favicons.ts
```

### Manual Regeneration (if needed)
```typescript
// Using Sharp directly
import sharp from 'sharp';

await sharp('public/joanies-kitchen-logo.png')
  .resize(32, 32)
  .png()
  .toFile('public/icon.png');
```

## PWA Manifest

### Location
`/public/manifest.json`

### Key Properties
- **Name**: Joanie's Kitchen - Recipe Manager
- **Short Name**: Joanie's Kitchen
- **Theme**: `#5B6049` (Deep Olive)
- **Background**: `#FAF5EE` (Linen)
- **Icons**: 32, 192, 512, 180 (iOS)

### App Shortcuts
1. Add Recipe → `/recipes/new`
2. My Recipes → `/recipes`
3. Discover → `/discover`

## Quick Commands

```bash
# Development
pnpm dev                          # Start dev server (port 3004)

# Favicon regeneration
npx tsx scripts/generate-favicons.ts

# View all logo files
ls -lh public/*.png | grep -E "icon|logo|apple"

# Check manifest
cat public/manifest.json | jq .
```

## Testing

### Browser Favicon
1. Open http://localhost:3004
2. Check browser tab for favicon
3. Verify in multiple browsers

### PWA Installation
1. iOS: Safari → Share → Add to Home Screen
2. Android: Chrome → Menu → Add to Home Screen
3. Desktop: Chrome → Install App button

### Image Loading
```bash
# Check dev console for:
- No 404 errors on icon files
- Next.js image optimization working
- Priority images load first
```

## Troubleshooting

### Favicon Not Updating
```bash
# Clear browser cache
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

# Clear Next.js cache
rm -rf .next
pnpm dev
```

### Logo Not Displaying
1. Check file exists: `ls public/joanies-kitchen-logo.png`
2. Check Next.js config allows images
3. Verify Image component import
4. Check browser console for errors

### PWA Manifest Errors
```bash
# Validate manifest
curl http://localhost:3004/manifest.json | jq .

# Check in browser DevTools:
# Application tab → Manifest
```

## Documentation

- **Full Guide**: `/docs/guides/LOGO_UPDATE_SUMMARY.md`
- **Project Docs**: `/CLAUDE.md`
- **Organization**: `/docs/reference/PROJECT_ORGANIZATION.md`

---

**Quick Start**: Run `pnpm dev` and visit http://localhost:3004 to see changes!
