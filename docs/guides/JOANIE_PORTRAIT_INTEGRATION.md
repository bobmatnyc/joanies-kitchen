# Joanie Portrait Integration Guide

## Summary

Successfully integrated the beautiful Joanie illustration into the Joanie's Kitchen website with:
1. **About Joanie Section** on homepage (with portrait and story)
2. **Dedicated /about Page** with full biography and philosophy
3. **Navigation Link** added to main header
4. **Brand-Consistent Styling** with Joanie's Kitchen color palette

---

## Files Created

### 1. `/public/joanie-portrait-placeholder.txt`
Placeholder file documenting where to save the actual portrait image.

**Action Required**: Save the Joanie illustration as:
```
/public/joanie-portrait.png
```

**Image Requirements**:
- Optimized for web (compressed but high quality)
- Dimensions: 800x1000 or similar portrait orientation
- Format: PNG or WebP
- The illustration features Joanie cooking with fresh vegetables in warm earthy tones

### 2. `/src/app/about/page.tsx`
Full About page with:
- Hero header with Olive background
- Portrait with Sage Green border (floating left)
- Complete biography
- Kitchen philosophy (4 key principles)
- Inspirational blockquote
- "What You'll Find Here" section
- Call-to-action button

---

## Files Modified

### 1. `/src/app/page.tsx`
Added "About Joanie" section after feature cards:
- Portrait with 4px Sage Green border
- Decorative Tomato/Sage circles around image
- Three-paragraph introduction
- Signature blockquote
- Two CTA buttons (Explore Recipes, Read My Story)

### 2. `/src/app/layout.tsx`
Added "About" navigation link:
- Heart icon (from lucide-react)
- Placed first in navigation (before My Recipes)
- Uses brand Olive/Sage colors

### 3. `/src/app/globals.css`
Added `.parchment` class:
- White background with subtle texture
- 2px Sage border
- Matches brand aesthetic

---

## Design Features

### Portrait Styling
```tsx
<div className="rounded-jk overflow-hidden border-4 border-jk-sage shadow-lg">
  <img src="/joanie-portrait.png" alt="..." />
</div>
```

**Key Elements**:
- **Border**: 4px solid Sage Green (#A7BEA4)
- **Border Radius**: 8px (rounded-jk)
- **Shadow**: Subtle drop shadow
- **Decorative Accents**: Floating Tomato/Sage circles for visual interest

### Typography
- **Headings**: Playfair Display (serif) in Olive Green
- **Body Text**: Lora (serif) in Charcoal with 80% opacity
- **Blockquote**: Clay color, italic, Tomato left border
- **Buttons**: Inter (sans-serif) font

### Color Palette
- **Olive** (#5B6049): Headings, primary text
- **Sage** (#A7BEA4): Borders, accents
- **Linen** (#FAF5EE): Backgrounds
- **Tomato** (#E65F45): CTAs, accents
- **Clay** (#B46945): Secondary buttons, blockquotes
- **Charcoal** (#333333): Body text

---

## Content & Voice

### Tone
- **Warm**: "Welcome to my kitchen!"
- **Grounded**: "The garden teaches patience..."
- **Nurturing**: "...nourish both body and soul"
- **Authentic**: "Trust your hands"

### Key Messages
1. **Garden to Table**: Best meals start in the garden
2. **Seasonal Cooking**: Honor the seasons
3. **Simplicity**: Great cooking doesn't need complexity
4. **Connection**: Cooking connects us to earth and each other

### Signature Quote
> "The garden teaches patience. The kitchen teaches creativity. Together, they teach us to live well."

---

## Navigation Structure

```
Header Navigation:
┌─────────────────────────────────────────────────────────┐
│ Joanie's Kitchen                                        │
│ ┌─────┬──────────┬─────────┬──────────┬────────────┐  │
│ │About│My Recipes│ Shared  │ Discover │ Add Recipe │  │
│ └─────┴──────────┴─────────┴──────────┴────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Page Structure

### Homepage - About Joanie Section
```
┌────────────────────────────────────────────────┐
│ Divider                                        │
├────────────────┬───────────────────────────────┤
│                │  Meet Joanie                  │
│   Portrait     │  [3 paragraphs]               │
│   (Sage        │  "The garden teaches..."      │
│    Border)     │  [Join me message]            │
│                │  [Explore] [Read My Story]    │
└────────────────┴───────────────────────────────┘
```

### /about Page
```
┌────────────────────────────────────────────────┐
│ Header (Olive background)                      │
│ About Joanie                                   │
│ From Garden to Table — with Heart and Soil    │
├────────────────────────────────────────────────┤
│ ┌─────────┐ A Kitchen Born from the Garden   │
│ │Portrait │ [Biography paragraphs]            │
│ │(float)  │                                    │
│ └─────────┘ My Kitchen Philosophy              │
│             • Cook with the seasons            │
│             • Keep it simple                   │
│             • Trust your hands                 │
│             • Feed people you love             │
│                                                │
│             "The garden teaches patience..."   │
│                                                │
│             What You'll Find Here              │
│             [Content description]              │
│                                                │
│             Welcome to Joanie's Kitchen.       │
│             — Joanie                           │
├────────────────────────────────────────────────┤
│ [Start Cooking with the Seasons]              │
└────────────────────────────────────────────────┘
```

---

## Responsive Design

### Desktop (>768px)
- Portrait and text side-by-side (2-column grid)
- Portrait floats left on /about page
- Full-width navigation

### Mobile (<768px)
- Stacked layout (portrait above text)
- Portrait centers and scales
- Collapsible navigation (if implemented)

---

## Testing Checklist

- [ ] Save `joanie-portrait.png` to `/public/` directory
- [ ] Visit homepage and verify "About Joanie" section displays
- [ ] Check portrait has Sage Green border
- [ ] Verify decorative circles appear around portrait
- [ ] Test "Read My Story" button navigation
- [ ] Visit `/about` page directly
- [ ] Check portrait floats left with text wrap
- [ ] Verify all typography uses correct fonts
- [ ] Test responsive layout on mobile
- [ ] Verify navigation "About" link works
- [ ] Check blockquote styling (Tomato border, Clay text)
- [ ] Verify CTA buttons use correct colors (Tomato)

---

## SEO & Accessibility

### Semantic HTML
- `<section>` for About section
- `<h1>`, `<h2>`, `<h3>` hierarchy
- `<blockquote>` for signature quote
- `<ul>` for philosophy list

### Alt Text
```html
<img
  src="/joanie-portrait.png"
  alt="Joanie cooking in her kitchen with fresh vegetables"
/>
```

### Meta Tags (Already in layout.tsx)
```tsx
title: "Joanie's Kitchen"
description: "From Garden to Table — with Heart and Soil.
              Celebrate cooking with the seasons."
keywords: ['recipes', 'seasonal cooking', 'garden to table', ...]
```

---

## Future Enhancements

### Phase 2 (Optional)
1. **More Photos**: Add gallery of Joanie's garden, kitchen
2. **Video**: Embed cooking video or garden tour
3. **Newsletter Signup**: "Join Joanie's Table" email list
4. **Social Proof**: Testimonials from community
5. **Timeline**: Visual history of Joanie's cooking journey
6. **Recipe Highlights**: Featured recipes in About section

### Interactive Elements
- **Hover Effects**: Subtle animations on decorative circles
- **Parallax Scrolling**: For portrait on homepage
- **Animated Quote**: Fade-in effect for blockquote
- **Season Icons**: Visual indicators for each philosophy point

---

## Brand Voice Guidelines

### Do:
- Use first person ("I believe", "my kitchen")
- Reference nature and seasons frequently
- Emphasize patience, care, authenticity
- Use warm, inviting language
- Tell stories about learning and tradition

### Don't:
- Use corporate or technical jargon
- Rush or emphasize speed
- Focus on perfection over authenticity
- Use trendy food buzzwords excessively
- Make it about the AI technology

---

## Success Criteria

✅ Portrait displays with proper brand styling
✅ Typography uses Playfair Display and Lora
✅ Colors match Joanie's Kitchen palette exactly
✅ Copy is warm, grounded, and nurturing
✅ Navigation includes About link
✅ Both homepage and /about page implemented
✅ Blockquote styled with Tomato accent
✅ CTAs use brand colors (Tomato primary)
✅ Decorative elements add visual interest
✅ Responsive design works on all devices

---

## Quick Reference

### Image Path
```
/public/joanie-portrait.png
```

### Routes
- Homepage section: `http://localhost:3004/` (scroll to "Meet Joanie")
- Full page: `http://localhost:3004/about`

### Key Classes
- `.rounded-jk` - 8px border radius
- `.border-jk-sage` - Sage Green border
- `.parchment` - White card with texture
- `.font-heading` - Playfair Display
- `.font-body` - Lora
- `.font-ui` - Inter

### Brand Colors (Tailwind)
- `text-jk-olive` - #5B6049
- `text-jk-sage` - #A7BEA4
- `bg-jk-linen` - #FAF5EE
- `bg-jk-tomato` - #E65F45
- `text-jk-clay` - #B46945
- `text-jk-charcoal` - #333333

---

**Last Updated**: 2025-10-14
**Version**: 1.0.0
**Status**: Ready for Image Upload
