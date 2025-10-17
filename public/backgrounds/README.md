# Hero Background Images

This directory contains background images for the homepage hero section.

## Auto-Discovery System

Images placed in this directory are **automatically discovered** and displayed in the hero background slideshow. No code changes needed!

## Supported Formats

- `.jpg` / `.jpeg`
- `.png`
- `.webp`

## How to Add New Images

1. Place any image file (JPG, PNG, or WEBP) in this directory
2. Images will automatically appear in the slideshow
3. Images cycle in alphabetical order by filename

## Naming Convention (Optional)

For better organization, consider using numbered prefixes:

```
01-textured.png
02-watercolor.png
03-portrait.png
04-garden.jpg
```

This ensures a predictable display order.

## Image Specifications

- **Recommended Size**: 1920x1080 or larger (16:9 aspect ratio)
- **Opacity**: Images display at 15% opacity over the olive green background
- **Display Duration**: 6 seconds per image
- **Transition**: 2-second smooth crossfade between images

## Current Images

- `01-textured.png` - Textured illustration background
- `02-watercolor.png` - Watercolor illustration background
- `03-portrait.png` - Portrait-style background

## Technical Details

- Images are served via Next.js Image Optimization
- Server-side discovery on each page load (fast filesystem read)
- No database or build-time configuration needed
- Images are lazy-loaded (except first image which is prioritized)

## Performance

- Images are automatically optimized by Next.js
- Quality set to 85 for balance between quality and file size
- Responsive srcsets generated automatically
- First image prioritized for LCP (Largest Contentful Paint)
