# Recipe Manager - Recent Updates

## 1. UUID Migration for Recipe IDs

The recipe IDs have been migrated from serial integers to UUIDs for better scalability and uniqueness.

### Migration Steps:
1. **Backup your database first!**
2. Run the migration script:
   ```bash
   npx tsx scripts/run-uuid-migration.ts
   ```

### Changes Made:
- Updated database schema to use `text` type with UUID generation
- Modified all server actions to accept string IDs instead of numbers
- Updated all components and pages to work with UUID strings

## 2. Markdown Import/Export

### Features:
- **Import recipes from Markdown files** - Parse markdown files with recipe content
- **Export recipes as Markdown** - Download recipes in markdown format for sharing
- **Batch import support** - Import multiple markdown files at once

### Markdown Format:
```markdown
---
title: Recipe Name
description: Brief description
prepTime: 15
cookTime: 30
servings: 4
difficulty: easy
cuisine: Italian
tags: [vegetarian, quick]
---

## Ingredients
- 1 cup flour
- 2 eggs

## Instructions
1. First step
2. Second step
```

## 3. PDF Export

### Features:
- **Export recipes as PDF** - Professional PDF generation with formatted layout
- **Clean formatting** - Proper sections for ingredients, instructions, nutrition
- **Automatic page breaks** - Content flows naturally across pages

### How to Use:
1. Navigate to any recipe detail page
2. Click the "Export" dropdown button
3. Choose "Export as PDF" or "Export as Markdown"

## 4. 30+ Diverse System Recipes

### New System Recipes Added:
Over 30 curated recipes from various cuisines have been added as system recipes:

- **French**: Coq au Vin, French Onion Soup
- **Italian**: Osso Buco, Homemade Gnocchi
- **Indian**: Chicken Biryani, Palak Paneer, Masala Dosa
- **Chinese**: Peking Duck, Mapo Tofu, Xiaolongbao
- **Korean**: Bibimbap, Korean Fried Chicken
- **Mexican**: Mole Negro, Cochinita Pibil
- **Greek**: Moussaka, Spanakopita
- **Spanish**: Paella Valenciana, Gazpacho
- **Thai**: Pad Thai, Tom Yum Goong
- **Japanese**: Tonkotsu Ramen, Chirashi Bowl
- **Vietnamese**: Pho Bo, Banh Xeo
- **Middle Eastern**: Lamb Shawarma, Falafel
- **Moroccan**: Tagine of Lamb with Apricots
- **Brazilian**: Feijoada
- **Peruvian**: Ceviche
- **Ethiopian**: Doro Wat
- **Russian**: Beef Stroganoff

### To Add System Recipes:
```bash
npx tsx scripts/populate-more-system-recipes.ts
```

## 5. Technical Improvements

### Database Schema Updates:
- Recipe IDs now use UUIDs (`crypto.randomUUID()`)
- Better support for distributed systems
- Improved data integrity

### Export/Import Actions:
- `/src/app/actions/recipe-import.ts` - Handles markdown import
- `/src/app/actions/recipe-export.ts` - Handles markdown and PDF export
- `/src/lib/utils/markdown-parser.ts` - Parses markdown to recipe format
- `/src/lib/utils/markdown-formatter.ts` - Formats recipes to markdown

### Component Updates:
- Recipe pages now support UUID parameters
- Export dropdown with multiple format options
- Improved error handling for import/export

## Installation of New Dependencies

```bash
# Already installed
pnpm add jspdf jszip gray-matter
```

## Migration Notes

### Before Migration:
1. **Backup your database**
2. Test in development environment first
3. Ensure all users are notified of potential downtime

### After Migration:
1. All existing recipe URLs will change (from `/recipes/123` to `/recipes/uuid-string`)
2. Bookmarks to specific recipes will need to be updated
3. Any external integrations using recipe IDs will need updates

## Usage Examples

### Import Markdown Recipe:
```typescript
import { importRecipeFromMarkdown } from '@/app/actions/recipe-import';

const markdown = `# Pasta Carbonara...`;
const result = await importRecipeFromMarkdown(markdown);
```

### Export as PDF:
```typescript
import { exportRecipeAsPDF } from '@/app/actions/recipe-export';

const result = await exportRecipeAsPDF(recipeId);
// result.content is base64 encoded PDF
```

## Testing Checklist

- [ ] UUID migration runs successfully
- [ ] Can create new recipes with UUID IDs
- [ ] Can view and edit existing recipes
- [ ] Markdown import works correctly
- [ ] Markdown export produces valid files
- [ ] PDF export generates readable documents
- [ ] System recipes are populated correctly
- [ ] All recipe operations work with new UUID format