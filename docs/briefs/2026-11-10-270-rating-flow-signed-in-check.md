# Brief: signed-in check of the report flow for rating reviews (issue #270, PR #286, check ar-T8d)

- **Requested by:** Architect, check ar-T8d, 2026-11-10. Limits per Architect ruling of 21:04Z.
- **Runner:** Codex, one session. Signed-out gating is already confirmed; this brief covers the signed-in part.
- **Write budget:** UI actions only, in this order: (1) one rating with review text, (2) one UI Delete of that same rating at the end. No other write. No role grant, no SQL write, no data edit. Read-only SQL for verification is run by the PM, not by Codex.
- **Claimed by:** no one else.

## What #270 is, and what this session can and cannot close

[#270](https://github.com/bobmatnyc/joanies-kitchen/issues/270) is "Add a report flow for rating reviews", merged as PR #286 (squash `996c067`; migration 0009 applied to prod 2026-11-05). It is still OPEN. Its acceptance reads: a signed-in user can report a rating review, and reports reach the admin moderation queue where an admin can act on them. The last issue comment lists as "Not yet exercised": a signed-in report of a review, auto-hide, and an admin act on a review flag.

Prod has one user. That user is also the admin. The code rules below make most of those three items impossible to exercise with that one identity, so this session exercises what it can and marks the rest "not exercisable, covered by test". Do not invent workarounds (no second account, no sign-up, no role change, no SQL).

| Close criterion | Verdict | Why (evidence) |
| --- | --- | --- |
| Signed-in write of a rating with review text (the data a report targets) | Exercisable | `rateRecipe`, `src/app/actions/rate-recipe.ts:133-214`; the insert sets `review_hidden = false` at line 93. |
| A signed-in user reports a review | Not exercisable with one user | `reportRatingReview` refuses the caller's own review: `src/app/actions/report-rating-review.ts:91-93` ("You cannot report your own review"); the UI also shows no Flag button on your own review (`canReport` requires `!isOwner`, `src/components/recipe/ReviewsList.tsx:201-203`). Covered by `review-reports.test.ts::reportRatingReview > stores a report in recipe_flags with rating_id` and `... > refuses a report on your own review and stores nothing` (`src/app/actions/__tests__/review-reports.test.ts:185`, `:199`). |
| Auto-hide of a reported review | Not exercisable | Needs 3 distinct pending reporters (`REVIEW_AUTO_HIDE_THRESHOLD = 3`, `src/lib/review-moderation.ts:25`; counted as distinct `recipe_flags.user_id` with status `pending`, line 48). Only one user exists, and that user cannot report their own review. Covered by `review-reports.test.ts::reportRatingReview > hides at exactly the third distinct reporter, not the second` (`:232`) and `... > counts a repeat report by one user once and never hides on one user alone` (`:224`). |
| How a hidden review renders to others | Not exercisable (needs a hidden review) | Covered by `review-reports.test.ts::public read of a hidden review > shows review: null with the stars unchanged, and flags the author only` (`:307`) and `... > hiding the text leaves the stars and the recipe aggregates unchanged` (`:240`). |
| Admin acts on a review report (dismiss / hide / remove / unhide) | Not exercisable | Needs a `recipe_flags` row with `rating_id` set, or a hidden review. None can exist: prod has 0 `recipe_flags` rows, and a report cannot be created (above). The admin actions (`applyReviewFlagAction`, `unhideReviewResolvingReports`, `actOnHiddenReview`) act only on a pending report or a hidden review (`src/lib/review-moderation.ts:64-80`, `src/app/actions/flag-recipe.ts:466,518`, `src/app/actions/hidden-reviews.ts:106`). Covered by `review-reports.test.ts::moderation queue for review reports` (`:339`: `lists a review report with its text and hidden state`, `refuses a non-admin`, `dismiss closes one report and never unhides`, `hide hides the text and resolves every pending report`, `remove clears the text, keeps the rating and the aggregates, and resolves the reports`, `unhide restores the text, dismisses pending reports, ...`, `a stale hide or remove on a closed report writes nothing`) and `hidden reviews panel actions` (`:443`), plus `src/components/admin/__tests__/hidden-reviews-panel.test.tsx`. |
| Admin queue page renders the review panel on the post-0009 prod schema | Exercisable, read-only | `/admin/flags` renders `HiddenReviewsPanel`, titled "Hidden reviews (N)", with "No reviews are hidden." when empty (`src/components/admin/HiddenReviewsPanel.tsx:63-70`). |
| Deleting a rating removes its reports | Exercisable only for the rating (no reports exist) | FK `recipe_flags.rating_id` is `ON DELETE CASCADE` (`src/lib/db/schema.ts:372`); covered by `review-reports.test.ts::deleting a rating > deletes its reports and leaves other reports alone` (`:483`). |

**Because the report step cannot be exercised, the sequence stops after the read-only admin page check and goes straight to cleanup.** The session therefore does not close #270's three "not yet exercised" items by live run; it closes what the one-user prod can show, and the Architect decides whether the test coverage above is enough.

## How admin is determined, and who is admin

- Admin is the column `users.is_admin`, re-read from the database on every server check (`src/lib/admin.ts:9-40`, `checkAdminAccess` calls `getUserAdminFlag`). The JWT copy `session.user.isAdmin` is used only by middleware and UI hints and can be up to 5 minutes stale (`src/lib/auth-callbacks.ts:33`).
- The env list `AUTH_ADMIN_EMAILS` (`src/lib/auth-env.ts:36-51`) can also set `is_admin = true` at sign-in for a listed, verified email (`src/lib/auth-callbacks.ts:105-151`). No code path in this check grants a role, and Codex must not try.
- Read-only prod query on 2026-11-10: `SELECT id, is_admin FROM users` returns one row, `user_344DZgMGjLal97M6kBrMvBVS3XD`, `is_admin = true`. **The pre-seeded account is itself the admin.** There is no separate admin identity to sign in as. Do not look for "Bob's admin sign-in" in the browser; if the browser holds a different Google account, do not use it.

## Target

- **Production URL:** https://joanies.kitchen (apex; www redirects to it). Do not use `recipes.help`.
- **Commit:** `0833981`, "chore(deps-dev): bump the npm-minor-patch group across 1 directory with 4 updates (#310)". This is `origin/main`.
- **Vercel deployment:** `dpl_CW5YgvpUoUjHNLAPw3nu4hxGwQCR`, Vercel scope `1-m`. Before you start, confirm production still serves this deployment. If it has changed, record the new commit and deployment and tell the PM before you write anything.
- **Primary recipe:** "George's at the Cove Black Bean Soup"
  - Slug: `georges-cove-black-bean-soup`
  - URL: https://joanies.kitchen/recipes/georges-cove-black-bean-soup
  - Recipe id: `bebc490e-1ebd-437f-a3dd-a478a7c3cb0b`
- **Fallback recipe** (only if the primary page errors, is missing, or already shows a rating): "Pumpkin Spice Cupcakes"
  - Slug: `pumpkin-spice-cupcakes`
  - URL: https://joanies.kitchen/recipes/pumpkin-spice-cupcakes
  - Recipe id: `c5b2563c-0bb6-4ef5-85f0-0587f75b6bd6`
- **Why these two:** both are public, `approved`, system-imported (`user_id = 'system_imported'`, `is_system_recipe = true`, no chef), so the test user does not own them. A read-only prod query at 2026-11-10 shows both with `avg_user_rating` NULL and `total_user_ratings` 0. Prod `recipe_ratings` has 0 rows and `recipe_flags` has 0 rows, so the test user has no rating on either recipe and no report exists.
- **Before values, signed-out (record first, in a private window, before you sign in):** expected no rating summary in the recipe header, and in Ratings & Reviews a "Sign in to Rate" button and "No Reviews Yet". The page is client-rendered, so wait for it to load. Record what you see, with a screenshot. If the primary shows any rating or review, use the fallback. If both do, stop and report.

## Test identity

- Sign in with Google using the single pre-seeded prod account only (prod has 1 `users` row and 1 `accounts` row). It is both the rater and the admin.
- Do not use any other Google account. Do not open `/sign-up`. Do not create or link any account.

## The permitted writes

1. **The rating.** On the target recipe page, signed in: click the **4 stars** button (`aria-label="4 stars"`), click **Write a review (optional)**, type exactly this review text (neutral, 45 characters, under the 500 limit):

   `Simple and tasty. Test review, to be deleted.`

   Then click **Submit Rating** once. Do not double-click, retry or re-submit. If it fails, do not retry; stop and report.
   Expected effect: one new `recipe_ratings` row (rating 4, that review text, `review_hidden = false`) for this user and recipe; the recipe's aggregates become `avg_user_rating = 4.0`, `total_user_ratings = 1`.
2. **The cleanup delete.** The Architect has given GO. After verification, delete that rating through the UI (see Cleanup). No second GO is needed.

Everything else is read-only. Do not: edit the rating or review, use any Flag or Report control (there is none on your own review; if one appears, do not click it), use favorites, collections, meals, comments, fork, edit or delete any recipe, change profile settings, or press any button on `/admin/flags`. Opening pages and scrolling is fine.

## Steps

1. Private window. Open the primary recipe URL signed out. Record before values and screenshot (S1). Open DevTools console and network tab (preserve log on).
2. Go to https://joanies.kitchen/sign-in. Choose Google and sign in with the pre-seeded account. Record the UTC time.
3. Return to the primary recipe URL. Confirm the header shows the signed-in avatar. Scroll to Ratings & Reviews. Expect a "Your Rating" card titled "Rate this Recipe" with five stars and a disabled "Submit Rating" button. The "Sign in to Rate" button must be gone. Screenshot (S2).
4. Clear the network log. Click the 4-star button (label reads "Rating (4 stars)"), click "Write a review (optional)", type the review text above. Screenshot (S3).
5. Click Submit Rating once. Record the UTC time. Watch for the toast "Rating submitted!" (S4).
6. Network evidence for the write: find the POST to the recipe page URL with a `Next-Action` request header (server action `rateRecipe`). Record its HTTP status (expect 200) and the response body. A success body contains `"success":true`, `"rating":4`, `"avgUserRating":4` and `"totalRatings":1`. Two follow-up POSTs (`getUserRating`, `getRecipeRatings`) are normal. Any 4xx/5xx, or a body with `"success":false` and an `error` message, is a FAIL.
7. UI after write, without reload: the card reads "Your Rating" / "Update your rating or add a review", the button "Update Rating" (disabled), the text "Your rating has been saved", and "Delete" appears. The reviews list shows one entry from this user with 4 stars and the review text, with edit and delete icons and **no Flag icon** (screenshot S5). Record whether the summary ("Based on 1 rating", "All Reviews (1)", header rating) already updated. It reads cached page props and may only update after a reload; that alone is not a failure.
8. Hard reload (Ctrl/Cmd+Shift+R). Expect: header rating `4.0` with `1 rating`; "Based on 1 rating"; "All Reviews (1)"; "Your Rating" card shows 4 stars selected and the review text in its textarea; the review entry shows the text and is not marked hidden (S6).
9. **Report step: not exercisable. Do not attempt it.** Record only that your own review shows no Flag control (S5/S6). Do not call any report action by other means (no console calls, no URL tricks).
10. **Auto-hide: not exercisable. Skip.**
11. **Admin page, read-only.** Open https://joanies.kitchen/admin/flags (same session, which is admin). Expect the page to load with no redirect to `/sign-in` and no error, the tabs for Pending / Under Review / Resolved / Dismissed, and a "Hidden reviews (0)" panel reading "No reviews are hidden." Pending count should be 0. Screenshot (S7). Note any console errors. Press nothing on this page except scrolling. If the page redirects to `/sign-in` or shows a forbidden screen, record it (that would mean the admin claim is stale or `is_admin` differs from the DB; do not try to fix it) and continue to cleanup.
12. Return to the target recipe page. Do the cleanup below.

## Cleanup (GO given)

1. In the "Your Rating" card, click **Delete**. Accept the browser confirm "Are you sure you want to delete your rating?" (`src/components/recipe/RatingInput.tsx:79-103`). Expect the toast "Rating deleted". The call is `deleteRating`, `src/app/actions/rate-recipe.ts:346-407`; it deletes the row and recomputes the aggregates in one batch.
2. Record the delete POST's HTTP status (expect 200, no `"success":false`) and body. Screenshot (S8).
3. Hard reload. Expect the page back to the before state: no header rating, "Rate this Recipe", empty textarea, no review entry. Screenshot (S9).
4. Open the fallback recipe page read-only to confirm it still shows no rating (proves no write hit another recipe).
5. Sign out from the header menu. Confirm `/favorites` sends you to `/sign-in`. Record the UTC time.
6. If Delete fails, stop. Do not retry more than once, do not touch the database, and report. The PM will report to the Architect; SQL deletion is not authorised in this session.

## Verification the PM/ops run (read-only SQL)

Prod branch (Neon project `autumn-forest-97440143`, branch `br-super-hall-adskawq1`), read-only session. Tables and columns: `recipe_ratings` (`src/lib/db/schema.ts:336-358`: `id, recipe_id, user_id, rating, review, review_hidden, created_at, updated_at`), `recipes.avg_user_rating` / `total_user_ratings` (`schema.ts:174-175`), `recipe_flags` (`schema.ts:361-412`).

Run A, after the write and before the delete (if the PM can run it at that moment; otherwise rely on Codex's UI evidence):

```sql
SELECT id, recipe_id, user_id, rating, review, review_hidden, created_at, updated_at
FROM recipe_ratings;
-- expect 1 row: recipe_id = 'bebc490e-1ebd-437f-a3dd-a478a7c3cb0b',
-- user_id = 'user_344DZgMGjLal97M6kBrMvBVS3XD', rating = 4,
-- review = 'Simple and tasty. Test review, to be deleted.', review_hidden = false

SELECT slug, avg_user_rating, total_user_ratings
FROM recipes WHERE id = 'bebc490e-1ebd-437f-a3dd-a478a7c3cb0b';
-- expect 4.0 and 1

SELECT count(*) FROM recipe_flags;                                  -- expect 0 (no report was made)
SELECT count(*) FROM recipes WHERE total_user_ratings > 0;          -- expect 1
```

Run B, after the cleanup delete (all must hold):

```sql
SELECT count(*) FROM recipe_ratings;                                 -- expect 0
SELECT slug, avg_user_rating, total_user_ratings
FROM recipes WHERE id = 'bebc490e-1ebd-437f-a3dd-a478a7c3cb0b';      -- expect NULL and 0
SELECT count(*) FROM recipes WHERE total_user_ratings > 0 OR avg_user_rating IS NOT NULL;  -- expect 0
SELECT count(*) FROM recipe_flags;                                   -- expect 0
SELECT count(*) FROM recipe_flags WHERE rating_id IS NOT NULL;       -- expect 0
```

## Leftover-data risk

- **Report rows:** none are created in this session (no report is possible), so `recipe_flags` stays at 0. If one ever existed, the FK `recipe_flags.rating_id ... ON DELETE CASCADE` (`src/lib/db/schema.ts:372`) removes it with the rating, and the UI delete comment says the same (`rate-recipe.ts:381`). A cascade failure is therefore not a risk, and no SQL write is needed or allowed.
- **Aggregates:** the delete recomputes `avg_user_rating` and `total_user_ratings` from the table in the same batch (`rate-recipe.ts:385-392`); the empty case gives NULL and 0, the starting state. If Run B shows anything else, report it to the Architect; do not fix it.
- **Not checked, low risk:** a sign-in may update timestamps on the `users` or `accounts` row; the Auth.js JWT session needs no session row, but I did not read the adapter code for a last-login write. These are not rating data.
- **If cleanup fails or Codex stops early:** one `recipe_ratings` row (rating 4, the review text above) remains on the target recipe, and the aggregates read 4.0 / 1. Report this immediately.

## Pass / fail

PASS needs all of these:
- Google sign-in completes; the recipe page shows the rating input in place of "Sign in to Rate".
- The write call returns HTTP 200 with `"success":true`, `"rating":4`, `"totalRatings":1`; toast "Rating submitted!".
- The UI shows the review text with 4 stars immediately; after a hard reload the page shows 4.0 from 1 rating, and the stars and text persist.
- Your own review shows no Flag control.
- `/admin/flags` loads for the admin session and shows "Hidden reviews (0)" / "No reviews are hidden." (or, if it redirects, that is recorded and the Architect decides; it is a FAIL of that step only).
- Delete succeeds (200, toast, page back to before state); Run B holds.
- No console errors that mention auth, session, rating, `recipe_ratings`, `review_hidden`, `recipe_flags` or a failed server action. No error page, no redirect to `/sign-in` while signed in (except the admin page case above).

The report, auto-hide and admin-act criteria are reported as "not exercisable, covered by test" with the table above. They are neither PASS nor FAIL for Codex.

A summary that only updates after reload (step 7) is a note, not a FAIL.

## Stop conditions

Stop at once, make no further clicks (except the cleanup Delete if a rating exists), and report if:
- Any error page, 5xx, auth error, or "Application error" screen on the recipe page.
- The Google flow asks for an account other than the pre-seeded one, or offers sign-up or account creation.
- The target (and fallback) already shows any rating or review, or the "Your Rating" card already shows a rating by this user.
- The write call fails, returns `"success":false`, or fires more than once.
- A rating shows up on any recipe other than the target, or "All Reviews" shows more than one entry.
- Your own review shows a Flag or Report control, or any prompt asks you to report, flag or moderate anything.
- `/admin/flags` shows a non-zero pending count or a hidden review (something exists that the PM did not expect). Do not act on it.
- Production serves a commit other than `0833981` and you have not yet told the PM.

## Report back to the Architect

- PASS or FAIL per step (1 to 12 and cleanup 1 to 5), and overall.
- Commit and deployment id that production served (and whether it matched `0833981` / `dpl_CW5YgvpUoUjHNLAPw3nu4hxGwQCR`).
- Recipe used (primary or fallback), with full URL.
- Before values (signed-out) and after values (immediately after the write; after hard reload; after the delete): header rating, rating count, "All Reviews" count, "Your Rating" card state, review text shown.
- Network: for the write POST and the delete POST, the URL, HTTP status and response body (exact text).
- `/admin/flags` result: loaded or redirected, the pending count, the "Hidden reviews" text.
- UTC times of sign-in, rating submit, delete, sign-out.
- Screenshots: S1 signed-out before, S2 signed-in empty card, S3 4 stars and review typed, S4 toast after submit, S5 reviews list (no Flag icon), S6 after hard reload, S7 `/admin/flags`, S8 after delete, S9 after delete and reload.
- Console errors, quoted exactly (or "none").
- Cleanup state: "deleted via UI, page back to before state", or "delete failed, rating still present", and whether you are signed out.
- Anything unexpected you saw, even if you did not stop.
