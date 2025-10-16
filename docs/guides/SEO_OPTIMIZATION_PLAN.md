# SEO Optimization Plan - Joanie's Kitchen

**Version**: 0.75.0
**Target**: February 2025
**Estimated Effort**: 2 weeks
**Priority**: HIGH - Critical for organic discovery

---

## Overview

Transform recipe URLs from generic UUIDs to semantic, SEO-friendly slugs using LLM-powered generation. Implement comprehensive SEO infrastructure for maximum discoverability.

### Current State
- URLs: `/recipes/07252052-8cc0-4797-9b7c-accb349cf22b`
- No meta descriptions
- Minimal structured data
- Generic Open Graph tags

### Target State
- URLs: `/recipes/grandmas-chocolate-chip-cookies`
- LLM-generated meta descriptions
- Full Recipe schema (JSON-LD)
- Rich social media previews
- 95+ Lighthouse SEO score

---

## Phase 1: URL Slug Generation (Week 1)

### 1.1 Database Schema Changes

**Migration Script**: `scripts/migrations/add-recipe-slugs.ts`

```sql
-- Add slug column
ALTER TABLE recipes
ADD COLUMN slug VARCHAR(255) UNIQUE;

-- Create index for fast slug lookups
CREATE INDEX idx_recipes_slug ON recipes(slug);

-- Create index for slug conflict resolution
CREATE INDEX idx_recipes_slug_prefix ON recipes(slug text_pattern_ops);
```

**Drizzle Schema Update** (`src/lib/db/schema.ts`):
```typescript
export const recipes = pgTable('recipes', {
  // ... existing fields
  slug: varchar('slug', { length: 255 }).unique(),
}, (table) => ({
  // ... existing indexes
  slugIdx: index('idx_recipes_slug').on(table.slug),
}));
```

### 1.2 Slug Generation Algorithm

**Location**: `src/lib/seo/slug-generator.ts`

**LLM-Powered Slug Generation**:
```typescript
import Anthropic from '@anthropic-ai/sdk';

interface SlugGenerationResult {
  slug: string;
  alternatives: string[];
  confidence: 'high' | 'medium' | 'low';
}

export async function generateRecipeSlug(
  recipeName: string,
  description?: string,
  cuisine?: string
): Promise<SlugGenerationResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `Generate an SEO-friendly URL slug for this recipe:

Recipe Name: ${recipeName}
${description ? `Description: ${description}` : ''}
${cuisine ? `Cuisine: ${cuisine}` : ''}

Requirements:
1. Use kebab-case (lowercase with hyphens)
2. Keep it concise (3-6 words max)
3. Include key ingredients or cooking method if relevant
4. Remove unnecessary words (a, the, with, etc.)
5. Make it memorable and descriptive
6. Avoid special characters or numbers
7. Provide 3 alternatives

Examples:
- "Grandma's Chocolate Chip Cookies" → "grandmas-chocolate-chip-cookies"
- "Spicy Thai Basil Chicken" → "spicy-thai-basil-chicken"
- "Classic Italian Carbonara Pasta" → "classic-carbonara-pasta"

Return JSON format:
{
  "primary": "main-slug-here",
  "alternatives": ["alt-1", "alt-2", "alt-3"],
  "confidence": "high|medium|low"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4.5-20250929',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  const result = JSON.parse(response.content[0].text);

  return {
    slug: result.primary,
    alternatives: result.alternatives,
    confidence: result.confidence
  };
}

export async function ensureUniqueSlug(
  baseSlug: string,
  recipeId?: string
): Promise<string> {
  const db = await import('@/lib/db');

  // Check if slug exists (excluding current recipe if updating)
  const existing = await db.default
    .select({ id: recipes.id })
    .from(recipes)
    .where(
      recipeId
        ? and(eq(recipes.slug, baseSlug), ne(recipes.id, recipeId))
        : eq(recipes.slug, baseSlug)
    )
    .limit(1);

  if (existing.length === 0) {
    return baseSlug;
  }

  // Try alternatives with numeric suffix
  for (let i = 2; i <= 10; i++) {
    const candidate = `${baseSlug}-${i}`;
    const check = await db.default
      .select({ id: recipes.id })
      .from(recipes)
      .where(
        recipeId
          ? and(eq(recipes.slug, candidate), ne(recipes.id, recipeId))
          : eq(recipes.slug, candidate)
      )
      .limit(1);

    if (check.length === 0) {
      return candidate;
    }
  }

  // Fallback: append UUID segment
  const uuid = recipeId || crypto.randomUUID();
  return `${baseSlug}-${uuid.slice(0, 8)}`;
}
```

### 1.3 Bulk Slug Generation Script

**Location**: `scripts/generate-recipe-slugs.ts`

```typescript
/**
 * Generate SEO-friendly slugs for all recipes
 *
 * Usage:
 * - All recipes: npx tsx scripts/generate-recipe-slugs.ts
 * - Specific recipe: npx tsx scripts/generate-recipe-slugs.ts --id [recipe-id]
 * - Dry run: npx tsx scripts/generate-recipe-slugs.ts --dry-run
 */

import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { generateRecipeSlug, ensureUniqueSlug } from '../src/lib/seo/slug-generator';
import { isNull } from 'drizzle-orm';

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const recipeId = args.find(arg => arg.startsWith('--id='))?.split('=')[1];

  console.log('🔍 Generating recipe slugs...\n');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  // Get recipes without slugs
  const recipesToProcess = recipeId
    ? await db.select().from(recipes).where(eq(recipes.id, recipeId))
    : await db.select().from(recipes).where(isNull(recipes.slug));

  console.log(`Found ${recipesToProcess.length} recipes to process\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const [index, recipe] of recipesToProcess.entries()) {
    const progress = `[${index + 1}/${recipesToProcess.length}]`;

    try {
      console.log(`${progress} Processing: ${recipe.name}`);

      // Generate slug using LLM
      const result = await generateRecipeSlug(
        recipe.name,
        recipe.description || undefined,
        recipe.cuisine || undefined
      );

      console.log(`  Generated: ${result.slug} (${result.confidence} confidence)`);

      // Ensure uniqueness
      const uniqueSlug = await ensureUniqueSlug(result.slug, recipe.id);

      if (uniqueSlug !== result.slug) {
        console.log(`  Adjusted to: ${uniqueSlug} (uniqueness conflict)`);
      }

      // Update database (unless dry run)
      if (!dryRun) {
        await db
          .update(recipes)
          .set({ slug: uniqueSlug })
          .where(eq(recipes.id, recipe.id));

        console.log(`  ✅ Updated: /recipes/${uniqueSlug}`);
      } else {
        console.log(`  [DRY RUN] Would set: /recipes/${uniqueSlug}`);
      }

      successCount++;

      // Rate limiting: 2 seconds between LLM calls
      if (index < recipesToProcess.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      console.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      errorCount++;
    }

    console.log('');
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('📊 SLUG GENERATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Successful: ${successCount}/${recipesToProcess.length}`);
  console.log(`❌ Failed: ${errorCount}/${recipesToProcess.length}`);
  console.log(`💰 Total LLM cost: ~$${(successCount * 0.001).toFixed(3)} (Claude Sonnet 4.5)`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN: No changes were made to the database');
    console.log('Run without --dry-run to apply changes');
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
```

### 1.4 URL Migration & Redirects

**Location**: `src/middleware.ts` (add redirect logic)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for old UUID-based recipe URLs
  const uuidMatch = pathname.match(/^\/recipes\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);

  if (uuidMatch) {
    const uuid = uuidMatch[1];

    // Look up recipe by UUID and get its slug
    const recipe = await db
      .select({ slug: recipes.slug })
      .from(recipes)
      .where(eq(recipes.id, uuid))
      .limit(1);

    if (recipe[0]?.slug) {
      // 301 permanent redirect to slug-based URL
      const url = request.nextUrl.clone();
      url.pathname = `/recipes/${recipe[0].slug}`;
      return NextResponse.redirect(url, 301);
    }
  }

  // Continue with Clerk middleware for other routes
  // ... existing Clerk middleware logic
}

export const config = {
  matcher: [
    '/recipes/:path*',
    // ... other matchers
  ],
};
```

---

## Phase 2: Meta Tags & Structured Data (Week 1.5)

### 2.1 Dynamic Meta Descriptions

**Location**: `src/app/recipes/[slug]/page.tsx`

```typescript
import type { Metadata } from 'next';
import { generateMetaDescription } from '@/lib/seo/meta-generator';

export async function generateMetadata({
  params
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const recipe = await getRecipeBySlug(params.slug);

  if (!recipe) {
    return {
      title: 'Recipe Not Found',
      description: 'The recipe you are looking for could not be found.'
    };
  }

  // Generate SEO-optimized meta description
  const description = await generateMetaDescription(recipe);

  return {
    title: `${recipe.name} | Joanie's Kitchen`,
    description,
    keywords: [
      recipe.cuisine,
      recipe.difficulty,
      ...recipe.tags,
      'recipe',
      'cooking',
      'homemade'
    ].filter(Boolean).join(', '),

    // Open Graph
    openGraph: {
      title: recipe.name,
      description,
      type: 'article',
      url: `https://joanies-kitchen.com/recipes/${recipe.slug}`,
      images: recipe.images?.[0] ? [{
        url: recipe.images[0],
        width: 1200,
        height: 630,
        alt: recipe.name
      }] : [],
      siteName: 'Joanie\'s Kitchen',
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: recipe.name,
      description,
      images: recipe.images?.[0] || [],
    },

    // Canonical URL
    alternates: {
      canonical: `https://joanies-kitchen.com/recipes/${recipe.slug}`
    },
  };
}
```

**LLM Meta Description Generator** (`src/lib/seo/meta-generator.ts`):

```typescript
import Anthropic from '@anthropic-ai/sdk';

export async function generateMetaDescription(recipe: any): Promise<string> {
  // Use existing description if good quality
  if (recipe.description && recipe.description.length >= 120 && recipe.description.length <= 160) {
    return recipe.description;
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  const prompt = `Write a compelling SEO meta description (120-160 characters) for this recipe:

Recipe: ${recipe.name}
Cuisine: ${recipe.cuisine || 'N/A'}
Difficulty: ${recipe.difficulty || 'N/A'}
Prep Time: ${recipe.prep_time || 'N/A'} minutes
Cook Time: ${recipe.cook_time || 'N/A'} minutes
Tags: ${recipe.tags?.join(', ') || 'N/A'}

Description should:
1. Be 120-160 characters (strict limit)
2. Include key ingredients or cooking method
3. Highlight what makes it special
4. Include a call-to-action
5. Be engaging and descriptive

Examples:
- "Learn to make authentic Thai basil chicken with aromatic spices in just 30 minutes. Perfect for busy weeknights!"
- "Classic Italian carbonara with crispy pancetta and creamy sauce. Simple ingredients, restaurant-quality results!"

Return ONLY the meta description text, nothing else.`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4.0-20250514', // Cheaper model for simple task
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: prompt
    }]
  });

  return response.content[0].text.trim();
}
```

### 2.2 JSON-LD Structured Data

**Location**: `src/components/seo/RecipeStructuredData.tsx`

```typescript
import type { Recipe } from '@/lib/db/schema';

interface RecipeStructuredDataProps {
  recipe: Recipe;
}

export function RecipeStructuredData({ recipe }: RecipeStructuredDataProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.name,
    description: recipe.description,
    image: recipe.images || [],
    author: {
      '@type': 'Person',
      name: 'Joanie',
    },
    datePublished: recipe.created_at,
    prepTime: `PT${recipe.prep_time}M`,
    cookTime: `PT${recipe.cook_time}M`,
    totalTime: `PT${(recipe.prep_time || 0) + (recipe.cook_time || 0)}M`,
    recipeYield: `${recipe.servings} servings`,
    recipeCategory: recipe.cuisine,
    recipeCuisine: recipe.cuisine,
    keywords: recipe.tags?.join(', '),
    recipeIngredient: recipe.ingredients,
    recipeInstructions: recipe.instructions?.map((instruction: string, index: number) => ({
      '@type': 'HowToStep',
      position: index + 1,
      text: instruction
    })),
    aggregateRating: recipe.system_rating ? {
      '@type': 'AggregateRating',
      ratingValue: recipe.system_rating,
      ratingCount: 1
    } : undefined,
    nutrition: recipe.nutrition_info ? {
      '@type': 'NutritionInformation',
      calories: recipe.nutrition_info.calories,
      proteinContent: recipe.nutrition_info.protein,
      fatContent: recipe.nutrition_info.fat,
      carbohydrateContent: recipe.nutrition_info.carbohydrates,
    } : undefined
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData)
      }}
    />
  );
}
```

---

## Phase 3: Sitemap & Performance (Week 2)

### 3.1 Dynamic Sitemap Generation

**Location**: `src/app/sitemap.ts`

```typescript
import { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { isNotNull } from 'drizzle-orm';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://joanies-kitchen.com';

  // Get all recipes with slugs
  const allRecipes = await db
    .select({
      slug: recipes.slug,
      updated_at: recipes.updated_at,
    })
    .from(recipes)
    .where(isNotNull(recipes.slug));

  const recipeUrls = allRecipes.map(recipe => ({
    url: `${baseUrl}/recipes/${recipe.slug}`,
    lastModified: recipe.updated_at,
    changeFrequency: 'monthly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/recipes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/recipes/top-50`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...recipeUrls,
  ];
}
```

### 3.2 Robots.txt

**Location**: `src/app/robots.ts`

```typescript
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: 'https://joanies-kitchen.com/sitemap.xml',
  };
}
```

---

## Testing & Validation

### SEO Testing Checklist

**Tools**:
- [ ] Google Rich Results Test (schema.org validation)
- [ ] Lighthouse SEO audit (95+ score)
- [ ] Google Search Console (index status)
- [ ] Meta tag validator
- [ ] Mobile-friendly test

**Validation Script**: `scripts/validate-seo.ts`

```typescript
import { db } from '../src/lib/db';
import { recipes } from '../src/lib/db/schema';
import { isNull, isNotNull } from 'drizzle-orm';

async function validateSEO() {
  console.log('🔍 SEO Validation Report\n');

  // Check slug coverage
  const totalRecipes = await db.select().from(recipes);
  const withSlugs = await db.select().from(recipes).where(isNotNull(recipes.slug));
  const slugCoverage = (withSlugs.length / totalRecipes.length) * 100;

  console.log(`Slug Coverage: ${slugCoverage.toFixed(1)}% (${withSlugs.length}/${totalRecipes.length})`);

  // Check for duplicate slugs
  const duplicates = await db
    .select({ slug: recipes.slug })
    .from(recipes)
    .where(isNotNull(recipes.slug))
    .groupBy(recipes.slug)
    .having(sql`COUNT(*) > 1`);

  if (duplicates.length > 0) {
    console.log(`❌ Duplicate slugs found: ${duplicates.length}`);
    duplicates.forEach(d => console.log(`   - ${d.slug}`));
  } else {
    console.log('✅ No duplicate slugs');
  }

  // Check meta descriptions
  const withDescriptions = await db
    .select()
    .from(recipes)
    .where(isNotNull(recipes.description));

  const descCoverage = (withDescriptions.length / totalRecipes.length) * 100;
  console.log(`Meta Descriptions: ${descCoverage.toFixed(1)}% (${withDescriptions.length}/${totalRecipes.length})`);

  // Check images
  const withImages = await db
    .select()
    .from(recipes)
    .where(sql`images IS NOT NULL AND images::jsonb != '[]'::jsonb`);

  const imageCoverage = (withImages.length / totalRecipes.length) * 100;
  console.log(`Images: ${imageCoverage.toFixed(1)}% (${withImages.length}/${totalRecipes.length})`);
}

validateSEO();
```

---

## Cost Estimation

**LLM API Costs** (Claude Sonnet 4.5):
- Slug generation: $0.001 per recipe
- Meta description: $0.0005 per recipe (Claude Haiku)
- Total for 3,276 recipes: ~$5

**Development Time**:
- Week 1: Database migration, slug generation algorithm, bulk script
- Week 1.5: Meta tags, structured data, redirects
- Week 2: Sitemap, robots.txt, testing, validation

**Total Estimated Cost**: $5 LLM + 2 weeks development time

---

## Success Metrics

### Pre-Implementation Baseline
- [ ] Current Lighthouse SEO score
- [ ] Current organic traffic (Google Analytics)
- [ ] Current Google Search Console impressions

### Post-Implementation Targets
- [ ] 95+ Lighthouse SEO score
- [ ] 100% recipes with semantic URLs
- [ ] 100% recipes with valid structured data
- [ ] All images with alt text
- [ ] Zero broken internal links
- [ ] <100ms Time to First Byte

### Long-Term Goals (3 months post-launch)
- [ ] 10x increase in organic impressions
- [ ] 50+ recipe pages indexed
- [ ] Rich result appearance in Google
- [ ] Featured snippets for key recipes

---

## Rollout Plan

### Phase 1: Development (Week 1)
1. Create slug generation algorithm
2. Write migration script
3. Test on 10 sample recipes
4. Review and adjust LLM prompts

### Phase 2: Bulk Generation (Week 1.5)
1. Generate slugs for all 3,276 recipes
2. Implement redirects from old URLs
3. Update all internal links
4. Test redirect functionality

### Phase 3: SEO Infrastructure (Week 2)
1. Add meta tags and structured data
2. Generate sitemap
3. Submit to Google Search Console
4. Monitor for errors

### Phase 4: Monitoring (Ongoing)
1. Track Lighthouse scores
2. Monitor Google Search Console
3. Fix any broken links
4. Update slugs for new recipes

---

## Rollback Plan

If issues arise:

1. **Database Rollback**:
   ```sql
   -- Revert slug column (if needed)
   ALTER TABLE recipes DROP COLUMN slug;
   ```

2. **Remove Redirects**: Comment out middleware redirect logic

3. **Revert to UUID URLs**: Update all Link components

4. **Monitoring**: Check for 404 errors, broken links

---

## References

- [Google Recipe Structured Data](https://developers.google.com/search/docs/appearance/structured-data/recipe)
- [Next.js Metadata API](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [Schema.org Recipe](https://schema.org/Recipe)
- [Anthropic API Documentation](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)

---

**Next Steps**: Review this plan and adjust priorities based on product roadmap.
