# Brief: signed-in check for Auth.js (restore point pre-0023-authjs)

- **Requested by:** Architect, task ar-T7c, 2026-11-07 00:29Z.
- **Runner:** Codex. This check is read-only: do not delete any Neon branch, edit data, or submit forms.
- **Claimed by:** no one else. The tm-joanies-kitchen-01 ledger has no claim on this check, and no other session has reported one.

## Target

- **Production URL:** https://joanies.kitchen. This is the apex domain; www redirects to it. Do not use `recipes.help`.
- **Commit:** `39e9a11`, "feat: drop recipe_likes table (#167 PR3b) (#291)". This is `origin/main` at 2026-11-07 00:30Z.
- **Vercel deployment:** `dpl_8gCzf4FMdetHLDjDYZs5xTttJVmw` (`joanies-kitchen-5d98i4cq7-1-m.vercel.app`), Vercel scope `1-m`. Before you start, confirm that production still serves this deployment. If it has changed, record the new commit.
- **What the check covers:** Auth.js replaced Clerk in [#23](https://github.com/bobmatnyc/joanies-kitchen/pull/23) ([#22](https://github.com/bobmatnyc/joanies-kitchen/issues/22)). Production signs in only with Google OAuth (`src/auth.config.ts`). The `signIn` callback in `src/auth.ts` admits only pre-seeded, verified emails. Production has 1 `users` row and 1 `accounts` row.

## Steps (read-only)

1. Open https://joanies.kitchen in a private window. In the header, confirm you are signed out.
2. Open https://joanies.kitchen/favorites. Confirm it redirects to `/sign-in`, or shows a sign-in prompt instead of favorites data.
3. On `/sign-in`, choose Google and sign in with the pre-seeded account. Do not use any other account, and do not open `/sign-up`.
4. After the redirect, confirm the header shows the signed-in avatar and a menu.
5. Load each of these pages and confirm it renders with no error page and no redirect to `/sign-in`. Do not submit anything.
   - `/profile/recipes`
   - `/profile/collections`
   - `/favorites`
   - `/my-meals`
6. Reload `/favorites`. Confirm you are still signed in, which shows the session persists.
7. In the browser console, note any errors on the pages above.
8. Sign out from the header menu. Then confirm that `/favorites` sends you back to `/sign-in`.

## Pass criteria

- Google sign-in completes and lands on the site signed in.
- All four pages in step 5 render for the signed-in user, with no 4xx or 5xx response and no auth error.
- The session survives a reload.
- Sign-out works, and the protected page is gated again.
- No console errors that mention auth, session, `users`, `accounts`, or Clerk.

On PASS, the Architect may approve deleting the Neon branch `pre-0023-authjs-20261028` (`br-holy-dust-ad6s5d8o`). That deletion is not part of this check.

## Report back

Send the Architect:
- PASS or FAIL for each step.
- The deployment ID and commit that production served.
- The UTC times of sign-in and sign-out.
- A screenshot of the signed-in header.
- Any console errors, quoted exactly.
