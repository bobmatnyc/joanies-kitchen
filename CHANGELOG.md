# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **search**: migration `0006_recipe_embeddings_hnsw` adds an HNSW index on `recipe_embeddings.embedding` (`vector_cosine_ops`, m 16, ef_construction 64). `findSimilarRecipes` now takes the K = max(100, limit × 4) nearest embeddings first, so the index can serve that step, and then applies the soft-delete, visibility, source and similarity-cutoff filters before the result limit. It runs in one transaction with `SET LOCAL hnsw.ef_search = 40` and `hnsw.iterative_scan = relaxed_order`. On a Neon branch of production the query took 0.65-0.78 ms instead of 28-34 ms, with mean recall 0.996. `GET /api/v1/recipes/:id/similar` passes the caller's visibility into the query, so private recipes ranked above public ones no longer shorten the list, and admins now see private recipes there, as on the recipe page. The migration has not been applied to production (#131)
- **recipes**: migration `0005_dedup_135_redirects_ledger` adds `recipe_redirects` (retired recipe id and slug to the survivor) and `dedup_135_ledger`. `scripts/dedup-135/apply.ts` merges duplicate recipe groups from a signed decisions file, one transaction per group: it moves dependent rows to the survivor (dropping a loser row whose unique key the survivor already holds), soft-deletes the losers, recomputes the survivor's counters, gives a survivor without a slug one, and writes a redirect per loser. It refuses an unsigned decisions file, and stops before any write when the live data differs from the signed dry run in any group id, member id or per-table loser-row count (recipe_views within 5%). Each group also stops on a unique-key collision the dry run did not record, a survivor not owned by `system`/`system_imported`, or a loser with more `recipe_ingredients` rows than the survivor unless acknowledged in the decisions file. Backup tables (`*_bak_*`) are never re-pointed. Chef and collection `recipe_count` are recounted, a group may override the survivor's `source`, and post-checks run after every batch of 50 groups. `scripts/dedup-135/rollback.ts` reverses a batch from the ledger; `scripts/dedup-135/checksum.ts` prints read-only row counts and checksums for the rehearsal. `plan.ts` now records per-member row counts, unique-key values and the chef_recipes collision triples. None of these has been run against production (#135)
- **recipes**: old URLs of recipes merged away by the duplicate-recipe merge redirect to the surviving recipe. `/recipes/<old id or slug>` redirects to the survivor's slug URL (its id URL if it has no slug); `GET /api/v1/recipes/<old id or slug>` and `GET /api/v1/recipes/<old id or slug>/similar` redirect to the survivor's API URL. The status is 307 by default; `RECIPE_REDIRECT_STATUS=308` switches to 308 (permanent), to be set only after the post-apply check passes. Unset or any other value gives 307. The lookup reads `recipe_redirects` only when the recipe is missing or soft-deleted, never redirects a live recipe, and skips a survivor that is soft-deleted, private or rejected (#135)

### Fixed

- **tests**: `substitutions-rate-limit.test.ts` no longer fails at random in CI. The substitutions limiter uses fixed 60-second windows on the real clock, so a minute boundary crossed during the test's 21 calls reset the count and the over-limit call succeeded instead of returning `RATE_LIMITED`. The test now pins `Date` to the middle of a window; limiter code is unchanged (#180)
- **recipes**: components that read `recipes.images` or `image_url` raw now use the shared `recipe-image` helpers, so a malformed `images` value (a Postgres array literal, plain text, bad JSON) no longer throws during render and a `data:` or non-URL entry is never rendered. Fixed: Similar Recipes list, recipe edit form (an unparseable value shows an empty image list and the stored value is changed only on save), admin recipe queue, preview modal, flagged images manager and image editor, and the meal AI suggestion cards. `GET /api/recipes/recipe-of-day` keeps its fields and string shapes but returns only usable URLs in `image_url` and `images` (`images` is null when none remain) (#179)
- **favorites**: `favorites` is now the single like/favorite store (D26 PR1). A new core, `src/lib/favorites`, backs the server actions, `socialService` and the v1 API. `/api/v1/favorites*` and `/api/v1/recipes/:id/like` used to read and write `recipe_likes`, which the web UI never saw; they now use `favorites`, and an API-key caller without a profile gets one created. **`/api/v1/recipes/:id/like` is deprecated** as an alias of `/api/v1/favorites/:recipeId`: bodies, status codes and scopes are unchanged, `likeCount` counts `favorites` rows, and every response carries `Deprecation: true` and `Link: </api/v1/favorites/:id>; rel="successor-version"`. `recipes.like_count` no longer drifts: `addFavorite` inserts and increments in one statement and counts a repeat add once, `toggleFavorite`'s remove path now decrements (it was a bare delete), `getFavoriteCount` returns a real count instead of 0 or 1, and the account purge recounts `like_count` for every recipe the purged user favorited. The unused `LikeButton`, `toggleRecipeLike`, `getRecipeLikesCount`, `hasUserLikedRecipe` and `getUserLikedRecipes` are removed. No migration; existing `recipe_likes` rows are migrated in PR2 and the table is dropped in PR3 (#167)
- **recipes**: `parseRecipe` returns only usable image URLs in `images` (absolute `http(s)://`, protocol-relative `//`, root-relative `/…`) and in `image_url`. A Postgres array literal such as `{"/ai-recipe-images/x.png"}` is converted to its elements; every `data:` URI (including `data:image/svg+xml` lazy-load placeholders), bare words such as `1` or `fill`, and blank entries are dropped. The same rule now applies where `image_url` is read as an image source: the recipe page OG image, shared recipe cards and carousel, meal recipe cards and detail, and collection covers. The meal detail and collection cover also no longer throw on a non-JSON `images` value. The 9 affected production rows still need a separate data repair (#172)
- **recipes**: a recipe image that fails to load (carousel, thumbnails, fullscreen view, image grid, uploader preview and wizard review) now swaps once to the static `/placeholders/generic.svg`. The handlers pointed at a sized placeholder API path that has no route, so the 404 fired `onError` again and the browser repeated the request. A new `swapToFallbackImage` in `src/lib/utils/image-fallback.ts` does nothing when the image already shows the fallback (#173)
- **favorites**: `removeFavorite` lowers `recipes.like_count` only when its delete removed a favorites row. A repeated request, a double-click or a recipe the user never favorited used to subtract 1 anyway and undercount. The delete and the decrement are now one SQL statement (a `WITH removed AS (DELETE … RETURNING 1) UPDATE … WHERE EXISTS` CTE), so they succeed or fail together. `addFavorite` is unchanged: a duplicate insert already fails on `favorites_unique` before the increment. The separate `recipe_likes` / `toggleRecipeLike` system is untouched (#167)
- **seo**: recipe, chef, tool and ingredient pages no longer emit `og:image:width` and `og:image:height`. They were hardcoded to 1200x630, but the images are arbitrary external or Vercel Blob files of other sizes (for example a 1024x1024 recipe hero). The Open Graph spec allows omitting the dimensions, so none are stated. The `og:image` URL and the rest of the metadata are unchanged. The site-wide default in the root layout is untouched (#164)
- **chefs**: `chefs.recipe_count` no longer goes stale when recipes are deleted. `deleteRecipe`, `adminDeleteRecipe`, `adminBulkDeleteRecipes` and the cleanup delete in `linkInsertedRecipe` read the chefs linked to the recipes before the delete (the `chef_recipes` rows cascade away) and recount each one afterwards with `recountChefRecipes`; a failed recount is reported as that action's existing failure. This also covers the case where `linkRecipeToChef` recounts and then `revalidatePath` throws, so the cleanup delete left the count one too high. Counts already wrong in production need a separate data repair (#165)
- **seo**: sitemap `<loc>` values no longer contain a line break. `NEXT_PUBLIC_APP_URL` could end in a newline, which was copied into every sitemap URL. A new `getBaseUrl()` in `src/lib/site-url.ts` trims whitespace and trailing slashes and falls back to `https://joanies.kitchen`; the sitemap, root `metadataBase`, recipe/chef/tool/ingredient metadata, the recipe JSON-LD and the OpenRouter `HTTP-Referer` headers use it (#163)
- **chefs**: chef scraping (crawl job and `scrapeSingleRecipe`) links a page whose canonical source URL is already stored to the chef, so the stored recipe appears on the chef's page, and counts it as skipped (the job records the count in `scraping_jobs.metadata.recipes_skipped`; `scrapeSingleRecipe` returns `linkedToChef: true`). A same-title, same-host match is skipped without a link. `linkRecipeToChef` refuses an unknown chef with "Chef not found" and writes nothing, writes the link and `recipes.chef_id` in one batch, treats an existing link as a no-op, and does not take a recipe away from another chef when linking a duplicate. A failed link now fails the page: the job counts it as failed, not skipped or scraped, and a newly inserted recipe whose link fails, by a returned error or a thrown one (such as a failed admin check), is deleted; if that delete also fails, the error names both failures. `src/lib/recipe-crawl.ts`, `src/lib/services/autonomous-recipe-ingestion.service.ts` and `src/app/actions/recipe-discovery.ts` are split under the 500-line cap; the crawl's two store functions are merged into one, with no behaviour change (#142)
- **auth**: a deployment without the Auth.js env vars (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`), such as a Vercel preview, no longer logs an Auth.js "server configuration" error on every page. The root layout passes `isAuthConfigured()` to `AuthProvider`, which then renders a fixed signed-out session and never fetches `/api/auth/session`. The `/api/auth/*` route answers without calling Auth.js: `GET /api/auth/session` returns `null` and every other action returns 503, so sign-in stays off. Deployments with the vars set are unchanged (#154)
- **build**: the app's fonts (Inter, Lora, Playfair Display) are self-hosted as latin variable woff2 files under `src/app/fonts` and loaded with `next/font/local`, so a build no longer fetches Google Fonts. Google's CSS response intermittently came back unparseable (`Cannot read properties of null (reading '1')` in `next/font`) and failed Vercel and CI builds. CSS variables, `display` and the weights and styles used are unchanged (#152)
- **search**: semantic search and `GET /api/v1/recipes/:id/similar` exclude soft-deleted recipes in SQL before the result limit, so deleted near-duplicates no longer take result slots and shorten the list. "Recipes Like This" no longer lists soft-deleted recipes to their owner or an admin. The embedding batch queries (`getAllRecipeEmbeddings`, `getRecipesNeedingEmbedding`) skip soft-deleted recipes, so a batch run does not embed or re-embed them (#135)
- **inventory**: `markRecipeIngredientsAsUsed` refuses a soft-deleted recipe, even the caller's own, with the same "Recipe not found or access denied" result as a missing recipe, and writes nothing. It also checks each inner `markItemAsUsed` result: a recipe-level refusal refuses the whole call, and an item-level failure is reported in `failed_items` (with `failed_count`) instead of `marked_items`; if every attempted ingredient fails the call returns `success: false`. The inventory lookup used `= ANY($array)`, which Postgres rejects, so the action failed for every recipe; it now uses `inArray` (#143)
- **inventory**: `markItemAsUsed` with a `recipe_id` the caller may not see (another user's private or rejected recipe, or any soft-deleted recipe) now returns the same "Recipe not found" result as a missing recipe and writes no usage-log row and no inventory change. Before, success versus "Recipe not found" revealed that a private recipe exists, and the log row could point at it. Owners, admins, public recipes and calls without a `recipe_id` are unchanged (#143)
- **recipes**: a dead or hidden recipe URL (`/recipes/<slug>` or `/recipes/<uuid>`) returns its 404 with the title "Page Not Found | Joanie's Kitchen" and robots `noindex, nofollow`, inside the site header and footer. The recipe metadata step no longer calls `notFound()`; Next ran it again while rendering the 404, and the throw left the page with no `<title>`. Hidden and missing recipes still give identical responses (#138)
- **seo**: page titles name "Joanie's Kitchen" once. 36 page titles that already ended in "| Joanie's Kitchen" or "- Joanie's Kitchen" (recipes, meals, chefs, tools, ingredients, collections, profiles, learn, rescue, about, and others) no longer add it a second time on top of the root title template. Recipe meta keywords list the recipe's tags instead of one keyword per character of the tags JSON (#138)
- **ratings**: `rateRecipe` refuses a recipe the caller may not see (another user's private or rejected recipe, or any soft-deleted recipe) with the same "Recipe not found" result as a missing recipe, and writes no rating and no aggregate change. `getRecipeRatings` and `getUserRating` return the missing-recipe answer (`[]`, `null`) for such a recipe instead of its reviews. Owners and admins keep rating and reading their own private recipes; public recipes are unchanged (#137)
- **ratings**: `rateRecipe` and `deleteRating` no longer fail with `avgRating.toFixed is not a function` after writing; Postgres returns the average as a string, so the recipe's average and count were never updated (#137)
- **recipes**: `/recipes/<slug>` returns a real HTTP 404 for a recipe that does not exist and for a private recipe the viewer cannot see. Both give the same response: the shared not-found page, no recipe title in the metadata, and robots `noindex, nofollow`. A private recipe's UUID URL returns that 404 instead of redirecting to its slug (#134)
- **recipes**: the `getRecipe`, `getRecipeBySlug`, `getRecipeIngredients`, `updateRecipe`, `deleteRecipe` and `toggleRecipeVisibility` server actions answer a private recipe the caller may not see with the same "Recipe not found" result as a recipe that does not exist, so a direct action call no longer reveals that a private recipe exists. The unreachable "Private Recipe, sign in to view" prompt on the recipe page is removed (#134)
- **ingest**: the weekly and search crawls, the daily autonomous ingestion run, chef scraping (crawl and single URL), `POST /api/ingest-recipe` and recipe discovery no longer insert a duplicate recipe. A candidate is a duplicate when its canonical source URL matches a stored one (host lowercased without `www.`, https, no fragment, no `utm_*`/`fbclid`/`gclid`, sorted params, no trailing slash, `print` or `comment-page-N` segment). The crawls, the autonomous run and chef scraping also treat a matching normalised title on the same source host as a duplicate; the ingest API and discovery, which a user starts, apply the URL rule only, so a same-title recipe at another URL on the same host is stored. The same title from another host is always stored. Crawls report the skip as `rejected` with reason `skipped: duplicate of <id>` and record it as `skipped_duplicate` (the autonomous run too, linked to the stored recipe); chef scraping logs it and `scrapeSingleRecipe` returns `duplicateOf`; the ingest API answers 409 with `duplicateOf`; discovery links the stored recipe. When the stored recipe is neither the caller's own nor public and visible (for example moderation-rejected), the ingest API and discovery answer only "Recipe already exists", with no id. A URL variant is caught before the paid scrape. The ingest API's slug check, which could never fire, is removed, and the Epicurious importer compares normalised titles (#135)
- **search**: similarity cutoffs are calibrated for `BAAI/bge-small-en-v1.5` and live in `src/lib/search/similarity-cutoffs.ts`. Search keeps results scoring at least `max(0.65, top1 - 0.10)`, so a nonsense query shows "no results"; "Recipes Like This" and `GET /api/v1/recipes/:id/similar` default to 0.72. An explicit `minSimilarity`, including 0, is the only cutoff, with no relative trim. The SemanticSearchPanel slider now runs 0.5-0.9 and starts at 0.65 (#96)
- **db**: a `DATABASE_URL` whose host is exactly `127.0.0.1`, `::1` or `localhost` now sends neon-http queries to a local Neon HTTP proxy at `http://<host>:<NEON_LOCAL_PROXY_PORT>/sql` (default 4444) instead of failing with `Invalid URL https://api.0.0.1/sql`. Every other host, Neon included, keeps the driver's default endpoint (#60)
- **ops**: admin DB tools (`drizzle.config.ts`, `scripts/sync-migration-tracking.ts`, the data-fix and Epicurious label scripts) go through `src/lib/db/admin-db-url.ts`, which strips or refuses a Neon `-pooler` host and anchor-matches the prod host. Runbooks use `DATABASE_URL_UNPOOLED` for `pg_dump` and `psql`. A pooled `pg_dump` had leaked `search_path=''` onto shared backends and broken prod reads (D3a)

### Added

- **observability**: client errors caught by `error.tsx`, `global-error.tsx` and the three `/meals` error boundaries are sent once per error to `POST /api/client-error` (sendBeacon, fetch-keepalive fallback), which validates and size-caps the payload, limits each IP to 10 per minute, and logs one redacted `app-error` line with source `client` and the pathname only. A limiter outage returns 503 (#55)
- **moderation**: signed-in users can report another user's comment (20 reports per hour); a repeat report from the same user counts once and own comments cannot be reported. A comment is hidden automatically when 3 distinct users have pending reports on it; recipes never auto-hide. Comment reports appear in `/admin/flags` with the comment text, where dismiss un-hides the comment and closes its pending reports, and hide, unhide and remove act on the comment. A recipe report is no longer blocked by the same user's comment report on that recipe (#105)
- **account**: a daily Vercel cron, `GET /api/cron/purge-deleted-accounts` (07:30 UTC, `CRON_SECRET` bearer), permanently deletes non-admin accounts whose deletion request is at least 30 days old, up to 25 per run. Kept public recipes move to `user_id = 'deleted-user'` with other users' comments intact; every other row naming the user is deleted or anonymized, Vercel Blob files still used by another row are kept, and the `users` row is deleted last in one transaction. A failing account keeps its `users` row and makes the run return 500; the next run retries it. `/privacy` Retention describes the schedule (#104)
- **account**: users can request deletion of their account from `/profile/edit`, choosing to delete their public recipes (default) or keep them as "deleted user", and confirming by typing their email; admins cannot delete themselves. The request hides the user's recipes, profile and comments at once and ends their session within 5 minutes. For 30 days a Google sign-in is refused and offers "Undo deletion" instead, which restores exactly the earlier visibility. Migration `0004` adds `users.deletion_requested_at`, `users.deletion_keep_recipes` and `recipe_flags.comment_id` (#103)
- **account**: signed-in users can download their own data as JSON from `GET /api/account/export` ("Download my data" on `/profile/edit`); the export covers every user-owned table, omits OAuth tokens and API key hashes, is never cached, is limited to 3 per hour, and fails with 500 rather than return a partial file (#58)
- **moderation**: recipe reports accept a `harassment` reason, confirm receipt ("we review reports within 7 days") and reject a second report from the same user; admins can hide and unhide a comment (`setCommentHidden`), and each report in `/admin/flags` has dismiss, hide-recipe (`moderation_status` `rejected`) and remove-recipe (`deleted_at`/`deleted_by`) actions that record reviewer and time (#59)
- **auth**: the header user icon shows the signed-in user's Google profile picture, with name initials (else email) when there is none or it fails to load
- **legal**: public `/privacy` and `/terms` pages, linked from the footer, the sitemap and `/sign-in` ("By continuing you agree to the Terms and Privacy Policy"); the support contact is `NEXT_PUBLIC_SUPPORT_EMAIL`, defaulting to `support@1mc.io` (#35)
- **auth**: sign-in uses Auth.js (NextAuth v5) with Google as the only provider and 7-day JWT sessions; `/sign-in` shows one "Continue with Google" button and `/sign-up` redirects to it (#22)
- **auth**: registration is closed — only a Google account with a verified email that matches a pre-seeded `users` row can sign in; a database error, a missing email or an unknown email denies the login (#22)
- **db**: migration 0023 adds `users` (with `is_admin`), `accounts` and `verification_tokens`; rollback SQL in `drizzle/rollback/0023_authjs_users.down.sql` (#22)
- **auth**: `pnpm auth:seed-user --id <users.id> [--email <email>] [--admin]` pre-seeds a sign-in user; without `--email` it uses the single address in `AUTH_ADMIN_EMAILS` (#22)
- **auth**: `AUTH_ADMIN_EMAILS` (comma-separated, case-insensitive) lets a listed, Google-verified email sign in without a seeded row and sets its `users.is_admin` at sign-in; unset grants nothing (#22)
- **costs**: per-call crawl cost ledger (`crawl_cost_events`) with a rate table and `trackCost()`; Tavily, Firecrawl, Jina, OpenRouter, Anthropic, Perplexity, Brave, SerpAPI and DALL-E calls record one row each, tagged with the discovery run id when one is in scope (#6)
- **crawl**: per-run cost and budget on `recipe_discovery_runs` (`cost_usd`, `budget_usd`, `cost_write_failures`); a run stops making paid calls once its in-memory spend reaches its budget (`CRON_RUN_BUDGET_USD`, default $5) and ends `partial` (#6)
- **crawl**: `recipe_discovery_run_items`, one row per URL attempted with its extraction tier and outcome (#6)
- **crawl**: `reapStaleDiscoveryRuns()` marks `running` runs `failed` after 15 minutes (`daily`, `manual`) or 6 hours (`local`); the daily cron calls it before each run (#6)
- **crawl**: run budgets are clamped to `MAX_RUN_BUDGET_USD` ($100); the weekly crawl checks the budget before each paid URL; `/api/recipes/scrape` caps `maxResults` at 50 (#6)
- **crawl**: admin-only read API in `@/app/actions/crawl-monitor` over `@/lib/crawl-monitor`: paged discovery runs with item counts by outcome, run detail with items and ledger cost by provider and operation, spend for today, this month (UTC) and all time, and one newest-first list of discovery runs and scraping jobs (#6)
- **crawl**: failed item writes add one `item writes failed: N` error to the run; the cron and `/api/recipes/scrape` responses carry `tracked` (#6)
- **crawl**: the local and pm2 scrapers (`scraper:daily`, `scraper:once`, `continuous-scraper.ts`, `/api/recipes/scrape`) record discovery runs with `run_type` `local` or `manual` (#6)
- **admin**: `/admin/crawl-monitor` shows crawl spend for today, this month and all time with tables by provider and by provider and operation, the running job (polled every 12 s while a run is live and the tab is visible), a paged run history with expandable run detail, and a confirmed "Run crawl now" button backed by the admin-only `triggerManualCrawl` action, which starts one budgeted `manual` discovery run and refuses while one is running (#6)

### Changed

- **search**: query and recipe embeddings are computed in-process with `BAAI/bge-small-en-v1.5` (fp32 ONNX via `@huggingface/transformers`, CLS pooling, normalized, 384 dimensions), the model that wrote ~93% of the stored vectors; search queries carry the BGE retrieval prefix, recipes do not. The Jina embeddings call, its cost booking and the `jina:embeddings` rate are removed, so embedding costs $0 and is not blocked by the daily cost cap; there is no remote fallback. `prebuild` downloads the pinned, sha256-checked model into `models/`, and new rows are labelled `BAAI/bge-small-en-v1.5` instead of the stale MiniLM name. `scripts/verify-bge-parity.ts <db-url>` re-embeds stored rows and checks cosine >= 0.99 (#96, D57)
- **db**: one baseline migration, `drizzle/0000_baseline_from_prod.sql`, replaces migrations 0000-0023 (moved to `drizzle/archive/`); the code schema now matches production, including `api_keys`/`api_key_usage`, `ingredients.is_suitable_for_image`, six indexes, three CHECK constraints, prod's FK names, `tools.slug` NOT NULL and the `recipe_embeddings.model_name` default; `drizzle/baseline-mark-applied.sql` records the baseline on production without running it (#9, #7)
- **auth**: admin access comes from `users.is_admin`; `requireAdmin` and `checkAdminAccess` re-read it on every call and deny on a database error, and the session's `isAdmin` copy refreshes every 5 minutes (#22)
- **api**: the API-key layer reports `authType: 'session'` instead of `'clerk'` (#22)
- **crawl**: a partial discovery run is stored with status `partial` instead of `completed`; POST `/api/cron/daily-recipe` runs are stored with `run_type` `manual` instead of `daily` (#6)

### Removed

- **auth**: Clerk (`@clerk/nextjs`, the Clerk proxy and dev config, `/api/clerk-config`, `/api/clerk-proxy`, `/api/debug-clerk`, `/api/debug-session`, `/api/security-audit`), Google One Tap, the `ADMIN_USER_IDS` / `NEXT_PUBLIC_ADMIN_USER_IDS` admin lists, the Clerk validation scripts and the `recipes.help` fallbacks (#22)

### Fixed

- **slideshow**: reordering slideshow photos works again; `reorderPhotos` used `db.transaction`, which the neon-http driver rejects, and now writes every position in one atomic `db.batch` (#34)
- **home**: the hero slideshow shows the `public/backgrounds` images in production again; the list comes from `src/generated/background-images.json`, which `scripts/generate-background-manifest.ts` regenerates in `prebuild` (or `pnpm generate:backgrounds`), because the Vercel function bundle has no `public/` dir to read at runtime. An empty list is now reported as an error (#38)
- **crawl**: the daily-recipe cron stops starting work 30s before its 300s function limit, abandons an in-flight extraction, and finalizes the run `partial` with counters, duration and cost (the larger of in-memory spend and the run's `crawl_cost_events` sum); a failed finalize write is logged CRITICAL and fails the request instead of reporting success. The stale-run reaper cutoff drops from 900s to 360s and fills a null `cost_usd` from the ledger and a null `duration_ms` (#6)
- **recipes**: `/recipes` (the public recipe list) is reachable signed out again; a stale Clerk-era rule redirected it to `/sign-in`. `getRecipesPaginated` now caps the page size at 100, and the "similar recipes" link uses the recipe slug
- **rate-limit**: the recipe discovery panel and the meal pairing wizard show a rate-limit, limiter-outage or cost-ceiling refusal with its retry time instead of "Discovery complete!" or a bare error
- **substitutions**: removed the unused `getIngredientSubstitutions` server action, which any client could call to reach the paid AI substitution path with no rate limit; `getMultipleIngredientSubstitutions` is the only substitution action
- **rate-limit**: every remaining signed-in paid path checks a per-user bucket before its provider call, with UTC-day windows: `discoverRecipe` (`recipe-generation`, 30), `uploadRecipeWithAI`/`previewRecipeParse` (`recipe-parse`, 40), `uploadRecipeFromUrl`/`parseRecipeFromUrl`/`discoverRecipeFromUrl` (`recipe-url-import`, 30), `searchWebRecipes` (`web-recipe-search`, 30), `discoverRecipes` (`recipe-discovery`, 5, now at most 10 URLs per call), `getRecipeRecommendations` (`meal-recommendations`, 50) and `POST /api/brave-search` (`brave-search`, 100); `POST /api/ingest-recipe` counts each URL against a per-API-key `recipe-ingest-api` bucket (100). Over the limit actions return `RATE_LIMITED` and routes 429 with Retry-After; with the limiter down they return `LIMITER_UNAVAILABLE` / 503; the daily cost ceiling now reaches callers with its typed code instead of being swallowed by provider wrappers and fallbacks
- **rate-limit**: `generateBalancedMeal` checks a per-user `meal-pairing` bucket (5 calls per 60 s) before its paid LLM call; over the limit it returns `RATE_LIMITED`, with the limiter down it returns `LIMITER_UNAVAILABLE`, and the daily cost ceiling returns its typed code instead of a plain error
- **embeddings**: saving a recipe embedding is a single upsert on `recipe_id`, so a repeat or concurrent save replaces the row instead of failing with a unique-constraint error (23505)
- **costs**: a paid call with missing or zero usage (LLM response without `usage`, empty Jina reader page, Firecrawl crawl with no credits or pages, Tavily extract with nothing extracted) now books a typical-call floor cost instead of $0, and a short Jina reader cost rounds up to the ledger's $0.000001 resolution (#77)
- **costs**: Jina embedding calls book tokens × `JINA_USD_PER_TOKEN`, rounded up to $0.000001, so semantic search spend counts toward the $10/day cap instead of being stored as $0; a response without usage is estimated from input length (#75)
- **search**: home search autocomplete ranks exact and prefix matches above substring matches, drops duplicate suggestions (case, plural or repeated row), shows stocks and broths as "stocks" instead of Dairy, and shows each row left-aligned with the category as a separate badge (#47)
- **security**: collections, meals, chef pages, favorites, likes and view history show a recipe only if the viewer may read it, whoever owns the container; adding a recipe the caller cannot see to a collection, meal, meal plan, favorites or likes, or flagging or view-tracking it, answers "Recipe not found" as for a nonexistent recipe (web actions and `/api/v1`) (#41)
- **actions**: `createRecipe` and `updateRecipe` (and `POST`/`PATCH /api/v1/recipes`) write only an allowlist of recipe columns. `is_system_recipe`, `chef_id` and `license` are kept only for an admin; the owner, ids, slug, timestamps, moderation, ratings and counters, QA and soft-delete columns from the client are ignored. `updateRecipe` now sets `updated_at` (#33)
- **perf**: recipe comments, the recipe inventory match, and the admin hero-background and slideshow managers each load once on mount instead of re-sending server-action POSTs in a loop (5-7 req/s per open tab); recipe comments fetch the comments and their count in one action
- **crawl**: recipe inserts no longer fail with Postgres 22P02 when extraction returns text such as `"4 to 6"` for `servings`, `prep_time` or `cook_time`; every insert path writes an integer or null (a range keeps its low end, `"3 quarts"` keeps 3, text with no digits becomes null). A failed insert records the Postgres message and SQLSTATE in the run errors and the run item instead of drizzle's `Failed query` text (#12)
- **api**: POST `/api/recipes/scrape` requires an admin session or `Authorization: Bearer <CRON_SECRET>`; other callers get 401 (403 for a signed-in non-admin) before any crawl starts. `test/scripts/standalone-scraper.ts` sends the bearer and exits if `CRON_SECRET` is unset (#11)
- **api**: POST `/api/batch-import-small`, `/api/batch-import-single` and `/api/crawl/weekly` require an admin session or `Authorization: Bearer <CRON_SECRET>`; `/api/crawl/weekly` no longer trusts a `localhost` `Host` header. The unused `/api/batch-import` route is removed. `test/scripts/batch-import-*.sh` and `test/scripts/test-crawl.ts` send the bearer and exit if `CRON_SECRET` is unset (#13)
- **actions**: the `crawlWeeklyRecipes`, `crawlAndStoreRecipes` and `convertUrlToRecipe` server actions require an admin and throw `Admin access required` before any paid call. `searchRecipesOnline`, `storeRecipe` and `validateRecipe` are no longer client-callable actions. The crawl pipeline moves to `src/lib/recipe-crawl.ts` for routes, cron and scripts. The unguarded `/test-crawl` page is removed; use `/admin/crawl` (#13)
- **actions**: `searchWebRecipes` and `parseRecipeFromUrl` return an `Authentication required` error to a signed-out caller before any OpenRouter call; their only UI, `/discover`, already requires sign-in. The unused `estimateRecipePrice` action is removed (#13)
- **actions**: the Joanie comment writes (`createComment`, `updateComment`, `deleteComment`), the hero background and slideshow admin actions, `getScrapingJobStatus`, `updateChefRecipeCount` and `classifyRecipe` require an admin; before, any visitor (comments, scraping status, chef count, classification) or any signed-in user (hero backgrounds, slideshow) could call them. `getRecipeRecommendations` requires sign-in before its OpenRouter call. `fetchRecipeFromUrl`, `parseRecipeContent` and `ingestRecipeFromUrl` check admin once, before Firecrawl or the LLM, and deny when the check throws. Scripts call `classifyAndStoreRecipe` in `src/lib/ai/classify-recipe.ts` (#13)

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
