# Ingredient Parser Enhancement Guide

## Overview

The Ingredient Parser Enhancement adds intelligent parsing and visual formatting to recipe ingredient lists. It automatically extracts and formats three components from ingredient strings:

- **Amount**: Quantities and units (e.g., "2 cups", "1/2 tsp", "a handful")
- **Ingredient**: The main item name (e.g., "all-purpose flour", "fresh basil")
- **Preparation**: Optional modifiers (e.g., "chopped", "sifted", "minced")

## Component Location

- **Primary Component**: `src/components/recipe/IngredientsList.tsx`
- **Integration**: `src/app/recipes/[id]/page.tsx`

## Features

### 1. Intelligent Parsing

The parser handles a wide variety of ingredient formats:

```
Input: "2 cups all-purpose flour, sifted"
Output:
  - Amount: "2 cups"
  - Ingredient: "all-purpose flour"
  - Preparation: "sifted"

Input: "Salt to taste"
Output:
  - Amount: (none)
  - Ingredient: "Salt"
  - Preparation: "to taste"
```

### 2. Supported Formats

#### Numbers & Fractions
- Whole numbers: `2 cups flour`
- Fractions: `1/2 teaspoon salt`
- Unicode fractions: `½ cup sugar`
- Decimals: `2.5 cups water`
- Ranges: `1-2 tablespoons oil`

#### Text-Based Amounts
- Articles: `a cup`, `an onion`
- Numbers: `one`, `two`, `three`, etc.
- Descriptive: `some`, `few`, `several`

#### Measurement Units
**Volume**: cup, tablespoon (tbsp), teaspoon (tsp), fluid ounce (fl oz), milliliter (ml), liter (l), pint, quart, gallon

**Weight**: pound (lb), ounce (oz), gram (g), kilogram (kg), milligram (mg)

**Other**: piece, slice, clove, stick, can, jar, package, bunch, sprig, pinch, dash, handful

#### Preparation Methods
- Cutting: chopped, diced, minced, sliced, julienned
- Processing: grated, shredded, crushed, mashed, pureed, ground, crumbled
- Cooking: melted, softened, beaten, whipped, whisked
- Other: sifted, divided, separated, peeled, seeded, halved, quartered, cubed
- Qualifiers: optional, to taste, as needed, for garnish, for serving, room temperature

### 3. Visual Formatting

The component applies distinct styling to each part:

- **Amount**: Bold text (`font-semibold`)
- **Ingredient**: Regular weight
- **Preparation**: Italic with muted color
- Consistent spacing and alignment
- Bullet points for visual hierarchy

### 4. Optional Checkboxes

Enable interactive checkboxes for shopping or cooking mode:

```tsx
<IngredientsList
  ingredients={recipe.ingredients}
  showCheckboxes={true}
/>
```

Features:
- Check off items as you shop or cook
- Checked items show strikethrough text
- Accessible with proper ARIA labels
- State managed internally with React hooks

### 5. Graceful Fallback

If parsing fails or no structured data is found, the component falls back to displaying the original string without formatting. This ensures ingredients are always readable.

## Usage Examples

### Basic Usage (Current Implementation)

```tsx
import { IngredientsList } from '@/components/recipe/IngredientsList';

function RecipeDetailPage() {
  const recipe = {
    ingredients: [
      "2 cups all-purpose flour, sifted",
      "1/2 teaspoon salt",
      "3 large eggs",
    ]
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingredients</CardTitle>
      </CardHeader>
      <CardContent>
        <IngredientsList ingredients={recipe.ingredients} />
      </CardContent>
    </Card>
  );
}
```

### With Checkboxes

```tsx
<IngredientsList
  ingredients={recipe.ingredients}
  showCheckboxes={true}
/>
```

### With Custom Styling

```tsx
<IngredientsList
  ingredients={recipe.ingredients}
  className="text-lg space-y-3"
/>
```

### Programmatic Parsing

```tsx
import { parseIngredientString } from '@/components/recipe/IngredientsList';

const parsed = parseIngredientString("2 cups flour, sifted");
console.log(parsed);
// {
//   original: "2 cups flour, sifted",
//   amount: "2 cups",
//   ingredient: "flour",
//   preparation: "sifted"
// }
```

## Component Props

### `IngredientsList`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ingredients` | `string[]` | required | Array of ingredient strings to parse and display |
| `showCheckboxes` | `boolean` | `false` | Show interactive checkboxes for each ingredient |
| `className` | `string` | `''` | Additional CSS classes for the list container |

## Parsing Algorithm

The parser follows a three-step process:

### Step 1: Extract Amount
1. Try to match numeric amount at the start (numbers, fractions, ranges)
2. Check for measurement unit after the number
3. If no numeric match, try text-based amounts (a, one, some, etc.)
4. Handle "of" after units (e.g., "a handful of basil")

### Step 2: Extract Preparation
1. Split by commas and parentheses
2. Check if last part matches a preparation method
3. If found, separate it from the ingredient name

### Step 3: Extract Ingredient
1. What remains after removing amount and preparation is the ingredient name
2. Trim whitespace and return

## Edge Cases Handled

### No Amount Specified
```
Input: "Salt to taste"
Result: No amount, but "to taste" is recognized as preparation
```

### No Preparation
```
Input: "2 cups flour"
Result: Amount and ingredient only
```

### Neither Amount nor Preparation
```
Input: "Butter"
Result: Falls back to showing original string
```

### Complex Formats
```
Input: "1 can (14 oz) crushed tomatoes"
Result: Amount = "1 can", Ingredient = "(14 oz) crushed tomatoes"
Note: Parenthetical content stays with ingredient
```

### Unicode and Special Characters
```
Input: "½ cup sugar"
Result: Handles unicode fractions correctly
```

## Integration Points

### Recipe Detail Page
**File**: `src/app/recipes/[id]/page.tsx`

The component is integrated in the ingredients card section:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Ingredients</CardTitle>
    <CardDescription>Everything you'll need</CardDescription>
  </CardHeader>
  <CardContent>
    <IngredientsList ingredients={recipe.ingredients} />
  </CardContent>
</Card>
```

### Data Structure

No database schema changes required. The component works with existing recipe data:

```typescript
// src/lib/db/schema.ts
export const recipes = pgTable('recipes', {
  // ...
  ingredients: text('ingredients').notNull(), // JSON array of strings
  // ...
});
```

Ingredients are stored as JSON arrays of strings:
```json
[
  "2 cups all-purpose flour, sifted",
  "1/2 teaspoon salt",
  "3 large eggs"
]
```

## Accessibility

The component follows web accessibility best practices:

- Semantic HTML structure with proper `<ul>` and `<li>` tags
- `role="list"` and `role="listitem"` for screen readers
- Checkbox labels properly associated with inputs
- ARIA labels for checkbox actions
- Keyboard navigation support
- High contrast for visual components

## Testing

### Visual Test
Open `tmp/test-ingredient-visual.html` in a browser to see rendered examples of parsed ingredients with different formats.

### Unit Test
Run `npx tsx tmp/test-ingredient-parser.ts` to execute test cases and verify parsing logic.

### Test Cases Included
- Standard measurements (cups, tablespoons, teaspoons)
- Fractions (1/2, ¼, unicode fractions)
- Ranges (1-2 tablespoons)
- Text amounts (a handful, one large)
- Preparation methods (chopped, minced, sifted)
- Qualifiers (to taste, for garnish)
- Edge cases (no amount, no preparation)

## Future Enhancements

Potential improvements for future versions:

1. **Scaling Calculator**: Automatically adjust amounts when serving size changes
2. **Unit Conversion**: Convert between metric and imperial units
3. **Substitution Suggestions**: Suggest ingredient alternatives
4. **Nutrition Calculation**: Estimate nutrition per ingredient
5. **Smart Shopping**: Group by grocery store aisle
6. **Allergen Detection**: Flag common allergens
7. **Cost Estimation**: Show ingredient price estimates

## Maintenance

### Adding New Units
Edit the `UNITS` array in `IngredientsList.tsx`:

```typescript
const UNITS = [
  // Add new unit here
  'your-unit', 'your-units',
  // ...
];
```

### Adding New Preparations
Edit the `PREPARATIONS` array:

```typescript
const PREPARATIONS = [
  // Add new preparation here
  'your-preparation',
  // ...
];
```

### Debugging Parsing Issues

If an ingredient isn't parsing correctly:

1. Use the `parseIngredientString` function directly
2. Check the test script: `tmp/test-ingredient-parser.ts`
3. Add your test case and run: `npx tsx tmp/test-ingredient-parser.ts`
4. Verify the regex patterns match your format

## Performance

- **Parsing**: O(n) where n is ingredient string length
- **Rendering**: Optimized with React best practices
- **Memory**: Minimal state (only checkbox selections)
- **Re-renders**: Only when props change or checkboxes toggle

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- ES2017+ features used
- Regex with Unicode support required
- React 18+ required

## Related Files

- `src/components/recipe/IngredientsList.tsx` - Main component
- `src/app/recipes/[id]/page.tsx` - Integration point
- `src/lib/utils/recipe-utils.ts` - Related utilities (legacy)
- `tmp/test-ingredient-parser.ts` - Test script
- `tmp/test-ingredient-visual.html` - Visual test
- `tmp/IngredientsList-usage-example.tsx` - Usage examples

## References

- [Next.js Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Radix UI Checkbox](https://www.radix-ui.com/primitives/docs/components/checkbox)
- [Recipe Markup Schema.org](https://schema.org/Recipe)
- [USDA Food Database](https://fdc.nal.usda.gov/)

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
**Component**: IngredientsList
**Status**: Production Ready
