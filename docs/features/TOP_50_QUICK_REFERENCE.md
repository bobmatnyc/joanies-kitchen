# Top 50 Recipes - Quick Reference

## For Developers

### How to Enable Top 50 on Any Page

```tsx
import { RecipeFilters } from '@/components/recipe/RecipeFilters';
import { RecipeInfiniteList } from '@/components/recipe/RecipeInfiniteList';

// In your page component:
export default async function MyRecipePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const isTop50 = params.top50 === 'true';

  // Fetch recipes
  const result = await getRecipesPaginated({
    page: 1,
    limit: isTop50 ? 50 : 24,  // 50 for Top 50, 24 for normal
    filters: { isPublic: true },
    sort: 'rating',  // Must use 'rating' sort
  });

  return (
    <main>
      {/* Enable the toggle */}
      <RecipeFilters showTop50Toggle={true} />

      {/* Pass isTop50 to list */}
      <RecipeInfiniteList
        initialRecipes={recipes}
        initialPagination={pagination}
        isTop50={isTop50}
      />
    </main>
  );
}
```

### URL Parameters

- **Enable Top 50**: `?top50=true`
- **Disable Top 50**: `?top50=false` or omit parameter

### Component Props

#### RecipeFilters
```tsx
interface RecipeFiltersProps {
  showTop50Toggle?: boolean;  // Shows/hides the Top 50 tab
}
```

#### RecipeInfiniteList
```tsx
interface RecipeInfiniteListProps {
  isTop50?: boolean;  // Enables Top 50 mode (disables pagination, shows ranks)
}
```

#### RecipeCard (existing)
```tsx
interface RecipeCardProps {
  showRank?: number;  // Shows rank badge (1-50)
}
```

---

## For QA/Testing

### Test Scenarios

#### Basic Functionality
1. Navigate to `/shared`
2. Click "Top 50 ⭐" tab
3. Verify 50 recipes shown
4. Verify rank badges (1-50) visible
5. Verify no infinite scroll
6. Click "All Recipes" tab
7. Verify pagination returns

#### URL Handling
1. Navigate to `/shared?top50=true`
2. Verify Top 50 mode active on page load
3. Refresh page
4. Verify mode persists

#### Filter Compatibility
1. Enable Top 50
2. Filter by cuisine (e.g., Italian)
3. Verify shows top 50 Italian recipes
4. Filter by difficulty
5. Verify filters work together

#### Edge Cases
1. **No recipes**: Should show empty state
2. **< 50 recipes**: Should show all available
3. **Equal ratings**: Should sort by date
4. **No ratings**: Should show newest first

---

## For Product/PM

### Feature Description

**Top 50 Recipes** is a filter that shows users the highest-rated recipes in the community. It uses a smart ranking algorithm that combines AI quality scores with user ratings.

### User Benefits
- Quickly discover the best recipes
- See curated, high-quality content
- Save time browsing
- Trust in community-validated recipes

### Metrics to Track
- Click-through rate on "Top 50" tab
- Time spent in Top 50 mode
- Recipes saved from Top 50
- User retention after using Top 50

### Marketing Talking Points
- "Discover the community's 50 favorite recipes"
- "Ranked by AI quality + user ratings"
- "Updated in real-time as users rate recipes"
- "Your shortcut to the best meals"

---

## For Designers

### Visual Specifications

#### Top 50 Tab
- Icon: Star (filled)
- Text: "Top 50"
- Active state: Filled background
- Inactive state: Outline style

#### Rank Badges
- Position: Top-left of recipe card
- Size: 40x40px circle
- Background: jk-tomato red
- Text: White, bold
- Font: Heading font
- Shadow: Drop shadow

#### Top 50 Banner
- Background: jk-tomato/10 (10% opacity)
- Border: 2px solid jk-tomato
- Padding: 24px
- Star emoji: 2xl size
- Title: "Top 50 Recipes" (lg, heading font)
- Subtitle: "Showing the highest-rated recipes"

### Color Tokens
- Primary: `jk-tomato` (red accent)
- Background: `jk-tomato/10`
- Border: `jk-tomato`
- Text: `jk-olive` (headings), `jk-charcoal/70` (body)

---

## For Support/Customer Success

### User Questions

**Q: How are recipes ranked?**
A: Recipes are ranked by a combination of AI quality scores and user ratings. Higher-rated recipes appear first.

**Q: How often does the Top 50 update?**
A: The Top 50 updates in real-time as users rate recipes. The list is dynamic and always shows the current highest-rated recipes.

**Q: Can I filter within Top 50?**
A: Yes! You can use all existing filters (cuisine, difficulty, search) while viewing the Top 50.

**Q: Why aren't my recipes in the Top 50?**
A: To appear in the Top 50, recipes must:
- Be marked as public
- Have high ratings (4.5+ stars typically)
- Be actively rated by the community

**Q: Can I save Top 50 recipes?**
A: Absolutely! Click any recipe to view details and save it to your collection.

### Troubleshooting

**Issue: Top 50 shows wrong recipes**
- Check if filters are applied
- Verify recipe ratings in database
- Clear browser cache
- Check for sort parameter in URL

**Issue: Rank numbers missing**
- Verify `?top50=true` in URL
- Check browser console for errors
- Test in different browser

**Issue: Top 50 not loading**
- Check network connectivity
- Verify API endpoint responding
- Check for 50+ public recipes in database

---

## Database Queries (for debugging)

### Get Top 50 Recipes (SQL)
```sql
SELECT
  id,
  name,
  COALESCE(
    (COALESCE(system_rating, 0) + COALESCE(avg_user_rating, 0)) /
    NULLIF(
      (CASE WHEN system_rating IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN avg_user_rating IS NOT NULL THEN 1 ELSE 0 END),
      0
    ),
    COALESCE(system_rating, avg_user_rating, 0)
  ) as combined_rating
FROM recipes
WHERE is_public = true
  AND (system_rating IS NOT NULL OR avg_user_rating IS NOT NULL)
ORDER BY combined_rating DESC, created_at DESC
LIMIT 50;
```

### Count Public Recipes
```sql
SELECT COUNT(*) as total_public_recipes
FROM recipes
WHERE is_public = true;
```

### Count Rated Recipes
```sql
SELECT COUNT(*) as total_rated_recipes
FROM recipes
WHERE is_public = true
  AND (system_rating IS NOT NULL OR avg_user_rating IS NOT NULL);
```

---

## API Endpoints

### Get Top 50
```bash
# POST request
curl -X POST http://localhost:3002/api/recipes/paginated \
  -H "Content-Type: application/json" \
  -d '{
    "page": 1,
    "limit": 50,
    "filters": { "isPublic": true },
    "sort": "rating"
  }'

# GET request
curl "http://localhost:3002/api/recipes/paginated?page=1&limit=50&sort=rating&isPublic=true"
```

### Expected Response
```json
{
  "recipes": [ /* 50 recipe objects */ ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3,
    "hasMore": true
  }
}
```

---

## Configuration

### Environment Variables
No new environment variables required. Uses existing database connection and auth.

### Feature Flags
Currently no feature flags. To disable globally:
1. Set `showTop50Toggle={false}` in pages
2. Or remove the toggle from UI

### Performance Settings
- **Cache TTL**: 60 seconds
- **Stale-while-revalidate**: 120 seconds
- **Max recipes per page**: 100 (enforced in API)
- **Default Top 50 limit**: 50

---

**Last Updated**: 2025-10-15
**Version**: 1.0.0
