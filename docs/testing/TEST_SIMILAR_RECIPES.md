# Testing Similar Recipes Feature

## Quick Test Instructions

### 1. Find a Recipe with Embeddings

The following recipes now have embeddings generated (test with any of these):

**Asian Cuisine**:
- Mapo Tofu (Chinese)
- Xiaolongbao (Soup Dumplings) (Chinese)
- Bibimbap (Korean)
- Korean Fried Chicken (Korean)

**Mexican Cuisine**:
- Cochinita Pibil
- Classic Beef Tacos

**Mediterranean**:
- Mediterranean Quinoa Salad
- Spanakopita (Greek)

**French**:
- Classic French Onion Soup
- Coq au Vin

And 50 more recipes from Epicurious collection.

### 2. Test in Browser

1. **Open the app**: http://localhost:3003

2. **Navigate to recipes page**: Click "Recipes" in navigation

3. **Search for a test recipe**:
   - Search for "Mapo Tofu" or "Bibimbap"
   - Or browse the recipe list

4. **Open recipe detail page**: Click on any recipe from the list above

5. **Scroll to bottom**: Look for the "Recipes Like This" section

6. **Verify the widget shows**:
   - ✅ "Recipes Like This" heading with sparkle icon
   - ✅ Horizontal carousel of similar recipes
   - ✅ Similarity percentage badges (e.g., "76% similar")
   - ✅ Left/right navigation arrows (if >3 recipes)
   - ✅ Recipe cards are clickable

### 3. Expected Behavior

**For recipes WITH embeddings** (like Mapo Tofu):
- Widget loads after ~1-2 seconds
- Shows 3-6 similar recipes in a carousel
- Each recipe shows similarity percentage
- Clicking a recipe navigates to its detail page

**For recipes WITHOUT embeddings** (most recipes currently):
- Widget shows nothing (expected until more embeddings generated)
- OR shows "Find Similar Recipes" button (if autoLoad=false)

### 4. Browser Console Check

Open browser DevTools (F12) and check:

**Expected Console Output** (no errors):
```
[HuggingFace] Successfully loaded embedding
```

**No Red Errors** should appear related to:
- Semantic search
- Embeddings
- Similar recipes

### 5. Test Different Recipes

Try these specific test cases:

**Test Case 1: Mapo Tofu**
- Expected: Shows Chinese dishes (Xiaolongbao, Bibimbap)
- Similarity: 70-80%

**Test Case 2: Classic Beef Tacos**
- Expected: Shows Mexican dishes (Cochinita Pibil)
- Similarity: 60-75%

**Test Case 3: Mediterranean Quinoa Salad**
- Expected: Shows healthy/vegetarian dishes
- Similarity: 60-75%

---

## Generate More Embeddings (Optional)

To test with more recipes, generate additional embeddings:

```bash
# Generate 50 more recipes
npx tsx scripts/check-and-fix-similar-recipes.ts --generate 50

# Generate 200 recipes (recommended for production)
npx tsx scripts/check-and-fix-similar-recipes.ts --generate 200
```

**Note**: Each batch takes ~2 seconds per recipe due to rate limiting
- 50 recipes: ~2-3 minutes
- 200 recipes: ~8-10 minutes

---

## Troubleshooting

### Widget Not Showing

**Cause**: Recipe doesn't have embeddings yet

**Solution**:
1. Try a different recipe from the list above
2. Generate embeddings for more recipes

### Shows Loading Forever

**Cause**: Network error or API issue

**Solution**:
1. Check browser console for errors
2. Verify HUGGINGFACE_API_KEY is set in .env.local
3. Restart dev server

### Shows "Error" Message

**Cause**: Database connection or query error

**Solution**:
1. Check DATABASE_URL is set correctly
2. Verify pgvector extension is enabled
3. Check browser console for specific error

---

## Quick Diagnostic Commands

```bash
# Check embedding count
npx tsx scripts/check-and-fix-similar-recipes.ts

# Test API connection
npx tsx scripts/test-hf-api.ts

# Test database queries
npx tsx scripts/test-similar-recipes-simple.ts

# Generate more embeddings
npx tsx scripts/check-and-fix-similar-recipes.ts --generate 20
```

---

## Success Criteria

✅ **Feature is working if**:
1. Widget appears at bottom of recipe detail page
2. Shows 3-6 similar recipes in carousel
3. Each recipe has similarity percentage
4. Clicking recipes navigates correctly
5. No console errors
6. Loads within 2 seconds

---

## Browser Testing URLs

Direct links to test recipes (if database IDs are known):
- http://localhost:3003/recipes/{recipe-id}

Or search for these names:
- http://localhost:3003/recipes (then search "Mapo Tofu")
- http://localhost:3003/recipes (then search "Bibimbap")
- http://localhost:3003/recipes (then search "Tacos")

---

**Last Updated**: 2025-10-16
**Test Status**: Ready for verification
**Estimated Test Time**: 5-10 minutes
