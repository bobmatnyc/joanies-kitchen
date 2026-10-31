/**
 * Route protection rules for the edge middleware — #22. Edge-safe (no imports).
 *
 * Why: route rules as a pure function, so they can be tested without a
 * running edge runtime.
 * What: `decideRoute` maps a path plus the session's user id and JWT admin
 * flag to `allow`, `sign-in` (redirect) or `home` (signed-in non-admin on
 * /admin). Server components, actions and API routes re-check auth
 * themselves.
 * `/recipes/<slug>/edit` is guarded by its page, not here.
 * Test: `src/lib/__tests__/auth-routes.test.ts`
 */

export type RouteDecision = 'allow' | 'sign-in' | 'home';

const PUBLIC = [
  /^\/$/,
  /^\/sign-in/,
  /^\/sign-up/,
  /^\/shared/,
  /^\/discover/,
  /^\/meals$/,
  // Legal pages: Google's OAuth consent screen links to both.
  /^\/privacy$/,
  /^\/terms$/,
  /^\/api\/auth\//,
];
const PROTECTED = [
  /^\/recipes\/new/,
  // /recipes is public: the page lists only public recipes (47b8c93).
  /^\/meals\/new/,
];

export function decideRoute(
  path: string,
  session: { userId: string | null; isAdmin: boolean }
): RouteDecision {
  if (PUBLIC.some((re) => re.test(path))) return 'allow';

  const isViewingRecipe =
    /^\/recipes\/[a-zA-Z0-9-]+$/.test(path) && !path.endsWith('/new') && !path.includes('/edit');
  const isViewingMeal = /^\/meals\/[a-zA-Z0-9-]+$/.test(path) && !path.endsWith('/new');
  if (isViewingRecipe || isViewingMeal) return 'allow';

  if (/^\/admin/.test(path)) {
    if (!session.userId) return 'sign-in';
    // #22: JWT copy of users.is_admin (≤5 min stale); pages re-check the DB.
    return session.isAdmin ? 'allow' : 'home';
  }

  if (!session.userId && PROTECTED.some((re) => re.test(path))) return 'sign-in';
  return 'allow';
}

/**
 * Returns a same-origin path for a post-sign-in redirect, or '/'. Rejects
 * absolute URLs and protocol-relative `//host` values (open redirect).
 */
export function safeCallbackPath(value: string | string[] | undefined): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/';
  return value;
}
