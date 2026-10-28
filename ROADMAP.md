# Joanie's Kitchen Roadmap

**Launch date: Friday 2027-01-01.**
**Last updated:** 2026-10-28 (r3)

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

## How we work

Work runs on two parallel tracks. Each track has its own engineer and owns its own files.

- **Track A, platform and safety:** M0, then the M1 safety gate, then M3.
- **Track B, features:** the M1 core loop and V1.1. The V1.1 schema and UI work starts in the second week of M0, not in M2.

There is no schedule buffer except the freeze. All of V1.1 ships at launch, and there is no cut list.

## Schedule

| Milestone | Due | Track | Theme |
|-----------|-----|-------|-------|
| M0 | Fri 2026-11-06 | A | Foundation, legal and hygiene |
| M1 | Fri 2026-11-20 | A and B | Core loop, and the safety gate for open sign-up |
| M2 | Fri 2026-12-04 | B (plus two items on A) | V1.1 zero-waste features |
| M3 | Fri 2026-12-18 | A, with B fixing bugs | Launch readiness |
| Freeze | 2026-12-19 to 2026-12-31 | Both | Fixes for launch blockers only |
| Launch | Fri 2027-01-01 | | Go live |

First, ahead of everything else: the `/privacy` and `/terms` pages, and a check of the admin POST requests that pile up.

### M0: Foundation, legal and hygiene (due 2026-11-06, Track A)

- Legal and consent screen:
  - `/privacy` and `/terms`, linked from the footer and `/sign-in`;
  - a published support contact (until a contact address is chosen, the GitHub issues page);
  - the Google OAuth consent screen set to "In production". With only the basic scopes (openid, email, profile), Google does not require app verification. Brand verification is needed only if the consent screen shows a logo.
- Schema drift (#7, #9): one baseline migration that matches production, and a decision on the `*_backup_*` tables. **The baseline must land before any V1.1 migration.**
- Staging: a Vercel staging alias with its own Neon branch, `AUTH_*` variables and Google redirect URIs.
- CI and test debt:
  - GitHub Actions running `tsc`, `vitest` and lint on every PR;
  - branch protection on main;
  - the 4 failing tests fixed;
  - a ratchet so the `tsc` error count can only go down.
- Clean-ups:
  - the launch date corrected in the repo and on the site (the AlphaStamp component and its e2e test);
  - #24 (the retired OpenRouter model);
  - #26 (untrack the test artifacts);
  - Clerk wrap-up: verify and close #22 and #21, remove the `CLERK_*` Vercel variables, and fix Clerk references in current docs;
  - remove the dead pm2 `recipe-scraper` and `scraper:*` scripts.

### M1: Core loop and the sign-up safety gate (due 2026-11-20)

**Open sign-up.** Anyone with a Google account can sign up. Sign-up fails closed: an unverified email, or any provider other than Google, is refused.

**Track A, the safety gate.** All of these must be done before sign-up opens:
- #17: a rate limit on public semantic search, and no rerank for anonymous users.
- Cost guard: a daily spend ceiling across AI, search and crawl, with an alert when it is crossed and a hard stop at the cap.
- Error monitoring and alerting for server and client errors, and uptime checks on `/` and the auth endpoints.
- A Neon backup and restore drill, with the restore time recorded.
- Account deletion and data export (JSON). Both are self-serve, so the privacy policy can say more than "on request".
- Content reporting, with a moderation queue in `/admin` (hide, restore, ban). Moderation goes first, because V1.1 community features depend on it.
- Open sign-up itself:
  - remove the `/registration-closed`, `/sign-up` and `/user-profile` leftovers;
  - add a test proving that an unverified email, or any provider other than Google, is refused.

**Gate:** sign-up opens on 2026-11-20 only if every item above is done. If one slips, sign-up opens when it lands, and no later than the M3 date. We do not open sign-up unsafe.

**Track B, the core loop:**
- #2: home page images, smart substitutions and "recipes like this" fixed or confirmed fixed.
- Profiles, favorites, collections, ratings, comments and sharing verified end to end as a signed-in Google user.
- A shopping list page that goes from a meal to a list. Only the API exists today.
- Finish the plan-a-week flow in `/meals`.

### M2: V1.1 zero-waste features (due 2026-12-04, Track B)

Track B starts this work in the second week of M0. All of it ships at launch.

- Persistent fridge and inventory, saved per user, with expiry dates.
- Expiry alerts (use-first notifications). They use one notification channel (email), shared with the crawler alerts.
- Waste-impact dashboard: what each user has saved and used.
- Community substitution sharing. User-submitted substitutions go through the M1 moderation queue.
- One schema migration for all V1.1 tables, dry-run on staging, then applied to production with a Neon rollback branch.

Required, on Track A:
- Recipe attribution and takedown: crawled recipes show source and author and link to the original. A published takedown process, with an admin action that removes a recipe and blocks its source URL from re-crawl.
- Crawler alerts (the deferred S5 of #6): sent on the shared notification channel for a budget breach or failed runs.

### M3: Launch readiness (due 2026-12-18, Track A)

- Content: set the recipe count and quality bar, and audit recipe, ingredient and chef pages.
- Performance: Core Web Vitals on home, recipe, search, sign-in and fridge pages.
- SEO: sitemap, metadata and OG images.
- Accessibility: WCAG AA checks on the core flows only.
- Load: a smoke test of the core flows at expected launch traffic.
- Staging rehearsal: deploy the launch build to staging, run the checklist, then promote to production.

### Freeze (2026-12-19 to 2026-12-31)

The freeze is the only buffer: 13 days.
- Only fixes for launch blockers go in, each verified on staging before production.
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
- Photo recognition of fridge contents.
- AI substitutions that account for allergies and diet.
- Social challenges.
- Garden integration and seasonal produce guides.
- Community recipe contributions.
- Environmental impact tracking.
