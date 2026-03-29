# Scraper Architecture Research
**Date**: 2026-03-29
**Project**: Joanies Kitchen

---

## 1. Complete Technical Summary of the Scraping Stack

### Architecture Overview

The scraping system is a multi-layer pipeline with two distinct approaches:

**Path A: Weekly Perplexity-based Discovery (primary, active)**
```
PM2 → standalone-scraper.ts → POST /api/recipes/scrape
  → crawlWeeklyRecipes() (recipe-crawl.ts)
    → Step 1: discoverWeeklyRecipes() via Perplexity AI (perplexity-discovery.ts)
    → Step 2: convertUrlToRecipe() via Firecrawl + Claude 3 Haiku (OpenRouter)
    → Step 3: validateRecipe() — rule-based scoring
    → Step 4: storeRecipeWithWeek() — DB insert + embedding
```

**Path B: Chef-Specific Scraping (one-off, SerpAPI + Firecrawl)**
```
scrape-chef-recipes.ts (manual run)
  → findRecipeUrls() via SerpAPI Google search
  → scrapeRecipe() via Firecrawl
  → insertRecipe() → DB insert + chefRecipes link
```

**Path C: Zero Waste Chef URL Harvesting (one-off utility)**
```
scrape-zero-waste-chef-urls.ts
  → Firecrawl scrapes zerowastechef.com/recipe-index/
  → Extracts, filters, deduplicates URLs
  → Outputs to tmp/zero-waste-chef-urls.txt (no DB insertion)
```

### Key Libraries and Services

| Service | Purpose | Key env var |
|---------|---------|-------------|
| Perplexity AI (`sonar` model) | Weekly recipe discovery (natural language search across the web) | `PERPLEXITY_API_KEY` |
| Firecrawl (`@mendable/firecrawl-js`) | JavaScript-rendered page scraping, markdown extraction | `FIRECRAWL_API_KEY` |
| SerpAPI (`serpapi`) | Google search for chef-specific recipe URLs | `SERPAPI_API_KEY` |
| OpenRouter → Claude 3 Haiku | AI extraction of structured recipe data from raw page content | via `getOpenRouterClient()` |
| `sentence-transformers/all-MiniLM-L6-v2` | 384-dim embeddings for semantic search | internal |

### PM2 Process Configuration (`ecosystem.config.js`)

Three managed processes:

| Process name | Script | Schedule |
|---|---|---|
| `recipe-dev` | `pnpm dev` (Next.js) | continuous |
| `recipe-prod` | `pnpm start` | continuous |
| `recipe-scraper` | `tsx scripts/standalone-scraper.ts` | continuous + cron restart every 6 hours |

The scraper runs every 60 minutes (`intervalMinutes: 60`), scraping weeks 0–4 (current week back 4 weeks), max 5 recipes per week, with `autoApprove: true`.

### Environment Variable Overrides for recipe-scraper

```
SCRAPER_WEEKS        comma-separated week offsets  (default: 0,1,2,3,4)
SCRAPER_MAX_RECIPES  max per week                  (default: 5)
SCRAPER_INTERVAL_MIN interval in minutes           (default: 60)
SCRAPER_AUTO_APPROVE set to 'false' to disable     (default: true)
SCRAPER_API_URL      Next.js app URL               (default: http://localhost:3001)
```

### Graceful Shutdown

Both `standalone-scraper.ts` and `continuous-scraper.ts` handle `SIGINT`/`SIGTERM`, print final totals, and exit cleanly.

---

## 2. Database Schema for Recipes and Chefs

### `recipes` table (src/lib/db/schema.ts)

| Column | Type | Notes |
|--------|------|-------|
| `id` | text (UUID) | PK, auto-generated |
| `user_id` | text | Clerk user ID; "system" for scraped |
| `chef_id` | uuid | FK → chefs.id (nullable) |
| `source_id` | uuid | FK → recipe_sources.id (nullable) |
| `name` | text | Recipe name |
| `description` | text | |
| `ingredients` | text | JSON array of strings |
| `instructions` | text | JSON array of strings |
| `prep_time` | integer | minutes |
| `cook_time` | integer | minutes |
| `servings` | integer | |
| `difficulty` | text | enum: easy/medium/hard |
| `cuisine` | text | |
| `tags` | text | JSON array of strings |
| `image_url` | text | deprecated (kept for compat) |
| `images` | text | JSON array of up to 6 URLs |
| `is_ai_generated` | boolean | default false |
| `is_public` | boolean | default false |
| `is_system_recipe` | boolean | default false |
| `is_meal_prep_friendly` | boolean | default false |
| `nutrition_info` | text | JSON |
| `model_used` | text | AI model for generation |
| `source` | text | Source URL |
| `license` | enum | recipe_license enum (default ALL_RIGHTS_RESERVED) |
| `search_query` | text | Query that found this recipe |
| `discovery_date` | timestamp | When scraped |
| `confidence_score` | decimal(3,2) | AI confidence 0.00–1.00 |
| `validation_model` | text | Model used for validation |
| `embedding_model` | text | Embedding model name |
| `discovery_week` | integer | ISO week number 1–52 |
| `discovery_year` | integer | Year discovered |
| `published_date` | timestamp | Original publication date from source |
| `system_rating` | decimal(2,1) | AI quality score 0.0–5.0 |
| `system_rating_reason` | text | Explanation of AI rating |
| `avg_user_rating` | decimal(2,1) | |
| `total_user_ratings` | integer | default 0 |
| `slug` | varchar(255) | SEO-friendly URL slug (unique) |
| `video_url` | text | Optional video tutorial URL |
| `resourcefulness_score` | integer | 1–5 waste-conscious scale |
| `waste_reduction_tags` | text | JSON array: uses-scraps, one-pot, flexible-ingredients, minimal-waste, uses-aging, seasonal |
| `scrap_utilization_notes` | text | Tips on using scraps/leftovers |
| `environmental_notes` | text | Environmental impact notes |
| `qa_status` | varchar(50) | pending/validated/flagged/fixed/needs_review |
| `qa_timestamp` | timestamp | |
| `qa_method` | varchar(100) | |
| `qa_confidence` | decimal(3,2) | |
| `moderation_status` | text | enum: pending/approved/rejected/flagged (default pending) |
| `like_count` | integer | denormalized social metric |
| `fork_count` | integer | |
| `collection_count` | integer | |
| `deleted_at` / `deleted_by` | timestamp / text | soft delete |
| `weight_score` | integer | dish heaviness 1–5 (meal pairing) |
| `richness_score` | integer | fat content 1–5 |
| `acidity_score` | integer | 1–5 |
| `sweetness_level` | text | enum: light/moderate/rich |
| `dominant_textures` | text | JSON array |
| `dominant_flavors` | text | JSON array |
| `serving_temperature` | text | enum: hot/cold/room |
| `instruction_metadata` | text | JSONB array of InstructionMetadata (AI step analysis) |

### `chefs` table (src/lib/db/chef-schema.ts)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `slug` | text | unique, URL-friendly |
| `source_id` | uuid | FK → recipe_sources.id (nullable) |
| `name` | text | |
| `display_name` | text | |
| `bio` | text | |
| `profile_image_url` | text | |
| `website` | text | |
| `social_links` | jsonb | instagram/twitter/youtube/tiktok/facebook |
| `specialties` | text[] | array e.g. ['asian', 'science'] |
| `is_verified` | boolean | default false |
| `is_active` | boolean | default true |
| `recipe_count` | integer | denormalized count |
| `latitude` / `longitude` | decimal | for map display |
| `location_city/state/country` | varchar | |
| `created_at` / `updated_at` | timestamp | |

### `chef_recipes` junction table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `chef_id` | uuid | FK → chefs.id (cascade delete) |
| `recipe_id` | text | FK → recipes.id (cascade delete) |
| `original_url` | text | Source URL from scraping |
| `scraped_at` | timestamp | |
| `created_at` | timestamp | |

Unique constraint: `(chef_id, recipe_id)`.

### `scraping_jobs` table

Tracks scraping operations: status (pending/running/completed/failed/cancelled), recipes_scraped, recipes_failed, total_pages, current_page, error, metadata (JSONB with crawl_id, estimated_time, user_agent).

---

## 3. Current Scraping Sources / Websites

### Weekly Discovery via Perplexity (primary)

Perplexity is instructed to search these trusted sources for weekly-published recipes:

- AllRecipes.com
- Food Network (foodnetwork.com)
- Serious Eats (seriouseats.com)
- Bon Appétit (bonappetit.com)
- Epicurious (epicurious.com)
- NYT Cooking (cooking.nytimes.com)
- Tasty (tasty.co)
- Simply Recipes (simplyrecipes.com)
- King Arthur Baking (kingarthurbaking.com)
- The Kitchn (thekitchn.com)
- Budget Bytes (budgetbytes.com)
- Minimalist Baker (minimalistbaker.com)
- Cookie and Kate (cookieandkate.com)

Perplexity uses natural language to find recipes published in a specific week date range and returns structured results (title, URL, snippet, publishedDate, source).

### Chef-Specific Scraping via SerpAPI (manual one-off)

`scrape-chef-recipes.ts` targets any chef in the `chefs` DB table that has `is_active = true`. It constructs Google search queries using the chef's name + specialties, targeting the chef's own website domain if available. Max 5 recipes per chef.

Excluded domains: pinterest.com, facebook.com, instagram.com, twitter.com, youtube.com, amazon.com, walmart.com, target.com.

### Zero Waste Chef (dedicated utility)

`scrape-zero-waste-chef-urls.ts` scrapes `zerowastechef.com/recipe-index/` (Anne-Marie Bonneau) and extracts URLs matching the pattern `zerowastechef.com/YYYY/MM/recipe-slug/`. Output is a text file only — no DB insertion. This is a URL harvesting helper, not an ingestion pipeline.

---

## 4. Rate Limiting and Deduplication Approach

### Rate Limiting

| Context | Delay |
|---------|-------|
| Between weeks in scraper cycle | 10 seconds |
| Between recipe processing in pipeline | 2 seconds |
| SerpAPI calls (chef scraper) | 1 second |
| Firecrawl calls (chef scraper) | 2 seconds |
| Scraper cycle interval | 60 minutes |

The scraper has a mutex-style `isRunning` boolean flag to prevent concurrent runs.

### Deduplication

**Chef scraper (`scrape-chef-recipes.ts`) — explicit dedup:**
1. URL exact match: checks `chef_recipes.original_url` for the URL.
2. Title similarity: Levenshtein distance with 85% threshold — checks all existing recipes for the same chef in the recipes table. If similarity > 0.85, treated as duplicate.

**Weekly pipeline (`crawlWeeklyRecipes`) — NO explicit dedup:**
The weekly pipeline (Perplexity → Firecrawl → Claude → DB) has no deduplication check. The same recipe URL can be stored multiple times if Perplexity returns it across different scraping runs. There is a `source` column in the recipes table that stores the URL, but no unique constraint or pre-insert check is performed.

**`recipe_embeddings` — one embedding per recipe:**
The `recipe_embeddings` table has a unique constraint on `recipe_id`, preventing duplicate embeddings for the same recipe row, but this does not prevent duplicate recipe rows.

---

## 5. What's Missing for Truly Autonomous Recipe-a-Day

### Critical Gaps

**1. No dedup in the main weekly pipeline**
The `crawlWeeklyRecipes()` function does not check if a URL or title already exists before inserting. Running the scraper hourly across overlapping week windows (0,1,2,3,4) will re-ingest the same recipes repeatedly. Need a URL uniqueness check (`SELECT 1 FROM recipes WHERE source = $url LIMIT 1`) before insertion.

**2. No daily scheduling granularity**
The current design scrapes "current week + 4 prior weeks" on a 60-minute cycle. For a recipe-a-day feature, you need a deterministic "feature recipe today" selection layer — either:
  - A cron job that marks one recipe per day as `featured_date = today`, or
  - A scheduled function that selects from the pool using `system_rating` + recency + zero-waste priority.

**3. No featured/scheduled recipe concept in the schema**
The schema has no `featured_at` timestamp, `scheduled_for` date, or `is_recipe_of_the_day` flag. There is no concept of a publication calendar.

**4. No image ingestion**
`downloadAndStoreImages()` in recipe-crawl.ts explicitly just returns external URLs as-is. Images are not uploaded to Vercel Blob or any CDN. If source images expire or disappear, recipe cards will have broken images.

**5. Moderation bottleneck**
All scraped recipes are inserted with `moderation_status: 'pending'`. There is no auto-approval path for system-scraped recipes in the final store step (the `autoApprove` flag skips the validation step but still inserts as `pending` moderation). A recipe-a-day pipeline would need either auto-approval for high-confidence recipes or an admin workflow to approve the daily queue.

**6. No content-based dedup (title/ingredient fingerprint)**
For the weekly pipeline, there is no semantic or fuzzy dedup. Two recipes with slightly different titles but identical ingredients/instructions can both be stored.

**7. `scrape-zero-waste-chef-urls.ts` does not insert into DB**
The Zero Waste Chef URL scraper only outputs a text file. There is no follow-on batch ingestion script that processes those URLs through the pipeline.

**8. Missing scheduling for chef recipes**
`scrape-chef-recipes.ts` is not wired into PM2 and has no cron schedule. It runs only manually.

### What Would Complete the Recipe-a-Day Stack

- A `featured_recipes` table or `scheduled_date` column on recipes
- Auto-approve logic for `is_system_recipe = true` + `confidence_score >= 0.8` recipes
- URL-level dedup check in `storeRecipeWithWeek()`
- A daily cron (separate PM2 app or Vercel Cron) that selects and marks one recipe per day
- Image download + Vercel Blob upload in `downloadAndStoreImages()`
- Batch ingestion script for the zero-waste-chef URLs text file

---

## 6. Zero-Waste / Waste-Reduction Recipe Tagging in the DB

### Existing Schema Fields (added in v0.45.0)

The `recipes` table has four dedicated zero-waste fields:

| Column | Type | Description |
|--------|------|-------------|
| `resourcefulness_score` | integer (1–5) | How waste-conscious the recipe is |
| `waste_reduction_tags` | text (JSON array) | Tags: `uses-scraps`, `one-pot`, `flexible-ingredients`, `minimal-waste`, `uses-aging`, `seasonal` |
| `scrap_utilization_notes` | text | e.g., "Save chicken bones for stock" |
| `environmental_notes` | text | e.g., "Uses seasonal ingredients to reduce carbon footprint" |

### Current Population State

All four fields are set to `null` when recipes are ingested via the `crawlWeeklyRecipes()` pipeline and via `storeRecipe()`. The scraping pipeline does not populate these fields — they require a separate AI-enrichment pass.

### Existing UI/Feature Support

- `/app/recipes/zero-waste/page.tsx` — a dedicated Zero-Waste Recipe Collection page exists, filtering for `resourcefulness_score >= 4`
- `WasteReductionSection.tsx` — a recipe card component section showing waste tags
- `/app/rescue/page.tsx` — a "rescue" page likely showing recipes for aging/leftover ingredients
- The zero-waste page filters tags: `flexible`, `one_pot`, `seasonal`, `scrap_utilization`

### Gap

The UI infrastructure exists but the data population does not. Scraped recipes are stored with `resourcefulness_score: null` and `waste_reduction_tags: null`. A batch enrichment job is needed to score existing recipes and populate these fields using AI (e.g., analyze ingredients for scrap/seasonal patterns).

---

## Summary Matrix

| Capability | Status |
|-----------|--------|
| Weekly recipe discovery (Perplexity) | Working, hourly via PM2 |
| Page content extraction (Firecrawl) | Working |
| AI recipe extraction (Claude 3 Haiku) | Working |
| Quality scoring (AI) | Working |
| Vector embeddings | Working (384-dim) |
| Chef-specific scraping (SerpAPI) | Working, manual only |
| Deduplication (weekly pipeline) | MISSING |
| Deduplication (chef scraper) | Implemented (URL + title similarity) |
| Image persistence (Vercel Blob) | MISSING (URLs kept as-is) |
| Recipe-a-day scheduling | MISSING (no schema support) |
| Zero-waste tag population | Schema exists, no population |
| Zero Waste Chef URL → DB ingestion | MISSING (file only) |
| Moderation auto-approve for system recipes | MISSING |
