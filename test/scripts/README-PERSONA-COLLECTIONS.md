# Persona Collections Generator

## Overview

This script generates 100+ themed public collections for the 47 synthetic user personas. Collections are curated using the tag-based ontology system to ensure recipe relevance and are automatically assigned to appropriate personas based on their archetypes and characteristics.

## Features

- **100+ Collection Templates**: Diverse themes covering cuisines, dietary needs, occasions, and skill levels
- **Tag-Based Matching**: Uses the tag ontology system to find relevant recipes
- **Persona-Appropriate Assignment**: Collections matched to persona archetypes
- **10-20 Recipes per Collection**: Curated selection of relevant recipes
- **Public Visibility**: All collections marked `is_public = true` for discovery
- **Idempotent**: Safe to run multiple times without creating duplicates

## Usage

### Prerequisites

1. Ensure personas exist in the database (created via persona generation scripts)
2. Ensure recipes exist with proper tags in the database
3. Database connection configured in `.env.local`

### Running the Script

```bash
# From project root
pnpm tsx scripts/generate-persona-collections.ts
```

### Expected Output

```
🎨 Generating Public Collections for 47 Personas

======================================================================
Total Templates: 75+
Total Personas: 47
======================================================================

📦 Processing Template: "Classic Italian Comfort Food"
  Found 18 matching recipes
  Found 3 matching personas
  ✅ Created "Classic Italian Comfort Food" for maggiebakes with 18 recipes
  ✅ Created "Classic Italian Comfort Food" for sophiagourmet with 18 recipes
  ...

======================================================================
📊 FINAL STATISTICS
======================================================================
Total Collections Created: 150
Unique Recipes Used: 450
Personas with Collections: 47/47
======================================================================

✨ Collection generation complete!
```

## Collection Categories

### Cuisine-Based Collections
- **Italian**: Classic comfort food, pasta perfection, desserts
- **Mediterranean**: Fresh & healthy, Greek island favorites
- **Mexican**: Street food, comfort classics, quick weeknight dinners
- **Asian**: Japanese, Thai, Indian, Korean, Vietnamese
- **French**: Bistro classics, pastry & baking
- **American**: Comfort food, BBQ & grilling, Southern soul food

### Dietary Collections
- **Plant-Based**: Vegan favorites, vegetarian comfort classics
- **Special Diets**: Gluten-free, low-carb, high-protein
- **Health-Focused**: Clean eating, anti-inflammatory, energy-boosting

### Meal Type Collections
- **Breakfast & Brunch**: Breakfast champions, brunch delights
- **Lunch**: Quick solutions, meal prep ideas
- **Dinner**: Weeknight winners, date night dinners
- **Snacks & Appetizers**: Party starters, healthy snacks
- **Desserts**: Chocolate creations, baking basics, no-bake desserts

### Occasion Collections
- **Holidays**: Feast collection, seasonal favorites
- **Entertaining**: Family gatherings, game day eats
- **Seasonal**: Summer BBQ, cozy winter warmers
- **Special Events**: Date night, holiday celebrations

### Skill Level Collections
- **Beginner**: Kitchen basics, 30-minute meals
- **Intermediate**: One-pot wonders, meal prep mastery
- **Advanced**: Advanced techniques, fancy plating

### Cooking Method Collections
- **Appliance-Specific**: Slow cooker, Instant Pot, air fryer
- **Technique-Focused**: Grilled, roasted, stir-fry, soup & stew

### Ingredient-Focused Collections
- **Proteins**: Chicken, beef, seafood
- **Plant-Based**: Vegetable forward, pasta paradise
- **Grains**: Rice & grain bowls, bread baking

### Budget Collections
- **Budget-Friendly**: Favorites, pantry staples
- **Student Cooking**: College budget cooking

## Collection Template Structure

Each collection template includes:

```typescript
{
  nameTemplate: string;           // Collection name
  description: string;            // 2-3 sentence description
  tagFilters: string[];          // Tags to match (case-insensitive)
  personaArchetypes: string[];   // Matching persona types
  minRecipes: number;            // Minimum recipes required
  maxRecipes: number;            // Maximum recipes to include
  difficultyFilter?: string;     // Optional difficulty constraint
  cuisineFilter?: string;        // Optional cuisine constraint
}
```

### Example Template

```typescript
{
  nameTemplate: "Classic Italian Comfort Food",
  description: "Hearty, soul-warming dishes from the heart of Italy...",
  tagFilters: ["italian", "comfort", "pasta"],
  personaArchetypes: ["Traditional Home Cook", "Gourmet Enthusiast"],
  minRecipes: 15,
  maxRecipes: 20,
  cuisineFilter: "Italian"
}
```

## Persona Archetype Matching

Collections are assigned to personas based on archetype matching:

| Persona Archetype | Collection Types |
|-------------------|------------------|
| **Traditional Home Cook** | Comfort food, family favorites, holiday feasts |
| **Gourmet Enthusiast** | Advanced techniques, fusion food, bistro classics |
| **Health Conscious** | Clean eating, plant-based, anti-inflammatory |
| **Baking Enthusiast** | Pastries, desserts, bread baking |
| **Plant-Based Cook** | Vegan, vegetarian, vegetable-forward |
| **Meal Prepper** | Meal prep mastery, freezer-friendly, lunch boxes |
| **Busy Parent** | Quick meals, one-pot wonders, weeknight dinners |
| **Foodie Explorer** | International cuisine, fusion, street food |
| **College Student** | Budget cooking, quick meals, basics |
| **Professional Chef** | Advanced techniques, restaurant-style, plating |
| **Budget Cook** | Budget-friendly, pantry staples, economical |
| **Senior Cook** | Traditional recipes, comfort food, holiday feasts |
| **International Cuisine Lover** | Global cuisines, authentic recipes, mezze |
| **Beginner Chef** | Kitchen basics, easy recipes, foundational skills |
| **Quick & Easy Specialist** | 30-minute meals, one-pot, stir-fries |

## Tag Matching Logic

The script uses **case-insensitive partial matching** on recipe tags:

```sql
WHERE LOWER(recipes.tags) LIKE LOWER('%italian%')
   OR LOWER(recipes.tags) LIKE LOWER('%comfort%')
   OR LOWER(recipes.tags) LIKE LOWER('%pasta%')
```

This ensures flexible matching while maintaining accuracy.

## Database Schema

### Collections Table
```sql
CREATE TABLE collections (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,           -- Clerk user ID (persona)
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,       -- URL-friendly
  description TEXT,
  cover_image_url TEXT,
  recipe_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_recipe_added_at TIMESTAMP,
  UNIQUE(user_id, slug)
);
```

### Collection Recipes Table
```sql
CREATE TABLE collection_recipes (
  id UUID PRIMARY KEY,
  collection_id UUID NOT NULL,
  recipe_id TEXT NOT NULL,
  position INTEGER DEFAULT 0,       -- Manual ordering
  personal_note TEXT,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(collection_id, recipe_id)
);
```

## Idempotency

The script is **idempotent** and can be safely run multiple times:

- Checks for existing collections before creating duplicates
- Uses `UNIQUE(user_id, slug)` constraint to prevent duplicates
- Skips templates with insufficient matching recipes
- Logs all actions for transparency

## Error Handling

The script handles errors gracefully:

- **Insufficient Recipes**: Skips templates that don't meet minimum recipe count
- **No Matching Personas**: Skips templates without appropriate persona matches
- **Duplicate Collections**: Skips creation if collection already exists
- **Database Errors**: Logs errors and continues processing other templates

## Customization

### Adding New Collection Templates

Add new templates to the `collectionTemplates` array:

```typescript
{
  nameTemplate: "Your Collection Name",
  description: "Compelling description...",
  tagFilters: ["tag1", "tag2"],
  personaArchetypes: ["Persona Type"],
  minRecipes: 10,
  maxRecipes: 15,
}
```

### Modifying Tag Filters

Update tag filters to match your recipe taxonomy:

```typescript
tagFilters: ["cuisine.italian", "difficulty.easy", "meal-type.dinner"]
```

### Adjusting Recipe Counts

Modify `minRecipes` and `maxRecipes` per template:

```typescript
minRecipes: 8,   // Minimum viable collection
maxRecipes: 25,  // Maximum diversity
```

## Troubleshooting

### "Only found X/Y recipes (skipping)"

**Cause**: Not enough recipes match the tag filters.

**Solution**:
- Adjust tag filters to be less restrictive
- Lower `minRecipes` threshold
- Add more recipes to the database with appropriate tags

### "No matching personas found"

**Cause**: No personas match the specified archetypes.

**Solution**:
- Verify persona archetypes in `personas.json`
- Update `personaArchetypes` in template
- Add more persona types to the template

### "Collection already exists"

**Cause**: Collection with same slug already exists for user.

**Solution**:
- This is normal idempotent behavior
- Delete existing collections if you want to regenerate
- Modify collection name to create a different slug

### Database Connection Errors

**Cause**: Database not accessible or credentials incorrect.

**Solution**:
- Verify `DATABASE_URL` in `.env.local`
- Check database is running
- Verify network connectivity

## Performance Considerations

- **Batching**: Script processes templates sequentially (not batched)
- **Query Optimization**: Uses indexed columns (`tags`, `is_public`)
- **Memory**: Loads personas into memory (minimal footprint)
- **Duration**: Expect 5-10 minutes for 100+ collections

## Future Enhancements

Potential improvements:

1. **Cover Image Generation**: Auto-generate collection cover images
2. **Batch Insertion**: Insert collection recipes in batches
3. **Advanced Tag Matching**: Use vector similarity for semantic matching
4. **Dynamic Templates**: Generate templates based on recipe corpus analysis
5. **Collection Analytics**: Track collection popularity and engagement
6. **Collaborative Collections**: Support multi-user collections
7. **Collection Versioning**: Track changes over time

## Related Scripts

- `scripts/generate-personas.ts` - Generate synthetic personas
- `scripts/populate-system-recipes.ts` - Populate recipe database
- `scripts/apply-schema-to-new-db.ts` - Database schema migration

## Support

For issues or questions:

1. Check script logs for error messages
2. Verify database schema matches expectations
3. Review persona and recipe data quality
4. Consult project documentation in `CLAUDE.md`

---

**Version**: 1.0.0
**Last Updated**: 2025-10-19
**Author**: Recipe Manager Team
