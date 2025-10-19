# Recipe Tag Taxonomy Research - Executive Summary

**Date**: 2025-10-18
**Status**: ✅ Complete
**Full Report**: `docs/research/RECIPE_TAG_TAXONOMY_RESEARCH.md`

---

## Key Findings

### 1. Our System is Well-Designed ✅

Our current 10-category semantic tag system aligns with industry standards:
- Matches Schema.org recipe properties
- Comparable to NYT Cooking, AllRecipes, Food Network
- Hierarchical support (Italian → Sicilian) matches best practices
- Synonym mapping ("plant-based" → "vegan") prevents duplicates

**Conclusion**: No major redesign needed, only refinements.

---

## 2. Recommended Improvements

### Priority 1: Category Refinement (4 hours)

**Add 3 New Categories**:
1. **Dish Type**: Soup, Salad, Sandwich, Pizza, Casserole, Bowl
   - Why: Separates structure from course position
   - Example: "Soup" is a dish type; "Appetizer" is a course

2. **Planning**: Make-Ahead, Freezer-Friendly, Meal Prep, Batch Cooking
   - Why: Describes workflow, not cooking time
   - Distinct from prepTime/cookTime fields

3. **Characteristics**: Comfort Food, Kid-Friendly, Healthy, Spicy, Party
   - Why: Descriptive tags that don't fit other categories
   - Helps discovery ("I want comfort food")

**Clean Up Existing**:
- Remove "Appetizer", "Dessert", "Side", "Main" from Meal Type
- Add "Appetizer", "Dessert" to Course
- Move "Make-Ahead", "Overnight" from Time to Planning

---

### Priority 2: Difficulty Should Be a Field, Not a Tag (1 day)

**Problem**: Difficulty is both a tag category AND a database field
- Redundant data
- Schema.org doesn't include difficulty as tag property
- Major platforms treat it as a filter, not a tag

**Solution**:
- Remove "Difficulty" tag category
- Use existing `difficulty` field (easy | medium | hard)
- Write migration script to convert difficulty tags to field values

**Impact**: Breaking change, requires data migration

---

### Priority 3: Remove Vague Time Tags (4 hours)

**Problem**: "Quick", "Medium", "Long" are imprecise
- "Quick" to one person is 15 min, to another is 45 min
- Overlaps with prepTime/cookTime fields

**Solution**:
- Remove time tags: "Quick", "Medium", "Long"
- Use database fields: `prepTime` + `cookTime`
- Add computed UI filters: "Under 30 min", "30-60 min", "1-2 hours", "2+ hours"
- Keep planning tags: "Make-Ahead", "Freezer-Friendly"

---

## 3. Industry Best Practices

### Optimal Tag Count: 2-5 Tags Per Recipe

**Research Finding**: SEO best practices recommend 2-5 tags
- Fewer than 2: Underspecified, poor discoverability
- More than 8: Dilutes SEO signal, overwhelming to users

**Recommended Mix** (for 5 tags):
1. Cuisine (Italian)
2. Meal Type/Course (Dinner, Main Course)
3. Dietary/Ingredient (Vegetarian, Chicken)
4. Method/Time (Baked, Quick)
5. Special (Holiday, Comfort Food)

**Action**: Reduce `maxTags` from 20 to 8, add UI hint

---

### Hierarchy Depth: Maximum 2-3 Levels

**Finding**: Most recipe sites limit hierarchies to 2 levels
- ✅ Italian → Sicilian (2 levels)
- ✅ Vegetarian → Vegan (2 levels)
- ❌ Italian → Southern → Sicilian → Palermo (4 levels - too deep)

**Why**: Mobile UX constraints, user recognition, navigation complexity

**Our Implementation**: ✅ Already at 2 levels, correct approach

---

### Course vs Meal Type Confusion (Industry-Wide)

**Clarification Needed**:
- **Meal Type** = WHEN eaten (Breakfast, Lunch, Dinner)
- **Course** = POSITION in meal (Appetizer, Main, Side, Dessert)
- **Dish Type** = WHAT it is (Soup, Salad, Sandwich, Pizza)

**Example**:
- Caesar Salad:
  - Meal Type: Lunch (eaten at midday)
  - Course: Appetizer (first course at dinner)
  - Dish Type: Salad (structural form)

**Action**: Update category definitions, clean up overlaps

---

## 4. Missing Tags to Add

### Dietary (High Priority)
- Pescatarian (fish but no meat)
- Egg-Free (major allergen)
- Soy-Free (major allergen)
- Sesame-Free (new US allergen label law)

### Cooking Methods (Medium Priority)
- Sous Vide (popular home cooking method)
- Fermenting (growing trend: kimchi, kombucha, sourdough)

### Cuisines (On-Demand)
- Add regional cuisines as users request
- Peruvian, Lebanese, Filipino, etc.

---

## 5. Schema.org Alignment

**Schema.org Recipe Properties**:
- `recipeCuisine` → Our "Cuisine" category ✅
- `recipeCategory` → Our "Course" category ✅
- `suitableForDiet` → Our "Dietary" category ✅
- `keywords` → Our general tags ✅
- `prepTime` / `cookTime` → Database fields ✅
- ❌ No `difficulty` property (validates our recommendation to use field, not tag)

**Conclusion**: Our tag system maps cleanly to SEO standards

---

## 6. FoodOn Ontology (Research Use Only)

**What it is**: Formal food ontology with 9,600+ food categories
**Structure**: Directed Acyclic Graph (items can have multiple parents)
**Use Case**: Food traceability, supply chain, nutrition research

**Takeaway**: Too complex for user-facing recipe apps
- Our lightweight semantic tag approach is appropriate
- Formal ontologies are academic, not consumer-friendly

---

## 7. Recommended Action Plan

### Phase 1: Quick Wins (1 Week)

**Effort**: 4-8 hours total

1. ✅ Add Dish Type, Planning, Characteristics categories
2. ✅ Move tags to correct categories
3. ✅ Add missing dietary tags (Pescatarian, Egg-Free, Soy-Free)
4. ✅ Add Sous Vide, Fermenting cooking methods
5. ✅ Update category definitions in documentation
6. ✅ Reduce maxTags from 20 to 8

**Impact**: Non-breaking changes, immediate improvement

---

### Phase 2: Difficulty Migration (1 Day)

**Effort**: 8 hours (includes testing)

1. ⚠️ Write migration script (tag → field)
2. ⚠️ Remove Difficulty tag category
3. ⚠️ Update filters to use difficulty field
4. ⚠️ Deploy migration script

**Impact**: Breaking change, requires careful testing

---

### Phase 3: Time Tag Cleanup (4 Hours)

**Effort**: 4 hours

1. ❌ Remove "Quick", "Medium", "Long" time tags
2. ✅ Add computed time filters in UI
3. ✅ Update search to use prepTime/cookTime

**Impact**: Minor breaking change, better UX

---

### Phase 4: Ongoing Enhancements

**Effort**: 2-4 hours per quarter

1. 🔄 Add regional cuisines on-demand
2. 🔄 Review "Other" category, promote popular tags
3. 🔄 Update popularity scores based on usage analytics
4. 🔄 A/B test tag count limits (5 vs 8 tags)

---

## 8. Success Metrics

### User Experience
- ⬆️ Recipe discovery via tag filtering
- ⬇️ "No results" searches
- ⬆️ Tag autocomplete satisfaction

### SEO
- ⬆️ Organic search traffic
- ⬆️ Click-through rate on recipe snippets
- ⬆️ Ranking for cuisine + dietary queries

### Data Quality
- ⬇️ Tag duplication (synonyms working)
- ⬆️ Tag consistency across recipes
- ⬇️ Tags in "Other" category

---

## 9. Quick Reference: 11 Categories (Revised)

| # | Category | Purpose | Depth | Examples |
|---|----------|---------|-------|----------|
| 1 | **Cuisine** | Regional origin | 2 levels | Italian → Sicilian |
| 2 | **Meal Type** | When eaten | Flat | Breakfast, Lunch, Dinner |
| 3 | **Course** | Position in meal | Flat | Appetizer, Main, Dessert |
| 4 | **Dish Type** | Structural form | Flat | Soup, Salad, Pizza |
| 5 | **Dietary** | Restrictions | 2 levels | Vegetarian → Vegan |
| 6 | **Cooking Method** | Technique/appliance | 2 levels | Dry Heat → Baking |
| 7 | **Main Ingredient** | Primary ingredient | 2 levels | Protein → Chicken |
| 8 | **Season/Holiday** | Temporal context | Flat | Spring, Thanksgiving |
| 9 | **Planning** | Meal prep strategy | Flat | Make-Ahead, Freezer |
| 10 | **Characteristics** | Descriptors | Flat | Comfort Food, Spicy |
| 11 | **Other** | Uncategorized | Flat | Catchall |

**Changes from Current**:
- ✅ Added: Dish Type, Planning, Characteristics
- ❌ Removed: Difficulty (now a database field)
- ⚠️ Modified: Time → Planning (for strategy, not duration)

---

## 10. Next Steps

### Immediate (This Week)
1. Read full report: `docs/research/RECIPE_TAG_TAXONOMY_RESEARCH.md`
2. Review Phase 1 implementation checklist
3. Schedule 4-hour sprint to implement category refinements
4. Update project documentation

### This Month
1. Implement Phase 1 (category refinement)
2. Test new categories with sample recipes
3. Gather user feedback on changes
4. Plan Phase 2 (difficulty migration)

### This Quarter
1. Complete all 4 phases
2. Monitor analytics and usage patterns
3. Iterate based on data
4. Document lessons learned

---

## Conclusion

Our semantic tag system is **well-designed and production-ready**. The recommended improvements are refinements, not a redesign. Focus on:

1. ✅ **Add 3 new categories** (Dish Type, Planning, Characteristics) - Non-breaking
2. ⚠️ **Move Difficulty to field** - Breaking but necessary
3. ✅ **Clean up time tags** - Use database fields for precision
4. ✅ **Add missing tags** - Pescatarian, Egg-Free, Sous Vide
5. 🔄 **Monitor and iterate** - Let usage data guide future decisions

**Total Effort**: 2-3 days of focused work + ongoing maintenance

**Expected Impact**: Better discoverability, clearer organization, improved SEO

---

**Questions?** See full report or contact the development team.
