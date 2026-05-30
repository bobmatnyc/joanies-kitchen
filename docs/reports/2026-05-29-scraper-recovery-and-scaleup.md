# Recipe Auto-Scraping — Recovery, Reliability & Scale-Up

**Date**: 2026-05-29
**Type**: Engineering work log / postmortem
**Author**: bobmatnyc

---

## Table of Contents

1. [Context](#context)
2. [Problem Discovered](#problem-discovered)
3. [Root Causes](#root-causes)
4. [Fixes Shipped](#fixes-shipped)
5. [Infrastructure & Credentials](#infrastructure--credentials)
6. [Verification — Production Run Progression](#verification--production-run-progression)
7. [Outstanding / Follow-Ups](#outstanding--follow-ups)
8. [Key Files](#key-files)

---

## Context

- **Production site**: https://joanies.kitchen (Next.js on Vercel)
- **Production database**: Neon Postgres `ep-jolly-snow` — this is the live DB
- **Stale dev DB**: `.env.local`'s `ep-bold-credit` — stale, not production
- **Deprecated domain**: `recipes.help` — this domain is dead and caused an initial false "site down" alarm during this session; it is not the canonical site

---

## Problem Discovered

The autonomous daily recipe scraper (`/api/cron/daily-recipe` → `AutonomousRecipeIngestionService.runDailyDiscovery`) was scheduled to fire every morning at 06:00 UTC but was failing silently:

- ~72% of runs failed before this session
- Only **23 scraped recipes** stored in ~2 months of operation
- **0 recipes stored** in the 5 days immediately preceding this work
- Many runs were stuck in a **"running" ghost state** — the run-lifecycle did not record a terminal status on timeout or unhandled error, leaving zombie records in the DB

---

## Root Causes

| # | Root Cause | Impact |
|---|-----------|--------|
| 1 | `FIRECRAWL_API_KEY` missing from Vercel production environment | Primary extraction tier completely dead; all extractions fell through to a disabled/erroring fallback |
| 2 | Discovery recycling known-blocker domains | Tavily kept surfacing reddit, seriouseats, thekitchn, lovefoodhatewaste, ediblecommunities, foodandwine — all reject extraction; wasted quota, zero yield |
| 3 | Discovery surfacing non-recipe pages | Recipe index pages, cookbook promo pages, and roundup/listicle pages ("10 Best Chicken Recipes") were being treated as single recipes and failing extraction |
| 4 | Silent "extracted-but-not-stored" leak | Extraction succeeded but errors during DB writes were swallowed; batch continued silently with 0 stored |
| 5 | Ghost "running" run records | `runDailyDiscovery` lacked try/finally; a timeout or unhandled rejection left the run row permanently in `status=running` |

---

## Fixes Shipped

All three PRs were QA-gated, merged to main, and deployed to production.

### PR #3 — [feat: scraper scale-up + reliability, repo cleanup, joanies.kitchen domain docs](https://github.com/bobmatnyc/joanies-kitchen/pull/3)

**Scraper reliability & scale-up**:
- Added domain blocklist to prevent re-querying known-blocker sites
- Wrapped `runDailyDiscovery` in try/finally so the run row always receives a terminal status (completed/failed), eliminating ghost "running" records
- Surfaced store errors with logging and continued the batch (fail-open per recipe, not per run)
- Graceful extraction-tier skipping when a tier's API key is absent
- New environment variables: `CRON_MAX_RECIPES` (max recipes per run) and `CRON_SEARCH_QUERY` (override discovery query)
- Expanded `ALLOWED_DOMAINS` list
- Chef-targeted and rotating discovery queries for higher-quality recipe discovery
- Embeddings deferred — the embeddings module now requires Jina exclusively (gated on `JINA_API_KEY`)

**Repo cleanup**:
- Removed stale `package-lock.json` and `next.config.ts.backup`
- Moved root-level report `.md` files into `docs/reports/`
- Pruned `.gitignore`

**Domain & environment documentation**:
- Documented `joanies.kitchen` as the canonical production domain
- Fixed `NEXT_PUBLIC_APP_URL` bug (was pointing at wrong domain)
- Documented production-vs-stale Neon DB distinction (`ep-jolly-snow` = production, `ep-bold-credit` = stale dev)

---

### PR #4 — [feat(scraper): discovery quality](https://github.com/bobmatnyc/joanies-kitchen/pull/4)

- Non-recipe URL filtering (rejects `/tag/`, `/category/`, `/author/`, `/search/`, index slugs like `best-*-recipes`, `/cookbook`, `/store`, etc.)
- Listicle/roundup detection — pages identified as roundups are not extracted directly; instead their child single-recipe links are harvested
- Bounded child-link harvesting: max 10 child recipes per listicle, max 15 harvested child URLs per cron run, no recursion
- Tavily query tuning for precision
- QA-hardened to avoid false positives: legitimate "Best Chocolate Cake Recipe" titles and `-book-`/`-bundle-` slug patterns are not rejected

---

### PR #5 — [feat(scraper): harvest /blogs/ + category hub pages](https://github.com/bobmatnyc/joanies-kitchen/pull/5)

- Route `/blogs/`, `/recipe(s)-categor(y|ies)/`, `/blog/<slug>`, and bare tag-hub paths (date-structured domains) to the hub harvester
- Single-recipe extraction fallback when a hub page turns out to be a standalone recipe (including when Firecrawl is unavailable)
- Fixed a latent `executeSearch()` pre-filter bug that could silently drop valid URLs before discovery

---

## Infrastructure & Credentials

| Item | Action |
|------|--------|
| `FIRECRAWL_API_KEY` | Injected into Vercel production from 1Password (`op://Tripbot/FIRECRAWL_API_KEY/credential`); also added to `.env.local` |
| `CRON_MAX_RECIPES` | Set to `10` in Vercel production environment |
| `CRON_SECRET` | `.env.local` updated to match the real production value (synced from Vercel dashboard) |

---

## Verification — Production Run Progression

All runs are against production (`ep-jolly-snow`). No production-DB writes occurred during local testing (unit tests mock the DB layer; dry-run scripts use local fixtures).

| Stage | Recipes Stored | Candidates Attempted | Yield | Notes |
|-------|---------------|---------------------|-------|-------|
| Before this session | ~0 (5-day zero streak) | ~15/run | ~0% | Firecrawl key missing; ghost runs |
| After PR #3 (Firecrawl key injected) | 1 | 15 | 6.7% | Key present; discovery still recycling blockers |
| After PR #4 (discovery quality) | 8 | 16 | 50% | Blocklist + non-recipe filter + listicle detection active |
| After PR #5 + `CRON_MAX_RECIPES=10` | **10** | 36 | **27.8%** | `status=completed`, 0 errors; hub-harvesting confirmed working |

The final run stored 10 recipes harvested as child URLs from a `floridamilk.com` category hub page, confirming the hub-harvesting feature is functional in production.

**Overall production recipe count**: 4,754 → **4,773** (+19 net across the recovery session's production runs).

**Test suite**: 152 unit tests passing. Biome lint and TypeScript typecheck clean on all three PRs.

---

## Outstanding / Follow-Ups

| Priority | Item |
|----------|------|
| High | **`JINA_API_KEY`**: 1Password item `op://Private/Jina/password` is EMPTY. Until populated, the Jina extraction fallback tier and embeddings generation for newly-scraped recipes are both disabled. The embeddings module currently requires Jina exclusively — similar-recipe recommendations for new scrapes will not populate. |
| Medium | **1Password `CRON_SECRET` mismatch**: `op://Tripbot/CRON_SECRET/credential` does not match the current live production `CRON_SECRET`. The 1Password item should be updated to the Vercel production value so secrets remain in sync. |
| Low | **Prior hub-URL failures** (lidiasitaly.com category pages, cabotcreamery.com/blogs): these errored in runs that executed on old code. They should harvest correctly on the new deploy going forward — no code change needed, just natural retry on the next cron cycle. |
| Low | **Delete merged feature branches** on GitHub: `feat/scraper-reliability-scaleup` (PR #3), `feat/scraper-discovery-quality` (PR #4), `feat/scraper-blog-listicle-harvest` (PR #5). |
| Ongoing | **Monitor** the daily 06:00 UTC cron run's `status`, `recipesStored`, and `errors` fields over the next week to confirm sustained yield improvement. |

---

## Key Files

| File | Role |
|------|------|
| `src/lib/services/recipe-discovery.service.ts` | Tavily-based URL discovery, domain blocklist, non-recipe URL filtering, listicle detection, hub harvesting logic |
| `src/lib/services/recipe-extraction.service.ts` | Multi-tier extraction (Firecrawl primary → Jina fallback → Cheerio fallback), graceful tier skipping |
| `src/lib/services/autonomous-recipe-ingestion.service.ts` | Orchestrates discovery + extraction + storage; run-lifecycle management (try/finally); `CRON_MAX_RECIPES` limit |
| `src/app/api/cron/daily-recipe/route.ts` | Vercel cron handler; validates `CRON_SECRET`; calls `runDailyDiscovery` |
| `vercel.json` | Cron schedule: `0 6 * * *` (06:00 UTC daily) |
