import { getUserFavoriteIds } from '@/app/actions/favorites';

export interface FavoriteState {
  userId: string | null;
  pathname: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  ids: ReadonlySet<string>;
}

const NO_IDS: ReadonlySet<string> = new Set();
const IDLE: FavoriteState = { userId: null, pathname: null, status: 'idle', ids: NO_IDS };

let state = IDLE;
// Toggle results received since the current load started. They are newer than
// what that load may have read, so they win when it resolves.
let toggledDuringLoad = new Map<string, boolean>();
let loadToken = 0;
const listeners = new Set<() => void>();

function publish(next: FavoriteState) {
  state = next;
  for (const listener of listeners) listener();
}

function withToggles(ids: Iterable<string>): ReadonlySet<string> {
  const next = new Set(ids);
  for (const [recipeId, favorited] of toggledDuringLoad) {
    if (favorited) next.add(recipeId);
    else next.delete(recipeId);
  }
  return next;
}

export function subscribeFavoriteState(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getFavoriteState = () => state;
export const getServerFavoriteState = () => IDLE;

/**
 * Why: #269 — every FavoriteButton asked the server for its own state, so a page
 * of N cards made N calls.
 * What: makes one `getUserFavoriteIds` call per signed-in user and pathname,
 * however many buttons ask. The id list is complete, so cards that appear later
 * on the same page need no call. Moving to another path reloads once, which picks
 * up changes made in another tab. A failed load sets `status: 'error'` with no
 * ids and is not retried until the next path.
 * Test: `src/components/favorites/__tests__/favorite-state-calls269.test.tsx`
 */
export function ensureFavoriteStateLoaded(userId: string, pathname: string | null) {
  if (state.userId === userId && state.pathname === pathname) return;

  // Known state stays on screen during a reload, so hearts do not flicker.
  const keepKnown = state.userId === userId && state.status === 'ready';
  const token = ++loadToken;
  toggledDuringLoad = new Map();
  publish({
    userId,
    pathname,
    status: keepKnown ? 'ready' : 'loading',
    ids: keepKnown ? state.ids : NO_IDS,
  });

  getUserFavoriteIds().then(
    (ids) => {
      if (token !== loadToken) return;
      publish({ ...state, status: 'ready', ids: withToggles(ids) });
    },
    (error) => {
      if (token !== loadToken) return;
      console.error('Failed to load favorite state:', error);
      publish({ ...state, status: 'error', ids: withToggles(NO_IDS) });
    }
  );
}

/** Records a toggle's result, so every copy of the recipe on the page shows it. */
export function setFavoriteState(userId: string, recipeId: string, favorited: boolean) {
  if (state.userId !== userId) return;
  toggledDuringLoad.set(recipeId, favorited);
  publish({ ...state, ids: withToggles(state.ids) });
}
