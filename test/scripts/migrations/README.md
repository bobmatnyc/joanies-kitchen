# Database Migrations

This directory contains database migration scripts for Joanie's Kitchen.

## Available Migrations

### 1. Add Recipe Moderation Fields
**File**: `add-moderation-fields.ts`
**Purpose**: Adds moderation workflow fields to recipes table
**Status**: Completed

```bash
# Run migration
npx tsx scripts/migrations/add-moderation-fields.ts

# Rollback
npx tsx scripts/migrations/add-moderation-fields.ts --rollback
```

### 2. Generate Meal Slugs
**File**: `generate-meal-slugs.ts`
**Purpose**: Generates missing slugs for meal records
**Status**: Ready to run

```bash
# Run migration
npx tsx scripts/migrations/generate-meal-slugs.ts

# Rollback (limited)
npx tsx scripts/migrations/generate-meal-slugs.ts --rollback
```

**What it does**:
- Finds meals with `slug IS NULL` or `slug = ''`
- Generates SEO-friendly slugs from meal names
- Handles duplicate conflicts with numbered suffixes
- Provides detailed summary report

**Example output**:
```
🔍 Checking for meals without slugs...
📊 Found 15 meals without slugs
✓ "Thanksgiving Dinner" → thanksgiving-dinner-2024
✓ "Christmas Eve Feast" → christmas-eve-feast-2024
💾 Updating 15 meals in database...
✅ MIGRATION COMPLETED SUCCESSFULLY!
```

See [MEAL_SLUG_MIGRATION.md](../../MEAL_SLUG_MIGRATION.md) for detailed documentation.

## Migration Best Practices

### Before Running

1. **Backup Database**: Always backup before running migrations
2. **Review Code**: Read the migration script to understand what it does
3. **Test Environment**: Run in development/staging first
4. **Check Prerequisites**: Verify database connection and permissions

### Running Migrations

```bash
# Standard pattern
npx tsx scripts/migrations/<migration-name>.ts

# With rollback support
npx tsx scripts/migrations/<migration-name>.ts --rollback
```

### After Running

1. **Verify Results**: Check the summary output
2. **Test Application**: Verify the changes work as expected
3. **Monitor Errors**: Watch for any issues in production
4. **Document Changes**: Update relevant documentation

## Migration Script Pattern

All migration scripts follow this structure:

```typescript
#!/usr/bin/env tsx
/**
 * Database Migration: <Name>
 *
 * Purpose: What this migration does
 * Schema Changes: What columns/tables are modified
 * Usage: How to run it
 */

async function migrate() {
  // 1. Identify records to update
  // 2. Generate/transform data
  // 3. Apply updates
  // 4. Verify results
  // 5. Provide summary
}

async function rollback() {
  // Reverse the migration (if possible)
}

// CLI argument parsing and execution
```

## Common Issues

### Database Connection Errors

**Error**: `Error: connect ECONNREFUSED`
**Solution**: Check `.env` file has valid `DATABASE_URL`

### Permission Errors

**Error**: `Permission denied`
**Solution**: Run `chmod +x scripts/migrations/<script>.ts`

### TypeScript Errors

**Error**: Module not found or type errors
**Solution**: Run `npm install` to ensure dependencies are installed

## Creating New Migrations

1. **Copy Template**: Use an existing migration as a template
2. **Follow Pattern**: Match the structure shown above
3. **Add Documentation**: Include inline comments and header docs
4. **Test Thoroughly**: Run in dev environment first
5. **Update README**: Add entry to this file

## Migration History

| Date | Migration | Status | Notes |
|------|-----------|--------|-------|
| 2024-10-XX | Add Moderation Fields | ✅ Complete | Recipe moderation workflow |
| 2024-11-01 | Generate Meal Slugs | 🆕 Ready | Fix meal slug routing issues |

## Related Documentation

- [MEAL_SLUG_MIGRATION.md](../../MEAL_SLUG_MIGRATION.md) - Detailed meal slug migration guide
- [RECIPE_MODERATION_MIGRATION.md](../../RECIPE_MODERATION_MIGRATION.md) - Recipe moderation setup
- [Database Schema](../../src/lib/db/schema.ts) - Current database schema
