# Recipe Card Layout Standard

**Version**: 1.0
**Date**: 2025-10-18
**Component**: `RecipeCard.tsx`

---

## Standard Card Structure

All recipe cards follow this exact structure from top to bottom:

```
┌─────────────────────────────────────┐
│                                     │
│         IMAGE (4:3 aspect)          │ ← Fixed height
│         [Favorite button]           │   [Badges overlay]
│                                     │
├─────────────────────────────────────┤
│ [Easy] [Italian] [+ 5 more]         │ ← Tags row (compact)
├─────────────────────────────────────┤
│ Recipe Title Here That Can          │ ← 2 lines max
│ Span Up To Two Lines                │   (line-clamp-2)
├─────────────────────────────────────┤
│ Description text that can span      │ ← 3 lines max
│ up to three lines with ellipsis     │   (line-clamp-3)
│ if needed for longer text...        │
├─────────────────────────────────────┤
│ ⏱ 45 min  👥 4 servings             │ ← Time & servings
├─────────────────────────────────────┤
│                                     │
│ [Flexible space - grows to fill]   │ ← Auto-fill space
│                                     │
├─────────────────────────────────────┤
│ 👨‍🍳 Italian                          │ ← Bottom-aligned
├─────────────────────────────────────┤   (mt-auto)
│ ❤ 12  🔀 5  📁 8                    │ ← Engagement
└─────────────────────────────────────┘
```

---

## Element Details

### 1. Image Section
```typescript
<div className="aspect-[4/3] relative overflow-hidden rounded-t-jk bg-jk-sage/10">
  <Image src={...} fill className="object-cover" />

  {/* Overlays */}
  <FavoriteButton /> {/* Top left */}
  <Badge>AI Generated</Badge> {/* Top right */}
  <Badge>3 images</Badge> {/* Bottom left */}
</div>
```

**Key Properties**:
- Fixed aspect ratio: 4:3
- Responsive image loading
- Hover effect: scale-105
- Overlays positioned absolutely

---

### 2. Tags Row
```typescript
<div className="flex flex-wrap gap-1.5 mb-3">
  {/* Primary tags: Difficulty + Cuisine */}
  <Badge variant="outline">Easy</Badge>
  <Badge variant="outline">Italian</Badge>

  {/* Expand button if more tags */}
  <Button size="sm" onClick={toggleExpand}>
    + 5 more
  </Button>
</div>

{/* Expanded tags (conditional) */}
{showAllTags && (
  <div className="flex flex-wrap gap-1.5 mb-3">
    <Badge variant="secondary">Main Course</Badge>
    <Badge variant="secondary">Pasta</Badge>
    {/* ... */}
  </div>
)}
```

**Key Properties**:
- Primary tags always visible (Difficulty, Cuisine)
- Expandable "+ X more" button for other tags
- Expanded tags appear below (no layout shift)
- Gap: 1.5 (6px spacing)

---

### 3. Title
```typescript
<h3 className="text-lg md:text-xl font-heading text-jk-olive
               group-hover:text-jk-clay transition-colors
               line-clamp-2 leading-snug mb-2">
  {recipe.name}
</h3>
```

**Key Properties**:
- Fixed height: 2 lines maximum (`line-clamp-2`)
- Font: heading family
- Size: responsive (lg → xl)
- Hover: color transition
- Line height: snug (ensures alignment)

---

### 4. Description
```typescript
<p className="text-sm md:text-base font-body text-jk-charcoal/70
              line-clamp-3 leading-relaxed mb-4">
  {recipe.description}
</p>
```

**Key Properties**:
- Fixed height: 3 lines maximum (`line-clamp-3`)
- Font: body family
- Size: responsive (sm → base)
- Line height: relaxed
- Margin bottom: 4 (16px)

---

### 5. Time & Servings
```typescript
<div className="flex items-center gap-3 md:gap-4
                text-xs md:text-sm text-jk-charcoal/60 font-ui mb-3">
  <div className="flex items-center gap-1">
    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-jk-clay" />
    <span>45 min</span>
  </div>
  <div className="flex items-center gap-1">
    <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-jk-clay" />
    <span>4 servings</span>
  </div>
</div>
```

**Key Properties**:
- Responsive icon size: 3.5 → 4
- Responsive text size: xs → sm
- Horizontal layout with gap
- Conditional rendering (only if data exists)

---

### 6. Cuisine (Bottom-aligned)
```typescript
<div className="flex items-center gap-1.5
                text-sm md:text-base text-jk-charcoal/60 font-ui
                mt-auto">
  <ChefHat className="w-4 h-4 text-jk-clay flex-shrink-0" />
  <span>{recipe.cuisine}</span>
</div>
```

**Key Properties**:
- **`mt-auto`** - Critical for bottom alignment
- ChefHat icon: fixed 4x4 size
- Text size: responsive (sm → base)
- Flex-shrink-0 on icon (prevents squishing)

---

### 7. Engagement Metrics
```typescript
<div className="flex items-center gap-3 text-xs text-muted-foreground
                mt-2 pt-2 border-t border-jk-sage/20">
  <span className="flex items-center gap-1" title="Likes">
    <Heart className="w-3 h-3" />
    {recipe.like_count || 0}
  </span>
  <span className="flex items-center gap-1" title="Forks">
    <GitFork className="w-3 h-3" />
    {recipe.fork_count || 0}
  </span>
  <span className="flex items-center gap-1" title="Collections">
    <Bookmark className="w-3 h-3" />
    {recipe.collection_count || 0}
  </span>
</div>
```

**Key Properties**:
- Border top separator
- Small icons: 3x3
- Tooltips via title attribute
- Always visible (shows 0 if no data)

---

## Flex Layout Structure

The entire card uses a flex column layout to ensure proper alignment:

```typescript
<Card className="flex flex-col h-full">
  <CardContent className="flex flex-col flex-1 p-0">

    {/* Image - no flex */}
    <div className="aspect-[4/3]">...</div>

    {/* Content container - flex-1 to fill space */}
    <div className="flex flex-col flex-1 p-4">

      {/* Top elements - normal flow */}
      <div>{tags}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div>{time & servings}</div>

      {/* Cuisine - pushes to bottom with mt-auto */}
      <div className="mt-auto">{cuisine}</div>

      {/* Engagement - below cuisine */}
      <div>{engagement}</div>

    </div>
  </CardContent>
</Card>
```

**Critical Classes**:
1. `h-full` on Card - Fill grid cell height
2. `flex flex-col` on Card - Column layout
3. `flex-1` on CardContent - Grow to fill space
4. `flex flex-col flex-1` on content div - Column layout + grow
5. `mt-auto` on cuisine - Push to bottom

---

## Responsive Breakpoints

### Mobile (< 640px)
```css
text-lg → text-lg
text-sm → text-sm
w-3.5 h-3.5 → w-3.5 h-3.5
gap-3 → gap-3
```

### Desktop (>= 768px)
```css
text-lg → text-xl
text-sm → text-base
w-3.5 h-3.5 → w-4 h-4
gap-3 → gap-4
```

---

## Grid Configurations

### 3-Column Grid (Standard)
```typescript
<div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  <RecipeCard recipe={recipe} />
</div>
```

**Used on**:
- Chef pages (`/chef/[slug]`)
- Recipe list (`/recipes`)
- Discover page (`/discover`)

### 4-Column Grid (Top-50)
```typescript
<div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  <RecipeCard recipe={recipe} showRank={index + 1} />
</div>
```

**Used on**:
- Top-50 page (`/recipes/top-50`)

---

## Special Props

### showRank (optional)
Displays a rank badge in top-left corner.

```typescript
<RecipeCard recipe={recipe} showRank={1} />
```

Renders:
```typescript
<div className="absolute -top-3 -left-3 z-10
                bg-jk-tomato text-white rounded-full
                w-10 h-10 flex items-center justify-center
                font-bold shadow-lg">
  1
</div>
```

### showSimilarity (optional)
Displays similarity percentage badge in bottom-right corner.

```typescript
<RecipeCard recipe={recipe} showSimilarity={true} similarity={0.85} />
```

Renders:
```typescript
<Badge className="absolute bottom-2 right-2
                  bg-jk-tomato/90 text-white">
  85% match
</Badge>
```

### fromChefSlug (optional)
Adds back navigation parameter to recipe URL.

```typescript
<RecipeCard recipe={recipe} fromChefSlug="gordon-ramsay" />
```

Generates URL: `/recipes/beef-wellington?from=chef/gordon-ramsay`

---

## Alignment Requirements

### Horizontal Alignment
All elements are left-aligned within the card padding (p-4).

### Vertical Alignment
Critical vertical alignment points:

1. **Image tops** - Naturally aligned via `aspect-[4/3]`
2. **Tag row** - Fixed position below image
3. **Title baseline** - Aligned via `line-clamp-2` + `leading-snug`
4. **Description** - Aligned via `line-clamp-3` + `leading-relaxed`
5. **Cuisine bottoms** - Aligned via `mt-auto` (KEY!)

**The `mt-auto` on cuisine is critical** - it ensures cuisine always sits at the same position from the bottom, regardless of content length above it.

---

## Color Scheme

### Text Colors
- **Title**: `text-jk-olive` → `hover:text-jk-clay`
- **Description**: `text-jk-charcoal/70`
- **Metadata**: `text-jk-charcoal/60`
- **Engagement**: `text-muted-foreground`

### Icon Colors
- **Primary icons** (Clock, Users, ChefHat): `text-jk-clay`
- **Engagement icons**: inherits text color

### Background Colors
- **Card**: default white
- **Image placeholder**: `bg-jk-sage/10`
- **Borders**: `border-jk-sage`, `border-jk-sage/20`

---

## Animation & Interaction

### Hover States
```typescript
// Card hover
className="hover:shadow-xl md:hover:-translate-y-1 transition-all duration-200"

// Image hover
className="group-hover:scale-105 transition-transform duration-200"

// Title hover
className="group-hover:text-jk-clay transition-colors"
```

### Click States
```typescript
// Active (mobile)
className="active:scale-[0.98] tap-feedback"
```

### Tag Expansion
```typescript
const [showAllTags, setShowAllTags] = useState(false);

onClick={(e) => {
  e.preventDefault();
  e.stopPropagation();
  setShowAllTags(!showAllTags);
}}
```

---

## Accessibility

### ARIA Labels
```typescript
// Card link
aria-label={`View recipe: ${recipe.name}`}

// Top-rated badge
aria-label="Top rated recipe"
title="Top rated recipe (4.5+ stars)"

// Engagement metrics
title="Likes" | title="Forks" | title="Collections"
```

### Keyboard Navigation
- Card is wrapped in `<Link>` for keyboard navigation
- Tag expand button is keyboard accessible
- Favorite button is keyboard accessible

### Screen Reader Support
- Semantic HTML: `<h3>` for title, `<p>` for description
- Alt text on images
- ARIA labels on icon-only buttons

---

## Testing Checklist

### Visual Testing
- [ ] All card elements present in correct order
- [ ] Cuisine aligned at bottom across grid
- [ ] Titles aligned across grid (same baseline)
- [ ] Descriptions aligned (same height)
- [ ] Image aspect ratio consistent
- [ ] Tags display correctly with expand button
- [ ] Rank badge appears correctly (Top-50 only)

### Responsive Testing
- [ ] Mobile (< 640px): 1-column grid, smaller text
- [ ] Tablet (640-1023px): 2-column grid
- [ ] Desktop (1024-1279px): 3-column grid
- [ ] XL (>= 1280px): 4-column grid on Top-50

### Interaction Testing
- [ ] Hover effects work (shadow, scale, color)
- [ ] Click navigates to recipe page
- [ ] Tag expand/collapse works
- [ ] Favorite button works (stops propagation)
- [ ] Mobile tap feedback works

### Content Testing
- [ ] Long titles truncate at 2 lines
- [ ] Long descriptions truncate at 3 lines
- [ ] Missing data handled gracefully
- [ ] Multiple images badge shows correctly
- [ ] AI generated badge shows when applicable

---

## Maintenance Notes

### Do Not Modify
- **Fixed heights**: `line-clamp-2`, `line-clamp-3` are critical for alignment
- **`mt-auto`**: Required for bottom-aligned cuisine
- **Aspect ratio**: `aspect-[4/3]` ensures consistent card tops
- **Flex structure**: Changing flex classes breaks alignment

### Safe to Modify
- Colors (as long as contrast is maintained)
- Icon sizes (but keep responsive scaling)
- Gap sizes (but test alignment)
- Animation durations
- Border widths

### When Adding New Elements
1. Consider where it fits in the vertical structure
2. Add fixed height if it needs to align across cards
3. Test in both 3-column and 4-column grids
4. Verify responsive behavior
5. Check bottom alignment of cuisine still works

---

## References

- **Component**: `/src/components/recipe/RecipeCard.tsx`
- **Implementation Summary**: `/RECIPE_CARD_STANDARDIZATION_SUMMARY.md`
- **Tag System**: `/src/lib/tags/` and `/src/lib/tag-ontology.ts`
- **Design System**: Joanie's Kitchen design tokens

---

**Last Updated**: 2025-10-18
**Maintained By**: Recipe Manager Team
