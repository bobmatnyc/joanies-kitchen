/**
 * Route protection rules for the edge middleware — #22. Edge-safe (no imports).
 *
 * Why: the Clerk `createRouteMatcher` rules are kept, but as a pure function
 * so they can be tested without a running edge runtime.
 * What: `decideRoute` maps a path plus the session's user id and JWT admin
 * flag to `allow`, `sign-in` (redirect), `unauthorized` (401 for APIs) or
 * `home` (signed-in non-admin on /admin). Server components and actions
 * still re-check admin against the database.
 * Test: `src/lib/__tests__/auth-routes.test.ts`
 */

export type RouteDecision = 'allow' | 'sign-in' | 'unauthorized' | 'home';

const PUBLIC = [
  /^\/$/,
  /^\/sign-in/,
  /^\/sign-up/,
  /^\/shared/,
  /^\/discover/,
  /^\/meals$/,
  /^\/api\/auth\//,
];
const PROTECTED = [
  /^\/recipes\/new/,
  /^\/recipes\/edit/,
  /^\/recipes$/,
  /^\/meals\/new/,
  /^\/meal-plans/,
];
const PROTECTED_API = [
  /^\/api\/recipes\/create$/,
  /^\/api\/recipes\/update$/,
  /^\/api\/recipes\/delete$/,
  /^\/api\/meal-plans/,
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

  if (!session.userId) {
    if (PROTECTED_API.some((re) => re.test(path))) return 'unauthorized';
    if (PROTECTED.some((re) => re.test(path))) return 'sign-in';
  }
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
