/**
 * #22: the removed client auth shim built a new user object on every render, and the
 * recipe fetch effect depends on `user`, so a signed-in visitor refetched the recipe
 * and re-tracked a view on every render. SessionProvider also replaces the session with
 * a freshly parsed, equal object on its 5-minute poll and on tab focus, so the effect
 * must key on the user's id and admin flag, not on the object.
 * The real useSessionUser runs here over a mocked useSession.
 */
import { act, render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipePageClient from '@/app/recipes/[slug]/RecipePageClient';

const getRecipe = vi.hoisted(() => vi.fn());
const trackRecipeView = vi.hoisted(() => vi.fn(async () => undefined));
const ROUTER = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
/** A new session object equal to every other, as SessionProvider's refetch produces. */
const freshSession = vi.hoisted(() => () => ({
  data: {
    user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@x.test', image: null, isAdmin: false },
    expires: '2099-01-01',
  },
  status: 'authenticated',
}));
const session = vi.hoisted(() => ({ current: freshSession() }));

vi.mock('next/navigation', () => ({
  // #202: throws like Next's real notFound(), so a call inside the async effect rejects.
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  // Stable like Next's router; a new object per call would itself rerun the fetch effect.
  useRouter: () => ROUTER,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('next-auth/react', () => ({ useSession: () => session.current, signIn: vi.fn() }));
vi.mock('@/app/actions/recipes', () => ({ getRecipe, deleteRecipe: vi.fn() }));
vi.mock('@/app/actions/recipe-cloning', () => ({ getOriginalRecipe: vi.fn(async () => null) }));
vi.mock('@/app/actions/recipe-export', () => ({
  exportRecipeAsMarkdown: vi.fn(),
  exportRecipeAsPDF: vi.fn(),
}));
vi.mock('@/app/actions/recipe-views', () => ({
  getRecipeViewCount: vi.fn(async () => 0),
  trackRecipeView,
}));
vi.mock('@/app/actions/user-profiles', () => ({ getProfileByUserId: vi.fn(async () => null) }));
// Page sections unrelated to the hero image.
// A marker for the admin-only actions; the sign-out test asserts it disappears.
vi.mock('@/components/admin/AdminContentActions', () => ({
  AdminContentActions: () => <span>admin actions</span>,
}));
vi.mock('@/components/admin/AdminEditMode', () => ({
  AdminEditModeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/admin/FlagImageButton', () => ({ FlagImageButton: () => null }));
vi.mock('@/components/admin/RecipeContentWithEdit', () => ({ RecipeContentWithEdit: () => null }));
vi.mock('@/components/admin/RecipeImageFlag', () => ({ RecipeImageFlag: () => null }));
vi.mock('@/components/collections/AddToCollectionButton', () => ({
  AddToCollectionButton: () => null,
}));
vi.mock('@/components/favorites/FavoriteButton', () => ({ FavoriteButton: () => null }));
vi.mock('@/components/recipe/BackToChef', () => ({ BackToChef: () => null }));
vi.mock('@/components/recipe/CloneRecipeButton', () => ({ CloneRecipeButton: () => null }));
vi.mock('@/components/recipe/FlagButton', () => ({ FlagButton: () => null }));
vi.mock('@/components/recipe/InventoryMatchSection', () => ({ InventoryMatchSection: () => null }));
vi.mock('@/components/recipe/RatingDisplay', () => ({ RatingDisplay: () => null }));
vi.mock('@/components/recipe/RecipeComments', () => ({ RecipeComments: () => null }));
vi.mock('@/components/recipe/RecipeEngagementStats', () => ({
  RecipeEngagementStats: () => null,
  RecipeForkAttribution: () => null,
}));
vi.mock('@/components/recipe/RecipeRatings', () => ({ RecipeRatings: () => null }));
vi.mock('@/components/recipe/SemanticTagDisplay', () => ({ SemanticTagDisplay: () => null }));
vi.mock('@/components/recipe/SubstitutionSuggestionsWrapper', () => ({
  SubstitutionSuggestionsWrapper: () => null,
}));
vi.mock('@/components/recipe/WasteReductionSection', () => ({ WasteReductionSection: () => null }));
// The page loads tag-ontology through a CommonJS `require('@/lib/...')`, which vitest
// cannot resolve; no tags skips that branch. Image parsing stays the real parseRecipe.
vi.mock('@/lib/utils/recipe-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/recipe-utils')>();
  return {
    ...actual,
    parseRecipe: (row: Parameters<typeof actual.parseRecipe>[0]) => ({
      ...actual.parseRecipe(row),
      tags: undefined,
    }),
  };
});

const ROW = {
  id: 'r-22',
  slug: 'plain-soup',
  name: 'Plain Soup',
  user_id: 'system',
  is_system_recipe: true,
  ingredients: '[]',
  instructions: '[]',
  tags: '[]',
  images: null,
  image_url: null,
};

const PARAMS = Promise.resolve({ slug: 'plain-soup' });
const settle = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

function expectBoundedFetches() {
  expect(getRecipe.mock.calls.length).toBeLessThanOrEqual(2);
  expect(trackRecipeView.mock.calls.length).toBeLessThanOrEqual(2);
}

beforeEach(() => {
  getRecipe.mockReset();
  trackRecipeView.mockClear();
  session.current = freshSession();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('recipe page fetch (#22)', () => {
  it('signed in: fetches the recipe and tracks the view a bounded number of times', async () => {
    getRecipe.mockResolvedValue({ success: true, data: ROW });
    render(<RecipePageClient params={PARAMS} />);
    await screen.findByAltText('Recipe placeholder');
    // Let effects and the background fetches settle; a per-render refetch keeps going.
    await settle(300);
    expectBoundedFetches();
  });

  it('an equal but new session object (poll, tab focus) does not refetch', async () => {
    getRecipe.mockResolvedValue({ success: true, data: ROW });
    const { rerender } = render(<RecipePageClient params={PARAMS} />);
    await screen.findByAltText('Recipe placeholder');
    await settle(50);
    for (let i = 0; i < 3; i++) {
      session.current = freshSession();
      rerender(<RecipePageClient params={PARAMS} />);
      await settle(50);
    }
    expectBoundedFetches();
  });
});

describe('recipe page sign-out and user switch (#22)', () => {
  const OWNED = { ...ROW, user_id: 'u1', is_system_recipe: false };
  const SIGNED_OUT = { data: null, status: 'unauthenticated' } as unknown as ReturnType<
    typeof freshSession
  >;

  function sessionFor(id: string, isAdmin: boolean) {
    const fresh = freshSession();
    return { ...fresh, data: { ...fresh.data, user: { ...fresh.data.user, id, isAdmin } } };
  }

  /** Renders the page for u1, an admin who owns the recipe, and waits for both action sets. */
  async function renderAsAdminOwner() {
    session.current = sessionFor('u1', true);
    getRecipe.mockResolvedValue({ success: true, data: OWNED });
    const view = render(<RecipePageClient params={PARAMS} />);
    await screen.findByText('admin actions');
    expect(screen.getByRole('button', { name: 'Edit recipe' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete recipe' })).toBeTruthy();
    return view;
  }

  function expectNoOwnerActions() {
    expect(screen.queryByRole('button', { name: 'Edit recipe' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete recipe' })).toBeNull();
  }

  it('signing out clears the admin and owner actions', async () => {
    const { rerender } = await renderAsAdminOwner();
    session.current = SIGNED_OUT;
    rerender(<RecipePageClient params={PARAMS} />);
    await settle(50);

    expect(screen.queryByText('admin actions')).toBeNull();
    expectNoOwnerActions();
  });

  it('signing out clears them when the refetch fails (a private recipe)', async () => {
    const { rerender } = await renderAsAdminOwner();
    getRecipe.mockResolvedValue({ success: false, error: 'Recipe not found' });
    session.current = SIGNED_OUT;
    rerender(<RecipePageClient params={PARAMS} />);
    await settle(50);

    expect(getRecipe).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('admin actions')).toBeNull();
    expectNoOwnerActions();
  });

  it('switching to another signed-in user clears the owner actions', async () => {
    const { rerender } = await renderAsAdminOwner();
    session.current = sessionFor('u2', false);
    rerender(<RecipePageClient params={PARAMS} />);
    await settle(50);

    expect(getRecipe).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('admin actions')).toBeNull();
    expectNoOwnerActions();
  });
});

/**
 * #202: a failed refetch called notFound() inside the async effect. That only rejected
 * the effect's promise, so the previously loaded private recipe stayed on screen.
 */
describe('recipe page failed refetch after sign-out (#202)', () => {
  const PRIVATE = { ...ROW, name: 'Secret Stew', user_id: 'u1', is_system_recipe: false };
  const SIGNED_OUT = { data: null, status: 'unauthenticated' } as unknown as ReturnType<
    typeof freshSession
  >;
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);

  beforeEach(() => {
    rejections.length = 0;
    vi.mocked(notFound).mockClear();
    process.on('unhandledRejection', onRejection);
    return () => {
      process.off('unhandledRejection', onRejection);
    };
  });

  async function signOutAfterOwnerView(refetch: () => void) {
    getRecipe.mockResolvedValue({ success: true, data: PRIVATE });
    const view = render(<RecipePageClient params={PARAMS} />);
    await screen.findByRole('heading', { name: 'Secret Stew' });
    refetch();
    session.current = SIGNED_OUT;
    view.rerender(<RecipePageClient params={PARAMS} />);
    await settle(50);
  }

  /** Rejections first: with the throwing mock, notFound() in the effect surfaces there. */
  function expectNotFoundView() {
    expect(rejections).toEqual([]);
    expect(notFound).not.toHaveBeenCalled();
    expect(getRecipe).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Secret Stew')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeTruthy();
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('a {success:false} refetch replaces the recipe with the not-found view', async () => {
    await signOutAfterOwnerView(() =>
      getRecipe.mockResolvedValue({ success: false, error: 'Recipe not found' })
    );
    expectNotFoundView();
  });

  it('a thrown refetch replaces the recipe with the not-found view', async () => {
    await signOutAfterOwnerView(() => getRecipe.mockRejectedValue(new Error('network down')));
    expectNotFoundView();
  });

  it('a public recipe stays visible after sign-out', async () => {
    getRecipe.mockResolvedValue({ success: true, data: ROW });
    const { rerender } = render(<RecipePageClient params={PARAMS} />);
    await screen.findByRole('heading', { name: 'Plain Soup' });
    session.current = SIGNED_OUT;
    rerender(<RecipePageClient params={PARAMS} />);
    await settle(50);

    expect(getRecipe).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { name: 'Plain Soup' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Page Not Found' })).toBeNull();
  });

  it('a failed first load shows the not-found view, not a skeleton', async () => {
    getRecipe.mockResolvedValue({ success: false, error: 'Recipe not found' });
    render(<RecipePageClient params={PARAMS} />);
    await screen.findByRole('heading', { name: 'Page Not Found' });
    expect(getRecipe).toHaveBeenCalledTimes(1);
    expect(notFound).not.toHaveBeenCalled();
    expect(rejections).toEqual([]);
  });

  it("a stale owner response that lands after sign-out's failed fetch is ignored", async () => {
    const ownerFetch = deferred<{ success: true; data: typeof PRIVATE }>();
    getRecipe.mockReturnValueOnce(ownerFetch.promise);
    getRecipe.mockResolvedValueOnce({ success: false, error: 'Recipe not found' });
    const { rerender } = render(<RecipePageClient params={PARAMS} />);
    await vi.waitFor(() => expect(getRecipe).toHaveBeenCalledTimes(1));

    session.current = SIGNED_OUT;
    rerender(<RecipePageClient params={PARAMS} />);
    await screen.findByRole('heading', { name: 'Page Not Found' });
    await act(async () => ownerFetch.resolve({ success: true, data: PRIVATE }));
    await settle(50);

    expect(getRecipe).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Secret Stew')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Page Not Found' })).toBeTruthy();
  });

  it('a refetch that times out after 5 s replaces the recipe with the not-found view', async () => {
    getRecipe.mockResolvedValue({ success: true, data: PRIVATE });
    const { rerender } = render(<RecipePageClient params={PARAMS} />);
    await screen.findByRole('heading', { name: 'Secret Stew' });
    vi.useFakeTimers();
    try {
      getRecipe.mockReturnValue(new Promise(() => undefined));
      session.current = SIGNED_OUT;
      rerender(<RecipePageClient params={PARAMS} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4900);
      });
      expect(screen.getByRole('heading', { name: 'Secret Stew' })).toBeTruthy();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
    } finally {
      vi.useRealTimers();
    }
    expectNotFoundView();
  });
});
