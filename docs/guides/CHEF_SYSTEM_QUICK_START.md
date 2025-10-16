# Chef System - Quick Start Guide

**Last Updated**: 2025-10-15

## 🚀 What's Been Implemented

### ✅ Phase 1: Backend Complete

All backend infrastructure is ready:

1. **Database Schema** - 3 new tables (chefs, chef_recipes, scraping_jobs)
2. **Firecrawl Integration** - Web scraping service
3. **AI Recipe Parser** - Claude Sonnet 4.5 + GPT-4o vision
4. **Server Actions** - Complete CRUD for chefs, scraping, AI uploads
5. **Database Migrations** - Applied successfully

### ⏳ Phase 2: UI Components (To Do)

Frontend components and pages need to be created.

---

## 📦 Installation & Setup

### 1. Environment Variables

Add to your `.env.local`:

```env
# Firecrawl API (Required for scraping)
FIRECRAWL_API_KEY=fc-your_key_here
```

Get your key from: https://www.firecrawl.dev/

### 2. Database Migration

Already applied! ✅

If you need to reapply:
```bash
pnpm db:push
```

### 3. Initialize Kenji López-Alt

Run the initialization script:

```bash
pnpm tsx scripts/init-kenji-alt.ts
```

This creates a verified chef profile for J. Kenji López-Alt.

---

## 🎯 Quick Usage Examples

### Example 1: Create a Chef (Admin Only)

```typescript
import { createChef } from '@/app/actions/chefs';

const result = await createChef({
  name: 'Gordon Ramsay',
  slug: 'gordon-ramsay',
  bio: 'British celebrity chef, restaurateur, and television personality.',
  website: 'https://www.gordonramsay.com',
  socialLinks: {
    instagram: '@gordongram',
    twitter: '@GordonRamsay',
  },
  specialties: ['french', 'fine-dining', 'british'],
  isVerified: true,
  isActive: true,
});

console.log(result.chef); // Chef profile created
```

### Example 2: Upload Recipe with AI

```typescript
import { uploadRecipeWithAI } from '@/app/actions/ai-upload';

// From text
const result = await uploadRecipeWithAI({
  text: `
    Chocolate Chip Cookies

    Ingredients:
    - 2 1/4 cups all-purpose flour
    - 1 tsp baking soda
    - 1 cup butter, softened
    - 3/4 cup granulated sugar
    - 2 eggs
    - 2 cups chocolate chips

    Instructions:
    1. Preheat oven to 375°F
    2. Mix dry ingredients
    3. Cream butter and sugar
    4. Add eggs, then dry ingredients
    5. Fold in chocolate chips
    6. Bake 9-11 minutes
  `
});

console.log(result.recipe); // Parsed and saved recipe
```

### Example 3: Scrape Chef Recipes

```typescript
import { startChefScraping } from '@/app/actions/chef-scraping';

// Start background scraping job
const result = await startChefScraping({
  chefId: 'chef-uuid-here',
  sourceUrl: 'https://www.seriouseats.com/recipes',
  limit: 50, // Max 50 recipes
  maxDepth: 2, // Follow links 2 levels deep
  includePaths: ['/recipes/'], // Only scrape recipe URLs
  excludePaths: ['/about/', '/contact/'],
});

console.log(result.job); // Job ID and status

// Check progress
import { getScrapingJobStatus } from '@/app/actions/chef-scraping';
const status = await getScrapingJobStatus(result.job.id);
console.log(status.job.status); // 'pending', 'running', 'completed', 'failed'
console.log(status.job.recipesScraped); // Count of recipes scraped
```

### Example 4: Get Chef with Recipes

```typescript
import { getChefBySlug } from '@/app/actions/chefs';

const result = await getChefBySlug('kenji-lopez-alt');

if (result.success) {
  console.log(result.chef.name); // "J. Kenji López-Alt"
  console.log(result.chef.recipes); // Array of recipes
  console.log(result.chef.recipeCount); // Total recipes
}
```

### Example 5: Search Chefs

```typescript
import { searchChefs } from '@/app/actions/chefs';

const result = await searchChefs('asian');

console.log(result.chefs); // Chefs with 'asian' in specialties or bio
```

---

## 🛠️ Available Server Actions

### Chef Actions (`src/app/actions/chefs.ts`)

#### Admin Only
- `createChef(data)` - Create chef profile
- `updateChef(id, data)` - Update chef
- `deleteChef(id)` - Delete chef
- `linkRecipeToChef({ chefId, recipeId, originalUrl })` - Link recipe
- `unlinkRecipeFromChef({ chefId, recipeId })` - Unlink recipe
- `getAllChefsAdmin()` - Get all including inactive

#### Public
- `getChefBySlug(slug)` - Get chef with recipes
- `getChefById(id)` - Get chef by ID
- `getAllChefs()` - Get all active chefs
- `searchChefs(query)` - Search chefs

### Scraping Actions (`src/app/actions/chef-scraping.ts`)

- `startChefScraping(params)` - Start scraping job (admin)
- `scrapeSingleRecipe({ chefId, url })` - Scrape one recipe (admin)
- `getScrapingJobStatus(jobId)` - Check job progress
- `getAllScrapingJobs()` - List all jobs (admin)
- `cancelScrapingJob(jobId)` - Cancel job (admin)

### AI Upload Actions (`src/app/actions/ai-upload.ts`)

- `uploadRecipeWithAI({ text?, images?, parseFromImage? })` - Parse and save
- `uploadRecipeFromUrl(url)` - Import from URL
- `previewRecipeParse(params)` - Preview without saving

---

## 📊 Database Tables

### Chefs Table

```sql
SELECT
  id,
  slug,
  name,
  display_name,
  bio,
  website,
  social_links,
  specialties,
  is_verified,
  is_active,
  recipe_count,
  created_at
FROM chefs;
```

### Chef Recipes (Junction Table)

```sql
SELECT
  cr.id,
  c.name as chef_name,
  r.name as recipe_name,
  cr.original_url,
  cr.scraped_at
FROM chef_recipes cr
JOIN chefs c ON c.id = cr.chef_id
JOIN recipes r ON r.id = cr.recipe_id;
```

### Scraping Jobs

```sql
SELECT
  id,
  status,
  source_url,
  recipes_scraped,
  recipes_failed,
  current_page,
  total_pages,
  started_at,
  completed_at
FROM scraping_jobs
ORDER BY created_at DESC;
```

---

## 🎨 Next Steps: UI Development

### Components Needed

1. **AIRecipeUploader.tsx**
   - Tabs: AI Upload / Detailed Form
   - Text input area
   - Image upload (drag & drop)
   - URL input
   - Preview parsed results
   - Save button

2. **ChefCard.tsx**
   - Chef avatar
   - Name and display name
   - Specialty badges
   - Recipe count
   - Verified badge
   - Link to profile

3. **ChefGrid.tsx**
   - Grid layout of chef cards
   - Filter by specialty
   - Sort by recipe count
   - Search input

4. **AdminChefForm.tsx**
   - Create/edit chef
   - All fields with validation
   - Social links inputs
   - Specialty multi-select
   - Image upload

5. **AdminScrapingPanel.tsx**
   - Start scraping form
   - Chef selector
   - URL input
   - Options (limit, depth, paths)
   - Job progress display
   - Cancel button

### Pages Needed

1. **/discover/chefs**
   - Grid of all chefs
   - Search and filters
   - Sort options

2. **/chef/[slug]**
   - Chef header (bio, links, etc.)
   - Recipe grid
   - Filter chef's recipes

3. **/admin/chefs**
   - List of all chefs
   - Create/edit/delete
   - Toggle active status

4. **/admin/scraping**
   - Active jobs list
   - Start new scraping job
   - View job details

5. **/recipes/new**
   - Update to include AI uploader
   - Tab switcher: AI / Detailed

---

## 🧪 Testing

### Manual Testing Checklist

Backend (Server Actions):
- [ ] Create chef profile
- [ ] Update chef profile
- [ ] Get chef by slug
- [ ] Search chefs
- [ ] Upload recipe with AI (text)
- [ ] Upload recipe with AI (image)
- [ ] Upload recipe from URL
- [ ] Start scraping job
- [ ] Check scraping progress
- [ ] Cancel scraping job

Database:
- [ ] Verify chef created
- [ ] Verify chef_recipes link
- [ ] Verify scraping_jobs tracking
- [ ] Verify recipe.chef_id set
- [ ] Verify recipe_count updates

---

## 🔒 Admin Access

To make a user admin:

1. Go to Clerk Dashboard
2. Find your user
3. Edit user metadata
4. Add: `{ "isAdmin": "true" }`
5. Save

Now that user can:
- Create/edit/delete chefs
- Start scraping jobs
- Link/unlink recipes

---

## 📝 File Locations

### Backend (✅ Complete)
```
src/lib/db/chef-schema.ts          # Database schema
src/lib/firecrawl.ts                # Firecrawl service
src/lib/ai/recipe-parser.ts         # AI parsing
src/app/actions/chefs.ts            # Chef CRUD
src/app/actions/chef-scraping.ts    # Scraping
src/app/actions/ai-upload.ts        # AI uploads
scripts/init-kenji-alt.ts           # Kenji initialization
```

### Frontend (⏳ To Do)
```
src/components/recipe/AIRecipeUploader.tsx
src/components/chef/ChefCard.tsx
src/components/chef/ChefGrid.tsx
src/components/chef/ChefHeader.tsx
src/components/admin/AdminChefForm.tsx
src/components/admin/AdminScrapingPanel.tsx
src/app/discover/chefs/page.tsx
src/app/chef/[slug]/page.tsx
src/app/admin/chefs/page.tsx
src/app/admin/scraping/page.tsx
```

---

## 💡 Tips

### For Scraping
- Test with small limits first (limit: 5)
- Use includePaths to filter URLs
- Exclude non-recipe pages (about, contact, etc.)
- Monitor jobs in database
- Small delays prevent rate limiting

### For AI Parsing
- Works best with well-formatted text
- Images require clear recipe text
- URLs must be publicly accessible
- Nutrition info may be estimated
- Preview before saving (use previewRecipeParse)

### For Chefs
- Slugs are auto-sanitized (lowercase, hyphens)
- Recipe count updates automatically
- Verified badge requires isVerified=true
- Social links are optional
- Specialties help with search

---

## 🎉 What You Can Do Right Now

1. **Initialize Kenji** (already done if you ran the script)
2. **Test AI Upload** in a server action or API route
3. **Query Chefs** via server actions
4. **Start Building UI** - All backend is ready!

---

**Questions?** Check the full implementation guide:
`docs/guides/CHEF_SYSTEM_IMPLEMENTATION.md`

