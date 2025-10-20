# InventoryMatchSection Component - Test Cases

## Ingredient Parsing Test Cases

The `parseIngredientName()` function should correctly extract core ingredient names from full ingredient strings.

### Test Cases:

| Input String | Expected Output | Rationale |
|--------------|----------------|-----------|
| `"2 cups all-purpose flour"` | `"flour"` | Removes quantity, unit, descriptor |
| `"400g spaghetti"` | `"spaghetti"` | Removes metric units |
| `"3 large eggs"` | `"eggs"` | Removes quantity and size descriptor |
| `"1/2 cup diced onions"` | `"onions"` | Removes fractions and cooking method |
| `"2 tablespoons olive oil"` | `"olive oil"` | Preserves compound ingredient names |
| `"1 pound fresh ground beef"` | `"beef"` | Removes quantity, weight, descriptors |
| `"4 cloves garlic, minced"` | `"garlic"` | Removes count, preparation method |
| `"1 (14.5 oz) can diced tomatoes"` | `"tomatoes"` | Removes packaging info |
| `"Salt and pepper to taste"` | `"salt pepper"` | Handles compound ingredients |
| `"200g Pecorino Romano cheese"` | `"pecorino romano cheese"` | Preserves cheese variety |

## Matching Logic Test Cases

### Test Scenario 1: Exact Match
```
Recipe Ingredient: "2 cups flour"
Inventory Item: { name: "All-Purpose Flour", quantity: "5", unit: "lbs" }
Expected: ✅ Match (contains "flour")
```

### Test Scenario 2: Partial Match
```
Recipe Ingredient: "1 cup shredded cheddar cheese"
Inventory Item: { name: "Cheddar Cheese", quantity: "200", unit: "g" }
Expected: ✅ Match (contains "cheddar")
```

### Test Scenario 3: No Match
```
Recipe Ingredient: "2 cups flour"
Inventory Item: { name: "Sugar", quantity: "2", unit: "cups" }
Expected: ❌ No Match
```

### Test Scenario 4: Fuzzy Match (Plural/Singular)
```
Recipe Ingredient: "3 large eggs"
Inventory Item: { name: "Egg", quantity: "12", unit: "pieces" }
Expected: ✅ Match (both contain "egg")
```

### Test Scenario 5: Case Insensitive
```
Recipe Ingredient: "Fresh Basil Leaves"
Inventory Item: { name: "basil", quantity: "1", unit: "bunch" }
Expected: ✅ Match (case insensitive)
```

## Component State Test Cases

### State 1: Loading
- **When**: Component first renders with authenticated user
- **Expected**: Shows spinner in card
- **Duration**: Until inventory fetch completes

### State 2: Not Signed In
- **When**: User is not authenticated
- **Expected**:
  - Shows "Sign in to see what you have" message
  - Shows sign-in button linking to `/sign-in?redirect=/recipes/{recipeId}`
  - No inventory data fetched

### State 3: Empty Inventory
- **When**: User is authenticated but has no inventory items
- **Expected**:
  - Shows "Your fridge is empty!" message
  - Shows "Add ingredients to your fridge" button
  - Links to `/fridge` page

### State 4: Has Inventory (Full Match)
- **When**: User has all recipe ingredients in inventory
- **Expected**:
  - Match percentage: 100%
  - Badge color: Green
  - "You Have" section shows all ingredients
  - "You Need" section is hidden or shows 0 items
  - Helpful tip: "Great match! You have most ingredients ready to cook."

### State 5: Has Inventory (Partial Match)
- **When**: User has some but not all recipe ingredients
- **Expected**:
  - Match percentage: 30-70%
  - Badge color: Orange (50-69%) or Gray (<50%)
  - Both "You Have" and "You Need" sections visible
  - "Add Missing Items" button shown

### State 6: Has Inventory (No Match)
- **When**: User has no matching ingredients
- **Expected**:
  - Match percentage: 0%
  - Badge color: Gray
  - Only "You Need" section visible
  - All ingredients listed as needed

### State 7: Error
- **When**: Inventory fetch fails
- **Expected**:
  - Shows error message in red border card
  - Error text displayed

## Accessibility Test Cases

### Keyboard Navigation
- [ ] All buttons are keyboard accessible
- [ ] Tab order is logical (header → badge → buttons)
- [ ] Enter/Space activates buttons

### Screen Reader
- [ ] Icons have ARIA labels (CheckCircle2, XCircle, ChefHat, ShoppingCart)
- [ ] Match percentage badge announces "X percent match"
- [ ] "You Have" and "You Need" sections clearly announced
- [ ] Loading state announces "Loading inventory"

### Visual
- [ ] Sufficient color contrast (green/orange text on white background)
- [ ] Icon + text patterns (not color-only indicators)
- [ ] Text readable at 200% zoom
- [ ] Touch targets minimum 44x44px (mobile)

## Mobile Responsive Test Cases

### Breakpoints
- **Mobile (< 640px)**:
  - [ ] Card full width
  - [ ] Summary stats stack vertically
  - [ ] Buttons stack vertically
  - [ ] Ingredient lists single column

- **Tablet (640px - 1024px)**:
  - [ ] Card adjusts to container
  - [ ] Buttons can be side-by-side (flex-row)
  - [ ] Adequate padding/spacing

- **Desktop (> 1024px)**:
  - [ ] Maximum width constraints respected
  - [ ] Buttons side-by-side
  - [ ] Comfortable reading width

## Performance Test Cases

### Inventory Size
- [ ] Handles 0 inventory items (empty state)
- [ ] Handles 10 inventory items (typical)
- [ ] Handles 100 inventory items (large inventory)
- [ ] Handles 500+ inventory items (stress test)

### Recipe Size
- [ ] Handles 3-5 ingredients (simple recipe)
- [ ] Handles 10-15 ingredients (typical)
- [ ] Handles 30+ ingredients (complex recipe)

### Matching Performance
- [ ] Matching completes in < 100ms for typical sizes
- [ ] No UI freezing during match calculation
- [ ] Efficient re-renders (only when inventory changes)

## Integration Test Cases

### Navigation
- [ ] Sign-in button redirects to `/sign-in?redirect=/recipes/{recipeId}`
- [ ] "Update Fridge" button goes to `/fridge`
- [ ] "Add Missing Items" button goes to `/fridge`
- [ ] After sign-in, user returns to recipe page

### Data Flow
- [ ] Uses `getUserInventory()` from `@/app/actions/inventory`
- [ ] Respects Clerk authentication state
- [ ] Reacts to inventory changes (when user adds items)
- [ ] Handles getUserInventory errors gracefully

## Edge Cases

### Edge Case 1: Malformed Recipe Data
```typescript
// Missing ingredients field
ingredients: undefined
Expected: Shows empty state or error
```

### Edge Case 2: Invalid JSON in Inventory
```typescript
// Inventory item with malformed data
inventoryItem: { ingredient: null }
Expected: Skips item, continues matching others
```

### Edge Case 3: Very Long Ingredient Names
```typescript
ingredient: "2 cups finely grated aged Parmigiano-Reggiano cheese (preferably 24-month aged)"
Expected: Parses correctly, matches "parmigiano" or "cheese"
```

### Edge Case 4: Special Characters
```typescript
ingredient: "1/2 cup (120ml) milk"
Expected: Parses to "milk"
```

### Edge Case 5: Multiple Ingredients in One String
```typescript
ingredient: "Salt and pepper to taste"
Expected: Parses to "salt pepper", matches either in inventory
```

## Visual Regression Test Cases

### Color Scheme
- [ ] Green section: `bg-green-50`, `border-green-200`, `text-green-700`
- [ ] Orange section: `bg-orange-50`, `border-orange-200`, `text-orange-700`
- [ ] Badge colors match percentage thresholds
- [ ] Brand color (`jk-sage`) used appropriately

### Layout
- [ ] Consistent spacing (space-y-6, space-y-4, space-y-2)
- [ ] Icons aligned with text
- [ ] Ingredient lists properly indented
- [ ] Summary stats centered and balanced

## Manual Testing Checklist

### Setup
1. [ ] Create test user account
2. [ ] Add test recipes with varying ingredient counts
3. [ ] Add test inventory items

### Test Flow 1: First-time User
1. [ ] Visit recipe page (not signed in)
2. [ ] Verify sign-in CTA displays
3. [ ] Click sign-in button
4. [ ] Complete authentication
5. [ ] Verify redirect back to recipe
6. [ ] Verify empty inventory state shows

### Test Flow 2: User with Inventory
1. [ ] Go to /fridge
2. [ ] Add 5 inventory items
3. [ ] Visit recipe with 3 matching + 2 non-matching ingredients
4. [ ] Verify correct match percentage
5. [ ] Verify "You Have" shows 3 items
6. [ ] Verify "You Need" shows 2 items

### Test Flow 3: Update Inventory
1. [ ] View recipe with partial match
2. [ ] Click "Add Missing Items"
3. [ ] Add missing ingredients in fridge
4. [ ] Return to recipe page
5. [ ] Verify match percentage updated (may need refresh)

## Automated Testing (Future)

### Unit Tests (Vitest)
```typescript
describe('parseIngredientName', () => {
  it('removes quantities and units', () => {
    expect(parseIngredientName('2 cups flour')).toBe('flour');
  });

  it('removes descriptors', () => {
    expect(parseIngredientName('fresh basil leaves')).toBe('basil leaves');
  });
});

describe('matchIngredientsToInventory', () => {
  it('matches exact ingredient names', () => {
    const result = matchIngredientsToInventory(
      ['2 cups flour'],
      [{ ingredient: { name: 'flour' }}]
    );
    expect(result[0].hasIt).toBe(true);
  });
});
```

### Integration Tests (Playwright)
```typescript
test('shows inventory match for authenticated user', async ({ page }) => {
  // Login
  await page.goto('/sign-in');
  await login(page);

  // Go to recipe
  await page.goto('/recipes/test-recipe');

  // Verify match section appears
  await expect(page.locator('text=Ingredient Match')).toBeVisible();
  await expect(page.locator('text=You Have')).toBeVisible();
});
```

## Notes

- Component is client-side only (`'use client'`)
- Requires Clerk authentication
- Depends on `/app/actions/inventory` server actions
- Uses fuzzy matching (may need refinement for production)
- Match percentage thresholds: ≥70% = green, 50-69% = orange, <50% = gray
