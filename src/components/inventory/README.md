# Inventory Components

**Status**: Phase 1 (MVP) - Simple ingredient collection
**Next Phase**: Full inventory management with quantity/expiry/storage

---

## FridgeInput Component

Autocomplete ingredient selection component for "What's in Your Fridge?" feature.

### Features

✅ **Implemented (Phase 1 - MVP)**:
- Debounced autocomplete search (300ms)
- Ingredient suggestions from database
- Popular ingredients shown when empty
- Selected ingredients displayed as badge chips
- Keyboard navigation (Arrow keys, Enter, Escape)
- Mobile-first responsive design (44x44px touch targets)
- Loading states for search and submit
- Max ingredients limit (default: 20)

🚧 **Future (Phase 2)**:
- Quantity input per ingredient
- Expiry date picker
- Storage location selection (fridge/freezer/pantry)
- Integration with full inventory tracking

---

## Usage

### Basic Usage

```tsx
import { FridgeInput } from '@/components/inventory';
import { useRouter } from 'next/navigation';

function MyPage() {
  const router = useRouter();

  const handleSearch = async (ingredients: string[]) => {
    // Navigate to results page with selected ingredients
    const query = ingredients.join(',');
    router.push(`/recipes/search?ingredients=${encodeURIComponent(query)}`);
  };

  return <FridgeInput onSearch={handleSearch} />;
}
```

### With matchRecipesToInventory Server Action

```tsx
import { FridgeInput } from '@/components/inventory';
import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';

function FridgeMatchPage() {
  const [results, setResults] = useState([]);

  const handleSearch = async (ingredientNames: string[]) => {
    const result = await searchRecipesByIngredients(ingredientNames, {
      matchMode: 'any',
      minMatchPercentage: 50,
      limit: 20,
    });

    if (result.success) {
      setResults(result.recipes);
    }
  };

  return (
    <div>
      <FridgeInput onSearch={handleSearch} />
      {/* Display results */}
    </div>
  );
}
```

### Custom Configuration

```tsx
<FridgeInput
  onSearch={handleSearch}
  placeholder="Enter your ingredients..."
  maxIngredients={15}
  className="max-w-2xl"
/>
```

---

## Component Props

```typescript
interface FridgeInputProps {
  /**
   * Callback when user submits ingredient search
   * @param ingredients - Array of selected ingredient names
   */
  onSearch: (ingredients: string[]) => Promise<void>;

  /**
   * Input placeholder text
   * @default "What's in your fridge?"
   */
  placeholder?: string;

  /**
   * Maximum number of ingredients user can select
   * @default 20
   */
  maxIngredients?: number;

  /**
   * Additional CSS classes
   */
  className?: string;
}
```

---

## Server Actions Integration

The FridgeInput component works with these server actions:

### 1. `getIngredientSuggestions`

Used internally for autocomplete suggestions.

```typescript
import { getIngredientSuggestions } from '@/app/actions/ingredient-search';

const result = await getIngredientSuggestions(query, {
  limit: 15,
  category?: string,
  commonOnly?: boolean,
});
```

### 2. `searchRecipesByIngredients`

Recommended for simple ingredient-based recipe search.

```typescript
import { searchRecipesByIngredients } from '@/app/actions/ingredient-search';

const result = await searchRecipesByIngredients(
  ['tomato', 'basil', 'mozzarella'],
  {
    matchMode: 'any', // 'all' | 'any' | 'exact'
    cuisine?: string,
    difficulty?: 'easy' | 'medium' | 'hard',
    minMatchPercentage: 50,
    limit: 20,
  }
);
```

### 3. `matchRecipesToInventory`

Advanced matching based on user's full inventory (requires inventory items).

```typescript
import { matchRecipesToInventory } from '@/app/actions/inventory';

const result = await matchRecipesToInventory({
  minMatchPercentage: 50,
  prioritizeExpiring: true,
  limit: 20,
});
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Arrow Down` | Navigate down suggestions |
| `Arrow Up` | Navigate up suggestions |
| `Enter` | Select highlighted suggestion OR submit search |
| `Escape` | Close suggestions dropdown |

---

## Mobile Optimization

The component follows mobile-first design principles:

- **Touch Targets**: Minimum 44x44px for all interactive elements
- **Responsive Layout**: Stacks vertically on mobile, horizontal on desktop
- **Button Text**: Abbreviated on mobile (`"Find"` vs `"Find Recipes"`)
- **Input Height**: Larger (48px) on mobile for easier tapping

---

## Styling

The component uses Joanie's Kitchen design system:

- **Primary Action**: `bg-jk-tomato` (Find Recipes button)
- **Selected Badges**: `bg-jk-sage/20` with `text-jk-olive`
- **Category Badges**: `border-jk-sage` with `text-jk-olive`
- **Font**: `font-ui` (Inter) for UI text
- **Focus States**: Custom ring with `focus:ring-ring/50`

---

## Accessibility

- **ARIA Labels**: All interactive elements labeled
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader**: Proper role attributes and announcements
- **Focus Management**: Visible focus indicators
- **Semantic HTML**: Proper use of buttons, inputs, lists

---

## Examples

See `FridgeInput.example.tsx` for comprehensive usage examples including:

1. Basic usage with navigation
2. Server action integration
3. Custom styling
4. Form integration

---

## Dependencies

Required UI components from shadcn/ui:
- `Badge` - Selected ingredient chips
- `Button` - Action buttons
- `Command` - Autocomplete command palette
- `Popover` - Dropdown suggestions

Icons from lucide-react:
- `Search` - Search icon
- `X` - Remove/clear icons
- `ChefHat` - Find recipes button icon
- `Loader2` - Loading spinner

---

## Data Flow

```
User types → Debounce 300ms → getIngredientSuggestions()
                                      ↓
                             Display suggestions with category badges
                                      ↓
                             User selects → Add to selected list
                                      ↓
                             User clicks "Find Recipes"
                                      ↓
                             onSearch(ingredients[]) callback
                                      ↓
                             Parent handles navigation/search
```

---

## Phase 2 Roadmap

Future enhancements planned:

- [ ] Quantity input for each ingredient
- [ ] Expiry date picker (with calendar UI)
- [ ] Storage location dropdown (fridge/freezer/pantry/other)
- [ ] Save to inventory functionality
- [ ] Integration with full inventory management
- [ ] Smart suggestions based on typical pairings
- [ ] Recently used ingredients
- [ ] Import from shopping list

---

## Troubleshooting

### Autocomplete not working
- Verify database connection to `ingredients` table
- Check `getIngredientSuggestions` server action is available
- Ensure pg_trgm extension enabled in PostgreSQL

### No suggestions appearing
- Check database has ingredients seeded
- Verify ingredient names are normalized (lowercase)
- Ensure minimum 2 characters typed

### Search not triggering
- Verify `onSearch` prop is provided
- Check that ingredients are selected before clicking
- Ensure `onSearch` returns a Promise

---

## Performance

- **Debounced Search**: 300ms delay prevents excessive API calls
- **Filtered Suggestions**: Already-selected ingredients excluded
- **Limited Results**: Default 15 suggestions per search
- **Keyboard Optimization**: Arrow key navigation without re-fetching

---

## Testing

Test scenarios to cover:

1. ✅ Autocomplete returns suggestions
2. ✅ Debounce prevents rapid API calls
3. ✅ Selected ingredients display as badges
4. ✅ Remove ingredient works
5. ✅ Clear all works
6. ✅ Max ingredients limit enforced
7. ✅ Keyboard navigation functions
8. ✅ Mobile touch targets ≥44px
9. ✅ Search button disabled when empty
10. ✅ Loading states display correctly

---

**Last Updated**: 2025-10-19
**Component Version**: 1.0.0 (Phase 1 MVP)
**Maintained By**: Recipe Manager Team
