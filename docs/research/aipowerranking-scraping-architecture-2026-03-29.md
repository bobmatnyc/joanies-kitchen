# AIpowerranking Scraping/Crawling Architecture

**Date:** 2026-03-29
**Source project:** /Users/masa/Projects/aipowerranking
**Purpose:** Reference for building a recipe/chef scraper in Next.js/TypeScript

---

## 1. Overview

The scraping system is a fully automated news ingestion pipeline for an AI tool ranking site. It discovers articles via search APIs, extracts full content, runs LLM quality assessment, then stores structured data in PostgreSQL. It is scheduled via Vercel Cron with no external queue manager.

---

## 2. Scripts Directory

The `scripts/` directory contains 300+ one-off TypeScript scripts (`.ts` files) run via `tsx`. These are NOT the scraper itself — they are maintenance, backfill, debugging, and migration scripts. Examples:
- `backfill-day.ts` — re-ingest articles for a specific day
- `test-article-ingestion.ts` — test the pipeline manually
- `trigger-ingestion.ts` — manually kick off the cron pipeline
- `collect-github-metrics.ts`, `collect-npm-metrics.ts` — metric collection scripts

The actual scraping logic lives in `lib/services/`.

---

## 3. HTTP Client

**Primary: Native `fetch` (Web API)**
All HTTP requests use Node.js built-in `fetch`. No axios, got, or node-fetch.

Rate limiting is handled implicitly:
- Batch processing is sequential (one URL at a time per the `extractBatch` method)
- AbortSignal timeouts are set: 15s for content extraction, 10s for quality checks, 120s for AI analysis
- Tavily Extract has a built-in retry loop (3 retries, exponential backoff: 1s, 2s, 4s)
- Jina Reader retries on 401/403 with exponential backoff (1s, 2s, max 2 retries)

**User-Agent string used for basic HTML fallback:**
```
Mozilla/5.0 (compatible; AINewsBot/1.0; +https://ai-power-ranking.com)
```

**No Playwright, Puppeteer (except in devDependencies for E2E tests), or headless browser scraping.**

---

## 4. Content Extraction Chain

Three-tier fallback chain, attempted in order:

### Tier 1: Tavily Search Result Content (free, already fetched)
- Tavily's search API returns a `content` field (snippet/body) with each result
- If `content.length > 100`, it is used directly — no additional HTTP request needed
- Most results use this path

### Tier 2: Tavily Extract API
- `POST https://api.tavily.com/extract`
- Returns `raw_content` in markdown format
- Options: `extract_depth: 'basic'`, `format: 'markdown'`, `timeout: 10`, `chunks_per_source: 5`
- 3 retries with exponential backoff
- Non-retryable errors: 404, invalid URL, API key errors

### Tier 3: Jina.ai Reader API
- `GET https://r.jina.ai/{url}`
- Returns JSON with `content` and `metadata` fields
- Content is pre-cleaned markdown (no HTML parsing needed)
- 30s timeout, 2 retries on 401/403
- Returns metadata: title, author, publishedDate, description, source

### Tier 4: Basic HTML Fetch (last resort)
- Raw `fetch()` call with browser-like User-Agent header
- Strips `<script>` and `<style>` tags via regex
- Tries to extract article content using CSS-like patterns:
  - `<article>` tags
  - `<main>` tags
  - `<div class="*content*">` divs
  - `<div class="*article*">` divs
- Strips remaining HTML tags, decodes HTML entities
- Truncates to 8,000 chars for quality checks, 15,000 chars for full ingestion
- Also extracts links via regex: `/<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi`
  - Skips anchors (`#`), javascript links, and empty links
  - Returns up to 50 links

**Content is NOT parsed with a proper HTML parser (e.g., Cheerio). It uses regex.**

---

## 5. Robots.txt Handling

**There is no robots.txt checking.** The system uses a manual blocklist instead:

```typescript
// lib/services/blocked-domains.config.ts
export const BLOCKED_DOMAINS = new Set([
  "reuters.com",
  "wsj.com",
  "ft.com",
  "bloomberg.com",
]);
```

- Domains are checked before fetching via `isDomainBlocked(url)`
- If a 401/403 response is received during content fetching, the domain is auto-added to the blocklist at runtime (in-memory, not persisted)
- The blocklist is a static export — it resets on each Vercel function cold start

---

## 6. Article Discovery (Search APIs)

**Primary: Tavily Search**
- `POST https://api.tavily.com/search`
- Search query is a manually crafted multi-line string:
  ```
  AI coding assistant news OR AI code generation tools OR
  GitHub Copilot OR Cursor AI OR Claude Code OR Windsurf OR
  Devin AI OR Replit Agent OR Amazon Q Developer OR
  AI developer tools announcement OR agentic coding 2026
  ```
- `search_depth: 'advanced'`, `max_results: 20`, `topic: 'news'`
- 2 supplementary queries also run (day-of-week rotation from a pool of 7 queries)
- Results deduplicated by URL within the Tavily response

**Fallback: Brave Search**
- `GET https://api.search.brave.com/res/v1/web/search`
- Uses past-day freshness (`pd`)
- Primary + supplementary queries (day-of-week rotation)
- Returns results without pre-fetched content (so falls through to extraction chain)

---

## 7. Deduplication Logic

Two-stage deduplication is applied:

### Stage 1: URL deduplication
- Checks `articles.source_url` in PostgreSQL via `inArray(articles.sourceUrl, urls)`
- Returns exact URL matches
- O(n) database query — one query for all URLs at once

### Stage 2: Semantic deduplication (title similarity)
- Compares new article titles against titles of articles published in the last 7 days
- Also compares within the current batch ("first wins")
- Algorithm:
  1. Normalize titles: lowercase, remove punctuation, filter stop words, remove words <3 chars
  2. Extract "key features" (company/product names: openai, anthropic, claude, copilot, etc.)
  3. Calculate weighted Jaccard similarity: 40% word overlap + 60% key feature overlap
  4. Threshold: 0.35 (35%) — articles above this threshold are considered duplicates
- No embedding-based semantic deduplication (pure text/keyword)

---

## 8. AI-Powered Content Analysis

After content extraction, every article is analyzed by an LLM:

**Model:** `anthropic/claude-sonnet-4` via OpenRouter
- `POST https://openrouter.ai/api/v1/chat/completions`
- Temperature: 0.2, max_tokens: 4,000
- 120s timeout

**System prompt** instructs the model to return a JSON object with:
- `title`, `summary` (400-500 words), `rewritten_content` (~1000 words)
- `source`, `url`, `published_date`, `category`, `tags`
- `tool_mentions[]` — each with `tool`, `context`, `sentiment` (-1 to 1), `relevance` (0 to 1)
- `company_mentions[]` — each with `company`, `context`, `tools[]`
- `overall_sentiment`, `importance_score` (0-10), `key_insights[]`
- `ranking_impacts` — `likely_winners[]`, `likely_losers[]`, `emerging_tools[]`

**Tool name normalization** is applied post-LLM:
- Alias map: 100+ aliases → canonical names (e.g., `"copilot"` → `"GitHub Copilot"`)
- Fuzzy matching: partial word overlap against 30 known tools
- Uses Zod for schema validation of the JSON response

**Quality assessment** (separate LLM call before ingestion):
- Model: `anthropic/claude-sonnet-4` via OpenRouter
- Scores article on quality (0-10), relevance (0-10), credibility (0-10)
- Thresholds: avg score ≥ 7.0 AND relevance ≥ 7 to pass
- Articles failing quality check are skipped

---

## 9. Scheduling / Automation

**Vercel Cron** (defined in `vercel.json`):
```json
{
  "crons": [
    { "path": "/api/cron/daily-news",      "schedule": "0 6 * * *"  },
    { "path": "/api/cron/monthly-summary", "schedule": "0 8 1 * *"  }
  ]
}
```
- Runs daily at 6 AM UTC
- Authentication: `Authorization: Bearer <CRON_SECRET>` header required
- Max duration: 800 seconds (~13 minutes)
- No PM2, no BullMQ, no Redis, no external queue system

**Trigger:** GET request to `/api/cron/daily-news`

**No PM2 or process manager** — the `scripts/ecosystem.config.js` file exists but appears to be legacy/unused for local dev only.

---

## 10. Database Schema (PostgreSQL via Neon + Drizzle ORM)

### `articles` table (primary scraping output)
```
id                  uuid PRIMARY KEY
slug                varchar(255) UNIQUE
title               varchar(500)
summary             text
content             text
ingestion_type      varchar(20)  -- 'url' | 'text' | 'file'
source_url          varchar(1000)
source_name         varchar(255)
tags                text[]
category            varchar(100)
importance_score    integer
sentiment_score     decimal(3,2)
tool_mentions       jsonb  -- array of {tool, context, sentiment, relevance}
company_mentions    jsonb  -- array of {company, context, tools[]}
rankings_snapshot   jsonb
author              varchar(255)
published_date      timestamp
is_auto_ingested    boolean
discovery_source    varchar(50)  -- 'tavily' | 'brave_search' | 'manual'
ingestion_run_id    uuid → automated_ingestion_runs.id
created_at, updated_at
```

### `automated_ingestion_runs` table (audit log)
```
id                     uuid PRIMARY KEY
run_type               varchar(50)  -- 'daily_news' | 'monthly_summary' | 'manual'
status                 varchar(20)  -- 'running' | 'completed' | 'failed'
articles_discovered    integer
articles_passed_quality integer
articles_ingested      integer
articles_skipped       integer
articles_skipped_semantic integer
ranking_changes        integer
estimated_cost_usd     decimal(10,4)
started_at             timestamp
completed_at           timestamp
error_log              jsonb
ingested_article_ids   jsonb
```

Indexes: GIN indexes on JSONB columns, full-text search index on `title`.

---

## 11. Rate Limiting

**Outbound HTTP:**
- No explicit rate limiter utility class
- Sequential processing in `extractBatch` (one URL at a time)
- Retry delays: exponential backoff in Tavily Extract (1s/2s/4s) and Jina Reader (1s/2s)
- AbortSignal timeouts prevent hanging requests

**Inbound API:**
- `lib/rate-limit.ts` exists — uses `@upstash/ratelimit` + Vercel KV for inbound API rate limiting on user-facing endpoints

---

## 12. Pipeline Summary

```
Vercel Cron (6 AM UTC)
  ↓
AutomatedIngestionService.runDailyDiscovery()
  ↓
1. Create ingestion run record (DB)
2. Search for articles (Tavily Search preferred, Brave fallback)
3. Filter URL duplicates (DB query)
4. Filter semantic duplicates (Jaccard title similarity)
5. Fetch content for each article:
   a. Use Tavily search result content if available
   b. Try Tavily Extract API (3 retries, exp backoff)
   c. Try Jina Reader API (2 retries on 401/403)
   d. Fallback: raw fetch + HTML regex stripping
6. Quality assessment via LLM (claude-sonnet-4, score ≥ 7)
7. Full AI analysis via LLM (claude-sonnet-4, extracts tool mentions etc.)
8. Save to articles table (DB)
9. Update ingestion run record
10. Invalidate Next.js ISR caches
```

---

## 13. Adapting for Recipe/Chef Scraper (Next.js/TypeScript)

### What to reuse directly:
- **Three-tier content extraction chain** — Tavily Extract → Jina Reader → raw fetch fallback
- **AbortSignal timeout pattern** for all fetches
- **Semantic deduplication by title** (Jaccard) — useful for recipe articles
- **Vercel Cron scheduling** pattern (`vercel.json` + `/api/cron/` route)
- **Drizzle ORM + Neon PostgreSQL** schema approach — JSONB for flexible fields + typed columns for searchable fields
- **Automated ingestion runs table** — audit log pattern
- **`isAutoIngested` + `discoverySource`** tracking columns
- **Blocked domains config** — simple Set with runtime additions
- **OpenRouter for LLM analysis** — same pattern works for recipe metadata extraction

### What to replace/adapt:
- **Search queries** — replace AI tool queries with recipe/food/chef keywords
- **Tool mapper** — replace with ingredient/cuisine/chef normalizer
- **Quality assessment prompt** — change to assess recipe content relevance/completeness
- **AI analysis schema** — change `tool_mentions` to `ingredient_mentions`, `technique_mentions`, `chef_mentions`
- **Ranking algorithm** — replace with recipe scoring (ratings, engagement, etc.)

### Key env vars needed:
```
TAVILY_API_KEY
JINA_API_KEY
OPENROUTER_API_KEY
BRAVE_SEARCH_API_KEY (optional fallback)
CRON_SECRET
DATABASE_URL (Neon)
```

### Potential additions for recipe scraper:
- **Structured data extraction** (`<script type="application/ld+json">` with Recipe schema) — more reliable than LLM for structured recipe pages
- **Cheerio or parse5** instead of regex HTML parsing — many recipe sites use complex templates
- **Image URL extraction** — recipes need cover images
- **Nutritional data normalization**
- **robots.txt checking** — this project skips it but you may want it for public-facing scraper

---

*Researched from /Users/masa/Projects/aipowerranking by Claude Research Agent*
