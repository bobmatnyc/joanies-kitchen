# Joanie's Kitchen Roadmap

**Launch date: Friday 2027-01-01.**
**Last updated:** 2026-10-28

This is the roadmap of record. Older roadmaps are in [docs/archive/roadmap-2025](docs/archive/roadmap-2025/).

Joanie's Kitchen helps people waste less food by cooking with what they already have.

## Values filter

Before we build a feature, we ask:
1. Does it help people waste less food?
2. Does it promote cooking with what you have?
3. Would Joanie approve?
4. Does it serve resourcefulness, not consumption?

If the answer to any of these is no, we do not build it.

## Tracking

Work is tracked on the GitHub milestones M0 to M3, and issues carry the `launch` label. The milestone due dates below are the dates of record.

## Schedule

| Milestone | Due | Theme |
|-----------|-----|-------|
| M0 | Fri 2026-11-06 | Foundation, legal and hygiene |
| M1 | Fri 2026-11-20 | Core user loop, safe to open (held, see below) |
| M2 | Fri 2026-12-04 | Buffer, plus zero-waste features |
| M3 | Fri 2026-12-18 | Launch readiness |
| Freeze | 2026-12-19 to 2026-12-31 | Bug fixes only |
| Launch | Fri 2027-01-01 | Go live |

### M0: Foundation, legal and hygiene (due 2026-11-06)

- Launch date corrected in the repo and on the site (the AlphaStamp component and its e2e test).
- Privacy policy and terms of service, linked from the footer and `/sign-in`.
- Google OAuth consent screen: privacy and terms URLs, "In production", submitted for Google verification. Verification can take weeks, so it starts here.
- A published support contact, also linked on the consent screen.
- A staging environment: its own Neon branch, `AUTH_*` variables and Google redirect URIs.
- CI on every PR (`tsc`, `vitest`, lint), with branch protection on main.
- Test debt: fix the 4 failing tests on main. Take the 56 `tsc` errors to 0, or add a ratchet that blocks new ones.
- Schema drift (#7, #9): one baseline migration that matches production, and a decision on the `*_backup_*` tables.
- #17: rate-limit public semantic search and skip rerank for anonymous users.
- Clerk wrap-up: verify and close #22 and #21, remove the `CLERK_*` Vercel variables, and fix Clerk references in current docs.
- Remove the dead pm2 `recipe-scraper` and `scraper:*` scripts.

### M1: Core user loop, safe to open (due 2026-11-20)

**Held.** M1 build work waits for the owner's registration decision. Auth.js (#22) admits only pre-seeded users and the emails in `AUTH_ADMIN_EMAILS`. The options are:
- (a) open Google sign-up to anyone;
- (b) an invite list or waitlist;
- (c) read-only launch: public browsing, accounts by invite.

Before registration opens:
- Error monitoring and alerting for server and client errors.
- A Neon backup and restore drill, with the restore time recorded.
- Account deletion and data export (JSON).
- Content reporting, with an admin queue in `/admin` (hide, restore, ban).

The core loop:
- Sign-up, implemented to the chosen model. Clean up `/registration-closed`, `/sign-up` and `/user-profile`.
- #2: home page images, smart substitutions and "recipes like this" fixed or confirmed fixed.
- Profiles, favorites, collections, ratings, comments and sharing verified end to end as a signed-in Google user.
- A shopping list page that goes from a meal to a list. Only the API exists today.
- Finish the plan-a-week flow in `/meals`.

### M2: Buffer, plus zero-waste features (due 2026-12-04)

M2 is the schedule buffer. If M0 or M1 slips, cut from the list below in this order. Whatever is cut moves to "After launch".

Required:
- Recipe attribution and takedown: crawled recipes show source and author and link to the original. A published takedown process, with an admin action that removes a recipe and blocks its source URL from re-crawl.
- Crawler alerts (the deferred S5 of #6): email or Slack on a budget breach or failed runs.

Cut list, first cut first:
1. Waste-impact dashboard (saved and used).
2. Expiry alerts (use-first notifications).
3. Persistent fridge and inventory, saved per user.
4. Fix for the `triggerManualCrawl` double-start race (low risk, since runs are budget-capped).

### M3: Launch readiness (due 2026-12-18)

- Content: set the recipe count and quality bar, and audit recipe, ingredient and chef pages.
- Performance: Core Web Vitals on home, recipe, search, sign-in and fridge pages.
- SEO: sitemap, metadata and OG images.
- Accessibility: WCAG AA checks on the core flows only.
- Load: a smoke test of the core flows at expected launch traffic.
- Cost guard: a spend ceiling and alert for AI and crawl costs.
- Uptime checks on `/` and the auth endpoints.
- Staging rehearsal: deploy the launch build to staging, run the checklist, then promote to production.

### Freeze (2026-12-19 to 2026-12-31)

- Bug fixes only, each verified on staging before production.
- A launch checklist (`GO_LIVE_PLAN.md`) with a rollback plan and named people on call.

### Launch (Fri 2027-01-01)

- Remove the AlphaStamp, or change it to "Launched".
- Announcement.
- Watch for 72 hours: error rate, sign-ups, spend and the support inbox.

## Shipped so far

- Phases 1-6 (October 2025): "What's in Your Fridge?" matching, ingredient substitutions, recipe resourcefulness scores, rescue-ingredient and learning guides, 4,644 recipes, 495 ingredient pages, search and SEO foundation.
- Phase 7 groundwork: REST API v1, type-safe data layer, and an automated recipe and chef crawler.
- Crawl spend monitoring and admin dashboard (#6).
- Auth on paid routes (#11, #13).
- Auth.js with Google sign-in, replacing Clerk (#22).

## After launch

Ideas from the old roadmap. None is scheduled.
- Waste-impact dashboard, expiry alerts and persistent fridge, if cut from M2.
- Community substitutions.
- Photo recognition of fridge contents.
- AI substitutions that account for allergies and diet.
- Social challenges.
- Garden integration and seasonal produce guides.
- Community recipe contributions.
- Environmental impact tracking.
