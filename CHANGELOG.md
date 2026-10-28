# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **costs**: per-call crawl cost ledger (`crawl_cost_events`) with a rate table and `trackCost()`; Tavily, Firecrawl, Jina, OpenRouter, Anthropic, Perplexity, Brave, SerpAPI and DALL-E calls record one row each, tagged with the discovery run id when one is in scope (#6)
- **crawl**: per-run cost and budget on `recipe_discovery_runs` (`cost_usd`, `budget_usd`, `cost_write_failures`); a run stops making paid calls once its in-memory spend reaches its budget (`CRON_RUN_BUDGET_USD`, default $5) and ends `partial` (#6)
- **crawl**: `recipe_discovery_run_items`, one row per URL attempted with its extraction tier and outcome (#6)
- **crawl**: `reapStaleDiscoveryRuns()` marks `running` runs `failed` after 15 minutes (`daily`, `manual`) or 6 hours (`local`); the daily cron calls it before each run (#6)
- **crawl**: run budgets are clamped to `MAX_RUN_BUDGET_USD` ($100); the weekly crawl checks the budget before each paid URL; `/api/recipes/scrape` caps `maxResults` at 50 (#6)
- **crawl**: failed item writes add one `item writes failed: N` error to the run; the cron and `/api/recipes/scrape` responses carry `tracked` (#6)
- **crawl**: the local and pm2 scrapers (`scraper:daily`, `scraper:once`, `continuous-scraper.ts`, `/api/recipes/scrape`) record discovery runs with `run_type` `local` or `manual` (#6)

### Changed

- **crawl**: a partial discovery run is stored with status `partial` instead of `completed`; POST `/api/cron/daily-recipe` runs are stored with `run_type` `manual` instead of `daily` (#6)

### Fixed

- **crawl**: recipe inserts no longer fail with Postgres 22P02 when extraction returns text such as `"4 to 6"` for `servings`, `prep_time` or `cook_time`; every insert path writes an integer or null (a range keeps its low end, `"3 quarts"` keeps 3, text with no digits becomes null). A failed insert records the Postgres message and SQLSTATE in the run errors and the run item instead of drizzle's `Failed query` text (#12)
- **api**: POST `/api/recipes/scrape` requires an admin session or `Authorization: Bearer <CRON_SECRET>`; other callers get 401 (403 for a signed-in non-admin) before any crawl starts. `test/scripts/standalone-scraper.ts` sends the bearer and exits if `CRON_SECRET` is unset (#11)
- **api**: POST `/api/batch-import-small`, `/api/batch-import-single` and `/api/crawl/weekly` require an admin session or `Authorization: Bearer <CRON_SECRET>`; `/api/crawl/weekly` no longer trusts a `localhost` `Host` header. The unused `/api/batch-import` route is removed. `test/scripts/batch-import-*.sh` and `test/scripts/test-crawl.ts` send the bearer and exit if `CRON_SECRET` is unset (#13)
- **actions**: the `crawlWeeklyRecipes`, `crawlAndStoreRecipes` and `convertUrlToRecipe` server actions require an admin and throw `Admin access required` before any paid call. `searchRecipesOnline`, `storeRecipe` and `validateRecipe` are no longer client-callable actions. The crawl pipeline moves to `src/lib/recipe-crawl.ts` for routes, cron and scripts. The unguarded `/test-crawl` page is removed; use `/admin/crawl` (#13)
- **actions**: `searchWebRecipes` and `parseRecipeFromUrl` return an `Authentication required` error to a signed-out caller before any OpenRouter call; their only UI, `/discover`, already requires sign-in. The unused `estimateRecipePrice` action is removed (#13)

## [0.7.12] - 2026-04-11

### Added

- **ai**: OpenRouter as primary AI provider for recipe cleaner + image prompts, Ollama as local fallback
- **ai**: local Ollama recipe cleaner + last_cleaned_at tracking
- **rotd**: recipe-of-the-day feature with no-waste scraping + UI component
- **images**: local Ollama prompt generation + auto image fill for recipes
- open registration, automation bypass secret, type consistency fixes
- Vercel cron for daily recipe scraper + OpenRouter LLM integration
- autonomous recipe-a-day scraper + no-waste content refocus

### Fixed

- **recipe**: remove duplicate step numbering from instructions display
- **rotd**: fix recipe-of-day fallback query + empty state handling
- increase Tavily content truncation to 12000 chars + add Epicurious labeling migration
- wire autonomous scraper schema into DB module, fix Firecrawl API method
- update beta launch date to June 1, 2026

### Changed

- **fe**: semantic HTML, type safety, component cleanup


## [0.7.10] - 2026-02-17

### Added

- add Tavily integration and comprehensive documentation cleanup


## [0.7.9] - 2025-11-13

### Added

- implement complete tool functionality with images and detail views
- update beta launch date to December 1, 2024
- add database migration scripts and audit tools
- update beta launch date to November 16, 2024
- add Register button alongside Sign In
- major TypeScript improvements, collections integration, and project reorganization
- implement Epic 7.2 Recipe Interactions (ratings, comments, flagging)
- add 30-second timeout protection for fridge ingredient search
- Add comprehensive API v1 foundation with authentication system
- enhance recipe extraction with local AI and image domain support

### Fixed

- correct spice category from 'oz' to 'spice' for proper handling
- correct beta launch year to 2025
- replace ROADMAP.md symlink with actual file for Vercel deployment
- enable guest access to shopping lists
- enhanced mobile chef tags overflow fix with explicit max-width
- enable public access to meals and chefs pages
- prevent chef tags from overflowing on mobile
- suppress hydration warning for browser extension classes
- exclude test/example files from build and add ROADMAP.md symlink
- resolve remaining 11 production TypeScript errors
- resolve 56 TypeScript errors for v0.7.5 release
- prioritize external image URLs over broken local paths in RecipeCard
- handle structured ingredient objects to prevent [object Object] display
- resolve infinite loading loop in FlaggedImagesManager

### Changed

- Phase 1 - Eliminate 40% code duplication in API v1


## [0.7.8] - 2025-11-06

### Added

- implement complete tool functionality with images and detail views
- update beta launch date to December 1, 2024
- add database migration scripts and audit tools
- update beta launch date to November 16, 2024
- add Register button alongside Sign In
- major TypeScript improvements, collections integration, and project reorganization
- implement Epic 7.2 Recipe Interactions (ratings, comments, flagging)
- add 30-second timeout protection for fridge ingredient search
- Add comprehensive API v1 foundation with authentication system
- enhance recipe extraction with local AI and image domain support

### Fixed

- correct beta launch year to 2025
- replace ROADMAP.md symlink with actual file for Vercel deployment
- enable guest access to shopping lists
- enhanced mobile chef tags overflow fix with explicit max-width
- enable public access to meals and chefs pages
- prevent chef tags from overflowing on mobile
- suppress hydration warning for browser extension classes
- exclude test/example files from build and add ROADMAP.md symlink
- resolve remaining 11 production TypeScript errors
- resolve 56 TypeScript errors for v0.7.5 release
- prioritize external image URLs over broken local paths in RecipeCard
- handle structured ingredient objects to prevent [object Object] display
- resolve infinite loading loop in FlaggedImagesManager

### Changed

- Phase 1 - Eliminate 40% code duplication in API v1


## [0.7.7] - 2025-11-05

### Added

- update beta launch date to December 1, 2024
- add database migration scripts and audit tools
- update beta launch date to November 16, 2024
- add Register button alongside Sign In
- major TypeScript improvements, collections integration, and project reorganization
- implement Epic 7.2 Recipe Interactions (ratings, comments, flagging)
- add 30-second timeout protection for fridge ingredient search
- Add comprehensive API v1 foundation with authentication system
- enhance recipe extraction with local AI and image domain support

### Fixed

- correct beta launch year to 2025
- replace ROADMAP.md symlink with actual file for Vercel deployment
- enable guest access to shopping lists
- enhanced mobile chef tags overflow fix with explicit max-width
- enable public access to meals and chefs pages
- prevent chef tags from overflowing on mobile
- suppress hydration warning for browser extension classes
- exclude test/example files from build and add ROADMAP.md symlink
- resolve remaining 11 production TypeScript errors
- resolve 56 TypeScript errors for v0.7.5 release
- prioritize external image URLs over broken local paths in RecipeCard
- handle structured ingredient objects to prevent [object Object] display
- resolve infinite loading loop in FlaggedImagesManager

### Changed

- Phase 1 - Eliminate 40% code duplication in API v1


## [0.7.4] - 2025-10-27

### Added

- enhance recipe extraction with local AI and image domain support


## [0.6.0] - 2025-10-19

### Added

- documentation consolidation and meal pairing system foundations
- v0.5.3 - Tag System v2, Admin Editing UI, and Meal Builder

### Fixed

- add meal pairing metadata fields to recipe-crawl embedding generation


## [0.4.1] - 2025-10-16

### Added

- add duplicate detection and database deduplication
- version 0.4.0 - scale, performance, and complete rebrand
- major UX and performance improvements for Joanie's Kitchen
- Implement dual-environment Clerk authentication setup
- Add user profile management and export functionality
- Add comprehensive environment configuration setup
- Add comprehensive image support for recipes
- Add tag-based filtering, UUID migration, shared recipes, and import/export
- Add Google OAuth setup scripts and documentation
- Add Clerk authentication with Google One Touch Sign-In
- Complete Recipe Manager application with AI-powered features

### Fixed

- resolve Select.Item empty value errors and improve filters
- remove onDelete prop from RecipeCard in RecipeList
- remove onDelete prop from RecipeCard in RecipeInfiniteList
- resolve nested anchor tag hydration error in RecipeCard
- Fix ClerkProvider initialization and build errors
- Correct onChange callback to pass value directly instead of updater function
- Add type annotation for onChange callback in ImageUploader
- Update to Next.js 15 searchParams Promise syntax
- Add missing @radix-ui/react-popover and fix auth bypass for recipe pages

### Changed

- simplify top rated badge to star icon only


## [0.4.0] - 2025-10-15

### Added
- Serious Eats recipe scraper (Top 50 pilot)
- Python recipe-scrapers integration
- Duplicate detection and database deduplication system
- Build tracking system with versioning
- Comprehensive version management script

### Changed
- Complete rebrand to "Joanie's Kitchen"
- Updated about page messaging and brand identity
- Improved SEO roadmap and metadata
- Major UX and performance improvements
- Enhanced recipe discovery and filtering

### Fixed
- JSON parse error for 44 recipes (PostgreSQL set notation)
- Image generation script (added JSON.stringify)
- Select.Item empty value errors in filters
- Nested anchor tag hydration error in RecipeCard
- OnDelete prop removal from RecipeCard components

## [0.3.0] - 2025-10-10

### Added
- Dual-environment Clerk authentication setup
- Development and production auth on localhost
- ClerkProvider initialization improvements

### Fixed
- ClerkProvider initialization errors
- Build errors related to authentication
- Authentication configuration issues

## [0.2.0] - 2025-10-01

### Added
- Initial recipe management system
- AI-powered recipe generation
- Meal planning features
- Shopping list generation

### Changed
- Improved database schema
- Enhanced UI components
- Better error handling

## [0.1.0] - 2025-09-15

### Added
- Initial project setup
- Next.js 15 with TypeScript
- Clerk authentication
- Neon PostgreSQL database
- Basic recipe CRUD operations
