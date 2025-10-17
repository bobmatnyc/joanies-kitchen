# Recipe Placeholder Image System

## Overview

The Recipe Manager uses a themed placeholder image system to provide visually appealing placeholders for recipes without images. Instead of a generic placeholder, recipes are assigned themed placeholders based on their tags and categories.

## Features

- **12 Themed Placeholders**: Covering common recipe categories
- **SVG Format**: Lightweight, scalable, and web-optimized (1.3KB - 2.9KB per file)
- **Intelligent Matching**: Automatically selects appropriate placeholder based on recipe tags
- **Consistent Design**: All placeholders follow a cohesive visual style
- **Fallback Support**: Generic placeholder for recipes without matching tags

## Available Themes

| Theme | File | Use Case | Example Tags |
|-------|------|----------|--------------|
| Breakfast | `breakfast.svg` | Breakfast dishes | Breakfast, Brunch |
| Lunch/Dinner | `lunch-dinner.svg` | Main dishes | Lunch, Dinner, Main |
| Dessert | `dessert.svg` | Desserts and sweets | Dessert, Cake, Sweet |
| Salad | `salad.svg` | Salads | Salad, Green, Fresh |
| Soup | `soup.svg` | Soups and stews | Soup, Stew, Warm |
| Pasta | `pasta.svg` | Pasta and noodle dishes | Pasta, Noodles, Pizza |
| Meat | `meat.svg` | Meat-based dishes | Beef, Chicken, Pork |
| Seafood | `seafood.svg` | Fish and seafood | Fish, Seafood, Salmon |
| Vegetarian | `vegetarian.svg` | Vegetarian/vegan dishes | Vegan, Vegetarian, Tofu |
| Baked | `baked.svg` | Baked goods | Baked, Bread, Pastry |
| Beverage | `beverage.svg` | Drinks and beverages | Beverage, Drink, Smoothie |
| Generic | `generic.svg` | Default fallback | Any recipe without specific tags |

## How It Works

### Priority Order

The system uses a priority-based matching system:

1. **Course-specific tags** (highest priority)
   - Salad, Soup, Pasta, Pizza, etc.
2. **Meal Type**
   - Breakfast, Lunch, Dinner, Dessert, Beverage
3. **Main Ingredient**
   - Chicken, Beef, Fish, Tofu, Vegetables
4. **Cooking Method**
   - Baked, Grilled, Roasted
5. **Dietary Preferences**
   - Vegan, Vegetarian

### Usage in Components

The placeholder system is automatically integrated into all recipe display components:

```typescript
import { getPlaceholderImage } from '@/lib/utils/recipe-placeholders';

// Get themed placeholder based on tags
const tags = ['Breakfast', 'Quick', 'Easy'];
const imagePath = getPlaceholderImage(tags);
// Returns: '/placeholders/breakfast.svg'

// Use in recipe display
const displayImage = recipe.image_url || getPlaceholderImage(tags);
```

### Updated Components

The following components have been updated to use themed placeholders:

- ✅ `RecipeCard.tsx` - Main recipe card display
- ✅ `MealRecipeCard.tsx` - Meal plan recipe cards
- ✅ `SharedRecipeCard.tsx` - Shared/public recipe cards
- ✅ `SharedRecipeCarousel.tsx` - Recipe carousel display

## File Structure

```
public/
└── placeholders/
    ├── breakfast.svg       # Coffee cup icon
    ├── lunch-dinner.svg    # Plate with fork and knife
    ├── dessert.svg         # Cupcake icon
    ├── salad.svg          # Bowl with greens
    ├── soup.svg           # Bowl with spoon
    ├── pasta.svg          # Pasta with fork
    ├── meat.svg           # Steak with grill marks
    ├── seafood.svg        # Fish icon
    ├── vegetarian.svg     # Vegetables (carrot, broccoli, tomato)
    ├── baked.svg          # Bread loaf
    ├── beverage.svg       # Glass with straw
    └── generic.svg        # Chef hat

src/lib/utils/
└── recipe-placeholders.ts  # Placeholder selection logic
```

## Design Specifications

### Visual Style
- **Format**: SVG (Scalable Vector Graphics)
- **Dimensions**: 800x600px (4:3 aspect ratio)
- **Color Scheme**: Soft gradients with category-appropriate colors
- **Icon Style**: Simple, modern, food-related icons
- **Text Labels**: Category name at bottom for clarity

### Color Palettes

Each placeholder uses a themed color gradient:

- **Breakfast**: Warm yellows/oranges (#FFF8E7 → #FFE4B5)
- **Dessert**: Soft pinks (#FFE4F7 → #FFC0E6)
- **Salad**: Fresh greens (#E8F5E9 → #C8E6C9)
- **Soup**: Warm oranges (#FFF3E0 → #FFE0B2)
- **Meat**: Soft reds (#FFEBEE → #FFCDD2)
- **Seafood**: Ocean blues (#E0F7FA → #B2EBF2)
- **And more...**

## Testing

A test suite is available to verify placeholder selection logic:

```bash
npx tsx scripts/test-placeholder-logic.ts
```

The test suite covers:
- All 12 placeholder themes
- Various tag combinations
- Edge cases (no tags, multiple matching tags)
- Priority order verification

## Benefits

1. **Improved Visual Experience**: No more generic placeholders
2. **Better User Recognition**: Users can quickly identify recipe types
3. **Consistent Branding**: All placeholders follow the same design language
4. **Performance**: SVG files are tiny (1-3KB each) and cache well
5. **Accessibility**: Proper alt text and semantic structure
6. **SEO Friendly**: Clear visual indicators for recipe categories

## Future Enhancements

Potential improvements for the placeholder system:

- [ ] Add more specific themes (e.g., BBQ, Asian, Mexican cuisine)
- [ ] Support for dark mode variants
- [ ] Animated SVG placeholders
- [ ] User-customizable placeholder themes
- [ ] AI-generated placeholder matching

## Maintenance

### Adding New Themes

1. Create SVG file in `public/placeholders/`
2. Add theme to `PlaceholderTheme` type in `recipe-placeholders.ts`
3. Update `THEME_MAPPING` with matching logic
4. Add test case to `test-placeholder-logic.ts`
5. Update this documentation

### Modifying Existing Themes

1. Edit SVG file directly (keep dimensions at 800x600)
2. Test with actual recipes to ensure visibility
3. Verify file size remains optimized (< 5KB)
4. Update screenshots/documentation if needed

## Related Documentation

- [Tag Ontology System](../../src/lib/tag-ontology.ts)
- [Recipe Schema](../../src/lib/db/schema.ts)
- [Component Guide](../reference/COMPONENTS.md)

---

**Last Updated**: 2025-10-17
**Version**: 1.0.0
**Maintained By**: Recipe Manager Team
