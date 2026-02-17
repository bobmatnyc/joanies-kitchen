# Recipe Manager - Seeding Scripts

This directory contains database seeding scripts for populating the Recipe Manager with various types of data.

## Quick Reference

### Essential Seeding Scripts

```bash
# 1. Seed common ingredients and kitchen tools
pnpm tsx scripts/seed-common-ingredients-tools.ts

# 2. Seed system/curated recipes
pnpm tsx scripts/seed-system-recipes.ts

# 3. Seed synthetic user collections and meal plans
pnpm tsx scripts/seed-synthetic-collections-meals.ts

# 4. Import recipes from external sources (optional)
pnpm tsx scripts/import-themealdb.ts
pnpm tsx scripts/import-open-recipe-db.ts
```

## Script Descriptions

### Core Seeding

#### `seed-common-ingredients-tools.ts`
Seeds the database with:
- 50+ common ingredients (produce, meats, spices, etc.)
- 40+ essential kitchen tools (knives, cookware, utensils)
- Used for recipe normalization and meal planning

**Usage**:
```bash
pnpm tsx scripts/seed-common-ingredients-tools.ts
```

**Output**: Ingredients and tools reference data

---

#### `seed-synthetic-collections-meals.ts` ⭐ NEW
Seeds realistic demo data for testing the meal pairing system:
- 4 synthetic user profiles with distinct personas
- 12 themed recipe collections (2-3 per user)
- 8 meal plans with multiple recipes (1-2 per user)

**Features**:
- Intelligent recipe matching based on cuisine, tags, difficulty
- Prevents duplicate recipes in meal plans
- Fully idempotent (safe to run multiple times)
- Comprehensive logging and error handling

**Prerequisites**: Must have recipes in database (run `seed-system-recipes.ts` first)

**Usage**:
```bash
pnpm tsx scripts/seed-synthetic-collections-meals.ts
```

**Documentation**: See `README-SYNTHETIC-DATA.md` for detailed information

**Output**:
```
✅ Created 4 synthetic user profiles
✅ Created 8 collections
✅ Created 8 meal plans
```

---

#### `seed-system-recipes.ts`
Seeds curated system recipes for the "Discover" page:
- High-quality, well-tested recipes
- Marked as `is_system_recipe: true`
- Visible to all users

**Usage**:
```bash
pnpm tsx scripts/seed-system-recipes.ts
```

---

### Recipe Import Scripts

#### `import-themealdb.ts`
Imports recipes from [TheMealDB API](https://www.themealdb.com/):
- Free, public recipe database
- 500+ recipes across various cuisines
- Includes images and detailed instructions

**Usage**:
```bash
pnpm tsx scripts/import-themealdb.ts
```

---

#### `import-open-recipe-db.ts`
Imports recipes from Open Recipe Database:
- Community-contributed recipes
- Structured recipe data
- Nutritional information

**Usage**:
```bash
pnpm tsx scripts/import-open-recipe-db.ts
```

---

### Utility Scripts

#### `seed-slideshow-photos.ts`
Seeds slideshow photos for the home page hero section.

**Usage**:
```bash
pnpm tsx scripts/seed-slideshow-photos.ts
```

---

#### `seed-hero-backgrounds.ts`
Seeds hero background images for various pages.

**Usage**:
```bash
pnpm tsx scripts/seed-hero-backgrounds.ts
```

---

## Seeding Order

For a fresh database, follow this order:

1. **Common Data** (ingredients, tools)
   ```bash
   pnpm tsx scripts/seed-common-ingredients-tools.ts
   ```

2. **Recipes** (system recipes or imports)
   ```bash
   pnpm tsx scripts/seed-system-recipes.ts
   # OR
   pnpm tsx scripts/import-themealdb.ts
   ```

3. **Demo Data** (synthetic users, collections, meal plans)
   ```bash
   pnpm tsx scripts/seed-synthetic-collections-meals.ts
   ```

4. **UI Assets** (optional)
   ```bash
   pnpm tsx scripts/seed-slideshow-photos.ts
   pnpm tsx scripts/seed-hero-backgrounds.ts
   ```

## Environment Requirements

All scripts require:
- Valid `DATABASE_URL` in `.env.local`
- Database schema pushed (run `pnpm db:push`)

Some scripts may require:
- `OPENROUTER_API_KEY` (for AI-generated content)
- External API keys (for recipe imports)

## Script Features

### Idempotency
Most scripts are idempotent (safe to run multiple times):
- ✅ `seed-common-ingredients-tools.ts` - Uses `onConflictDoNothing()`
- ✅ `seed-synthetic-collections-meals.ts` - Checks for existing data
- ⚠️ `import-themealdb.ts` - May create duplicates
- ⚠️ `import-open-recipe-db.ts` - May create duplicates

### Error Handling
All scripts include:
- Try-catch blocks around database operations
- Detailed error logging
- Progress indicators
- Summary statistics at completion

## Troubleshooting

### Common Issues

#### "No recipes found"
**Cause**: Recipe seeding hasn't been run

**Solution**:
```bash
pnpm tsx scripts/seed-system-recipes.ts
```

#### "Database connection failed"
**Cause**: Invalid `DATABASE_URL`

**Solution**: Check `.env.local` for valid PostgreSQL connection string

#### "Collections have no recipes"
**Cause**: Not enough recipes matching filter criteria

**Solution**:
- Import more recipes from external sources
- Adjust collection filter criteria in script
- Lower min/max recipe thresholds

### Debugging

Enable detailed logging:
```typescript
// In any script
console.log('Debug info:', someVariable);
```

Check database directly:
```bash
pnpm db:studio
```

## Contributing

### Adding New Seeding Scripts

1. Create script in `scripts/` directory
2. Follow naming convention: `seed-*.ts` or `import-*.ts`
3. Include:
   - Dotenv config: `import 'dotenv/config';`
   - Database connection: `import { db } from '../src/lib/db';`
   - Progress logging
   - Error handling
   - Summary statistics
4. Document in this README
5. Test idempotency if applicable

### Script Template

```typescript
import 'dotenv/config';
import { db } from '../src/lib/db';
import { someTable } from '../src/lib/db/schema';

async function main() {
  console.log('🌱 Seeding [Description]');
  console.log('=' .repeat(50));

  let count = 0;

  try {
    // Your seeding logic here

    console.log(`\n✅ Seeded ${count} items`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main()
  .then(() => {
    console.log('✨ Seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
```

## Related Documentation

- **Synthetic Data**: `README-SYNTHETIC-DATA.md` - Detailed guide for collections and meal plans
- **Database Schema**: `../src/lib/db/schema.ts` - Main database schema
- **User Discovery Schema**: `../src/lib/db/user-discovery-schema.ts` - Collections and profiles
- **Meals Schema**: `../src/lib/db/meals-schema.ts` - Meal plans and recipes

## Support

For issues or questions:
1. Check script output for error messages
2. Verify database connection and schema
3. Review related documentation files
4. Check GitHub issues for known problems

---

**Last Updated**: 2025-10-19
**Total Scripts**: 8
**Database Schema Version**: 0.65.0 (Meal Pairing System)
