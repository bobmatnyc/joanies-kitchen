# Fridge Feature User Guide

**Joanie's Kitchen - Zero-Waste Cooking Intelligence**

---

## Overview

The Fridge Feature is Joanie's Kitchen's **core differentiator** - helping you cook with what you already have, reducing food waste and saving money. Simply enter the ingredients in your fridge, and we'll find recipes you can make right now.

### Why It Matters

American households waste **$1,500 worth of food per year** on average. The Fridge Feature addresses this by:

- Finding recipes that use ingredients you already have
- Suggesting smart substitutions for missing ingredients
- Scoring recipes by "resourcefulness" (how well you can use what you have)
- Reducing trips to the grocery store
- Minimizing food waste through intelligent recipe matching

---

## How It Works

### 1. Enter Your Ingredients

Navigate to the **Ingredients** page (hamburger menu → Ingredients, or `/ingredients`).

**Tips for best results**:
- Use common ingredient names (e.g., "tomatoes" instead of "heirloom tomatoes")
- Include pantry staples (salt, pepper, oil, flour) for more matches
- Add multiple ingredients separated by commas or pressing Enter
- Start with at least 3-5 ingredients for good results

**Example inputs**:
```
chicken, rice, onions, garlic, soy sauce
tomatoes, basil, mozzarella, pasta
eggs, flour, milk, butter, sugar
```

### 2. Search Recipes

Click the **"Search Recipes"** button to find matching recipes.

**What happens behind the scenes**:
- Our system searches **4,644 indexed recipes** in real-time
- **99.94% of recipes** (4,641) have structured ingredient data
- Results return in **150-272ms** on average (sub-500ms guarantee)
- Recipes are ranked by how well they match your ingredients

### 3. View Results

Recipes are displayed with:

- **Recipe name and image**
- **Match percentage** - How many ingredients you have (e.g., "8/10 ingredients - 80% match")
- **Missing ingredients** - What you'd need to buy
- **Resourcefulness score** - How efficiently the recipe uses what you have
- **Cook time, difficulty, and cuisine**

**Result sorting**:
- Default: Highest match percentage first
- You can filter by cuisine, difficulty, dietary restrictions
- Mobile-optimized: 1 column (phone), 2 columns (tablet), 3 columns (desktop)

### 4. Get Substitution Suggestions

Don't have all the ingredients? Click on a recipe to see **AI-powered substitution suggestions**.

**Substitution engine**:
- **Hybrid approach**: Rule-based (fast) + GPT-4o-mini (smart)
- Context-aware: Considers recipe name, cooking method, your available ingredients
- Dietary-aware: Respects restrictions (vegan, gluten-free, etc.)
- Quality-focused: Only suggests substitutions that maintain recipe integrity

**Example substitutions**:
```
Missing butter?
→ Coconut oil (baking)
→ Olive oil (cooking)
→ Applesauce (baking, low-fat)

Missing eggs?
→ Flax eggs (1 tbsp ground flax + 3 tbsp water)
→ Banana (baking, adds sweetness)
→ Applesauce (baking, moisture)

Missing milk?
→ Almond milk (dairy-free)
→ Oat milk (creamy, neutral)
→ Water + butter (in a pinch)
```

### 5. Cook and Reduce Waste

Select a recipe and start cooking! You've just:
- ✅ Used ingredients you already had
- ✅ Avoided a grocery store trip
- ✅ Reduced food waste
- ✅ Saved money
- ✅ Contributed to a more sustainable food system

---

## Features

### Ingredient Matching (Core Feature)

**Database coverage**:
- **4,644 total recipes** indexed
- **99.94% extraction rate** (4,641 recipes with structured ingredients)
- **3 missing recipes**: Indexed but extraction pending
- **Real-time search**: Sub-500ms response time

**Match modes**:
- **Any (default)**: Find recipes with AT LEAST ONE of your ingredients
- **All**: Find recipes that use ALL your ingredients (perfect for meal planning)
- **Exact**: Find recipes that use ONLY your ingredients (zero-waste cooking)

**Search capabilities**:
- Fuzzy matching: "tomatos" finds "tomatoes"
- Alias support: "green onion" = "scallion" = "spring onion"
- Category filtering: Search within vegetables, proteins, grains, etc.
- Multi-ingredient search: Add as many as you want

### AI-Powered Substitutions

**Technology stack**:
- **Rule-based engine**: Instant results for 200+ common substitutions
- **GPT-4o-mini fallback**: Smart suggestions for unusual ingredients
- **Context awareness**: Recipe name, cooking method, dietary needs
- **Quality filtering**: Only suggests viable substitutions

**Substitution context**:
```typescript
{
  recipeName: "Chocolate Chip Cookies",
  cookingMethod: "baking",
  userIngredients: ["coconut oil", "olive oil"],
  dietaryRestrictions: ["vegan"]
}
```

**Response format**:
- Substitution name and ratio (e.g., "1:1 replacement")
- Flavor/texture impact (e.g., "Adds coconut flavor")
- Dietary compatibility (vegan, gluten-free, etc.)
- Cooking notes (if applicable)

### Resourcefulness Scoring

**What it measures**:
- Ingredient match percentage (primary factor)
- Recipe complexity vs. your ingredients
- Waste reduction potential
- Ingredient versatility

**Score ranges**:
- **90-100%**: Perfect match - cook this now!
- **75-89%**: Great match - only missing 1-2 ingredients
- **50-74%**: Good match - need a few more items
- **<50%**: Low match - consider other recipes

**Use cases**:
- Pre-grocery shopping: Find recipes to make first
- End-of-week cooking: Use up leftover ingredients
- Pantry challenges: Cook with minimal shopping
- Budget cooking: Maximize what you have

### Mobile Optimization

**Mobile-first design** (60-70% of traffic is mobile):
- **Touch targets**: 44x44px minimum (accessibility standard)
- **Font sizes**: 16px+ to prevent iOS auto-zoom
- **Input visibility**: White text on dark background (high contrast)
- **Responsive grid**: Adapts to screen size automatically
- **Performance**: 150-272ms search response time on mobile networks

**Mobile navigation**:
- Hamburger menu (top-left) → Ingredients
- Tap to add ingredients
- Swipe to remove ingredients
- Scroll-friendly result cards
- Easy-to-tap "View Recipe" buttons

**Tested on**:
- iPhone (iOS Safari) ✅
- Android (Chrome) ✅
- iPad (tablet view) ✅
- Various screen sizes (375px - 768px+) ✅

---

## Tips for Best Results

### Maximize Matches

1. **Include pantry staples**:
   - Salt, pepper, oil, butter
   - Flour, sugar, baking powder
   - Common spices (garlic powder, paprika, cumin)

2. **Use ingredient categories**:
   - Instead of "red onion" → "onion"
   - Instead of "extra virgin olive oil" → "olive oil"
   - Instead of "russet potatoes" → "potatoes"

3. **Add multiple ingredients**:
   - 3-5 ingredients: Basic search
   - 6-10 ingredients: Good variety
   - 10+ ingredients: Comprehensive results

4. **Combine proteins + vegetables + grains**:
   - Example: "chicken, broccoli, rice, soy sauce, garlic"
   - Example: "ground beef, tomatoes, onions, pasta, cheese"

### Browse by Resourcefulness

**High resourcefulness** (90%+ match):
- Perfect for end-of-week cooking
- Minimize food waste
- Use up ingredients before they spoil
- No grocery shopping needed

**Medium resourcefulness** (70-89% match):
- Good for meal planning
- Only 1-2 ingredients to buy
- Smart grocery list generation
- Efficient shopping

**Low resourcefulness** (<70% match):
- Explore new recipes
- Plan future meals
- Bookmark for later
- Create shopping lists

### Use Substitution Suggestions

**When to substitute**:
- Missing 1-2 non-critical ingredients
- Dietary restrictions (vegan, gluten-free)
- Allergy accommodations
- Preference adjustments

**When NOT to substitute**:
- Key flavor ingredients (e.g., basil in pesto)
- Structural ingredients (e.g., eggs in soufflé)
- Multiple missing ingredients (>3)
- Unfamiliar cooking techniques

**Trust the AI**:
- Context-aware suggestions are tested
- Cooking notes explain impact
- Ratio guidance prevents mistakes
- Dietary flags ensure compatibility

---

## Technical Details

### Performance Metrics

**Production performance** (October 2025 audit):
- **Search response time**: 150-272ms average
- **Target**: <500ms (well under target)
- **Database queries**: Optimized with 15+ indexes
- **Caching**: Multi-layer cache (ingredient, suggestions, popular)
- **Mobile performance**: No degradation on 3G networks

**Scalability**:
- Handles 100+ concurrent searches
- Sub-second response at 95th percentile
- Connection pooling via Neon PostgreSQL
- Edge network routing for low latency

### Database Architecture

**Ingredients table**:
```sql
- id: UUID (primary key)
- name: text (normalized lowercase)
- display_name: text (properly capitalized)
- category: varchar(50) (vegetables, proteins, etc.)
- aliases: text (JSON array of alternative names)
- is_common: boolean (for autocomplete priority)
- usage_count: integer (number of recipes using this)
```

**Recipe ingredients table**:
```sql
- recipe_id: text (foreign key to recipes)
- ingredient_id: uuid (foreign key to ingredients)
- amount: varchar(50) (e.g., "2", "1/2 cup")
- unit: varchar(50) (cups, tablespoons, pieces, etc.)
- preparation: varchar(200) (chopped, diced, minced)
- position: integer (order in recipe)
```

**Indexes for performance**:
- Name index (exact match)
- Name trigram index (fuzzy search with pg_trgm)
- Category index (filter by type)
- Common ingredients index (autocomplete priority)
- Recipe-ingredient composite index (fast joins)

### Search Algorithm

**Step 1: Ingredient normalization**:
```typescript
normalizedNames = ingredientNames.map(name =>
  name.toLowerCase().trim()
);
```

**Step 2: Fuzzy ingredient matching**:
```sql
SELECT * FROM ingredients
WHERE name = 'tomato'
   OR display_name ILIKE '%tomato%'
   OR aliases::text ILIKE '%tomato%';
```

**Step 3: Recipe lookup**:
```sql
SELECT recipe_id, COUNT(*) as matches
FROM recipe_ingredients
WHERE ingredient_id IN (found_ingredient_ids)
GROUP BY recipe_id;
```

**Step 4: Match percentage calculation**:
```typescript
matchPercentage = (matchedIngredients / totalIngredients) * 100;
```

**Step 5: Ranking algorithm**:
- **60% weight**: Match percentage (primary factor)
- **30% weight**: System rating (AI quality score)
- **10% weight**: User rating (community feedback)

**Step 6: Result pagination**:
- Default limit: 20 recipes
- Maximum limit: 100 recipes
- Offset-based pagination

---

## Frequently Asked Questions

### How accurate is the ingredient matching?

**99.94% accuracy** - We've extracted structured ingredient data from 4,641 out of 4,644 recipes. The 3 remaining recipes are indexed but pending extraction.

### Can I save my ingredient list?

Currently, the fridge feature is **stateless** - you enter ingredients each time. For signed-in users, we're planning to add:
- Persistent ingredient inventory
- Shopping list integration
- Ingredient usage history
- Expiration date tracking

**Roadmap**: v0.8.0 (post-launch)

### What if I have dietary restrictions?

Use the **dietary restrictions filter**:
- Vegan
- Vegetarian
- Gluten-free
- Dairy-free
- Nut-free
- Paleo
- Keto

Substitution suggestions automatically respect your dietary preferences.

### How do substitutions work?

**Hybrid approach**:
1. **Rule-based**: 200+ pre-programmed substitutions (instant)
2. **AI-powered**: GPT-4o-mini for unusual ingredients (2-3 seconds)
3. **Context-aware**: Recipe name, cooking method, your ingredients
4. **Quality-filtered**: Only viable substitutions suggested

**Example workflow**:
```
User missing: butter (in "Chocolate Chip Cookies")
Context: baking, sweet, user has coconut oil
Suggestion: Coconut oil (1:1 ratio, adds coconut flavor)
```

### Why do some recipes show low matches?

**Possible reasons**:
- Recipe has many ingredients (10+)
- Specialty ingredients not in your fridge
- Specific ingredient variations (e.g., "fresh basil" vs. "basil")
- Professional/complex recipes

**Solution**: Try the "All" match mode to find recipes that use ALL your ingredients, even if they require a few more.

### Can I search by cuisine or difficulty?

**Yes!** Use the filters:
- **Cuisine**: Italian, Mexican, Asian, American, French, etc.
- **Difficulty**: Easy, Medium, Hard
- **Dietary**: Vegan, Gluten-free, etc.
- **Match percentage**: Set minimum match threshold (e.g., 70%+)

**Pro tip**: Start broad (no filters), then narrow down based on results.

### How often is the recipe database updated?

**Weekly crawls** from curated chef sources:
- Current: 4,644 recipes
- Growth rate: ~50-100 recipes/week
- Quality threshold: Only high-quality, tested recipes
- Manual curation: Joanie reviews all imported recipes

**Next update**: October 28, 2025 (post-launch)

---

## Troubleshooting

### No results found

**Check**:
1. Ingredient names are correct (e.g., "tomatoes" not "tomatoe")
2. At least 1 ingredient entered
3. Try broader terms (e.g., "cheese" vs. "parmesan cheese")
4. Remove filters (cuisine, difficulty)
5. Lower match percentage threshold

**Still no results?**
- Try "Any" match mode instead of "All"
- Search individual ingredients to verify database coverage
- Check for typos or unusual ingredient names

### Search is slow

**Expected**:
- First search: 200-300ms (cache warming)
- Subsequent: 150-200ms (cached)
- Mobile 3G: 300-400ms (network latency)

**If slower than 500ms**:
1. Check internet connection
2. Clear browser cache
3. Try different network (WiFi vs. cellular)
4. Report issue to support

### Substitutions not showing

**Requirements**:
1. Click on a recipe (not just search results)
2. Recipe has missing ingredients
3. Substitution database has alternatives
4. JavaScript enabled in browser

**Note**: Not all ingredients have substitutions (e.g., very specific specialty ingredients).

### Mobile keyboard issues

**iOS**:
- Font size 16px+ prevents auto-zoom ✅
- Tap "Done" to dismiss keyboard
- Scroll up if keyboard covers button

**Android**:
- "Enter" key adds ingredient ✅
- "Search" button visible above keyboard
- Swipe down to dismiss keyboard

---

## Privacy & Data

### What data is collected?

**Anonymous usage**:
- Search queries (ingredient combinations)
- Recipe views and clicks
- Match percentages
- Performance metrics (response times)

**Signed-in users** (optional):
- Saved recipes
- Favorite ingredients
- Search history
- Cooking preferences

### Is my data shared?

**No.** Your ingredient searches are:
- Not sold to third parties
- Not shared with advertisers
- Used only to improve search quality
- Anonymized in aggregate analytics

### Can I delete my data?

**Yes.** Sign in → Profile → Privacy → Delete Data

This removes:
- Search history
- Saved ingredients
- Recipe bookmarks
- User preferences

**Note**: Anonymized aggregate analytics are retained for product improvement.

---

## Future Enhancements

### v0.8.0 - Inventory Management (Planned)

- **Persistent ingredient lists**: Save your fridge inventory
- **Expiration tracking**: Get alerts before food spoils
- **Shopping list integration**: Auto-generate lists from recipes
- **Barcode scanning**: Quick ingredient entry via mobile camera
- **Quantity tracking**: Know exactly how much you have

### v0.9.0 - Smart Recommendations (Planned)

- **Personalized suggestions**: Based on your cooking history
- **Seasonal recommendations**: Use in-season ingredients
- **Waste prediction**: Recipes for ingredients expiring soon
- **Meal planning integration**: Plan week based on inventory
- **Recipe learning**: AI learns your preferences over time

### v1.0.0 - Community Features (Planned)

- **Share inventories**: With family members or roommates
- **Community recipes**: User-submitted zero-waste recipes
- **Waste challenges**: Monthly challenges with community
- **Impact tracking**: See your food waste reduction over time
- **Ingredient swaps**: Community-verified substitutions

---

## Support

### Get Help

**Documentation**:
- This guide: `/docs/guides/FRIDGE_FEATURE_GUIDE.md`
- API Reference: `/docs/api/API_REFERENCE.md`
- FAQs: [Coming soon]

**Contact**:
- Email: support@joanies.kitchen
- Twitter: @joanieskitchen
- GitHub Issues: [Repository URL]

**Report a Bug**:
1. Go to repository Issues page
2. Use "Bug Report" template
3. Include: Browser, device, steps to reproduce
4. Attach screenshot if applicable

### Provide Feedback

**We want to hear from you!**

- Feature requests: GitHub Issues
- General feedback: support@joanies.kitchen
- User testing: Sign up for beta program
- Community forum: [Coming soon]

---

## Conclusion

The Fridge Feature is **Joanie's Kitchen's secret sauce** - turning the age-old question "What's for dinner?" into a zero-waste, money-saving, stress-free experience. By cooking with what you have, you're not just making a meal - you're making a difference.

**Key takeaways**:
- ✅ **4,644 recipes** at your fingertips
- ✅ **99.94% ingredient coverage** (4,641 recipes)
- ✅ **150-272ms search** response time
- ✅ **AI-powered substitutions** for missing ingredients
- ✅ **Mobile-optimized** for cooking on the go
- ✅ **Zero-waste mission** built into every search

**Start cooking smarter today**: [Visit Ingredients Page](/ingredients)

---

**Guide Version**: 1.0
**Last Updated**: October 21, 2025
**Author**: Joanie's Kitchen Team
**Launch**: October 27, 2025
