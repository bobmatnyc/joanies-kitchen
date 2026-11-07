/**
 * #269: favorite-state server calls must not scale with the number of cards, and
 * a signed-out visitor makes none. Assertions count action calls and read what the
 * button shows; they do not look at the shared state directly.
 */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useLayoutEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@/lib/db/schema';

const mocks = vi.hoisted(() => ({
  isFavorited: vi.fn(),
  getUserFavoriteIds: vi.fn(),
  toggleFavorite: vi.fn(),
  toastError: vi.fn(),
  auth: { value: { isLoaded: true, user: null as { id: string } | null } },
  nav: { pathname: '/search' },
}));

vi.mock('@/app/actions/favorites', () => ({
  isFavorited: mocks.isFavorited,
  getUserFavoriteIds: mocks.getUserFavoriteIds,
  toggleFavorite: mocks.toggleFavorite,
}));
vi.mock('@/lib/use-session-user', () => ({ useSessionUser: () => mocks.auth.value }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => mocks.nav.pathname,
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import { RecipeCard } from '@/components/recipe/RecipeCard';
import { FavoriteButton } from '../FavoriteButton';

function recipe(id: string): Recipe {
  return {
    id,
    name: `Recipe ${id}`,
    slug: id,
    tags: '[]',
    images: '[]',
    image_url: 'https://images.unsplash.com/photo.jpg',
    updated_at: new Date('2026-01-01'),
  } as unknown as Recipe;
}

const recipes = (count: number, start = 0) =>
  Array.from({ length: count }, (_, i) => recipe(`r${start + i}`));

const Cards = ({ list }: { list: Recipe[] }) => {
  // #296: a list may repeat a recipe on purpose, so key each copy by id plus its
  // occurrence of that id, not by array index (noArrayIndexKey).
  const seen = new Map<string, number>();
  return (
    <>
      {list.map((r) => {
        const copy = seen.get(r.id) ?? 0;
        seen.set(r.id, copy + 1);
        return <RecipeCard key={`${r.id}-${copy}`} recipe={r} />;
      })}
    </>
  );
};

const stateCalls = () =>
  mocks.isFavorited.mock.calls.length + mocks.getUserFavoriteIds.mock.calls.length;

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function hearts() {
  return screen
    .getAllByRole('button')
    .filter((button) => button.querySelector('svg.lucide-heart') !== null);
}

const heartOf = (name: string, index = 0) => {
  const card = screen.getAllByRole('article', { name })[index];
  const heart = Array.from(card.querySelectorAll('button')).find((b) =>
    b.querySelector('svg.lucide-heart')
  );
  if (!heart) throw new Error(`no favorite button on ${name}`);
  return heart;
};

const isShownFavorited = (button: HTMLElement) =>
  button.querySelector('svg.lucide-heart')?.classList.contains('fill-current') ?? false;

/** Records, at every commit, whether the first heart shows as favorited. */
// #296: module level, so React sees one component type (noComponentHookFactories).
function CommitProbe({ commits, children }: { commits: boolean[]; children: ReactNode }) {
  useLayoutEffect(() => {
    commits.push(isShownFavorited(hearts()[0]));
  });
  return <>{children}</>;
}

// The shared state outlives a test by design; a new user starts it fresh.
let userCounter = 0;
function signIn() {
  userCounter += 1;
  mocks.auth.value = { isLoaded: true, user: { id: `user-${userCounter}` } };
}

describe('favorite-state server calls (#269)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.nav.pathname = '/search';
    mocks.isFavorited.mockResolvedValue(false);
    mocks.getUserFavoriteIds.mockResolvedValue([]);
    mocks.toggleFavorite.mockResolvedValue({ success: true, isFavorited: true });
  });

  it.each([1, 5, 50])('makes one call for %i signed-in cards', async (count) => {
    signIn();
    render(<Cards list={recipes(count)} />);
    await flush();

    expect(hearts()).toHaveLength(count);
    expect(stateCalls()).toBe(1);
  });

  it.each([1, 50])('makes no calls for %i signed-out cards', async (count) => {
    mocks.auth.value = { isLoaded: true, user: null };
    render(<Cards list={recipes(count)} />);
    await flush();

    expect(hearts()).toHaveLength(count);
    expect(stateCalls()).toBe(0);
    for (const heart of hearts()) {
      expect(isShownFavorited(heart)).toBe(false);
      expect(heart).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('refuses a signed-out click without a server call or navigation', async () => {
    mocks.auth.value = { isLoaded: true, user: null };
    render(<Cards list={recipes(1)} />);
    await flush();

    const notPrevented = fireEvent.click(heartOf('Recipe r0'));
    await flush();

    expect(notPrevented).toBe(false);
    expect(mocks.toggleFavorite).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Sign in'));
  });

  it('does not follow the card link when a heart is toggled', async () => {
    signIn();
    render(<Cards list={recipes(1)} />);
    await flush();

    let notPrevented = true;
    await act(async () => {
      notPrevented = fireEvent.click(heartOf('Recipe r0'));
    });
    await flush();

    expect(notPrevented).toBe(false);
    expect(mocks.toggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('does not follow the card link from a heart that is still loading', async () => {
    signIn();
    mocks.getUserFavoriteIds.mockReturnValue(new Promise(() => undefined));
    render(<Cards list={recipes(1)} />);
    await flush();

    // A disabled button has pointer-events-none, so the click lands on its wrapper.
    const wrapper = heartOf('Recipe r0').parentElement as HTMLElement;
    expect(fireEvent.click(wrapper)).toBe(false);
  });

  it('shows no stale favorites after the session ends', async () => {
    signIn();
    mocks.getUserFavoriteIds.mockResolvedValue(['r0']);
    const { rerender } = render(<FavoriteButton recipeId="r0" />);
    await flush();
    expect(isShownFavorited(hearts()[0])).toBe(true);

    mocks.auth.value = { isLoaded: true, user: null };
    rerender(<FavoriteButton recipeId="r0" />);
    await flush();

    expect(isShownFavorited(hearts()[0])).toBe(false);
  });

  it("never commits one user's favorites while a second user's load is unresolved", async () => {
    signIn();
    mocks.getUserFavoriteIds.mockResolvedValue(['r0']);
    const first = render(<FavoriteButton recipeId="r0" />);
    await flush();
    expect(isShownFavorited(hearts()[0])).toBe(true);
    first.unmount();

    signIn();
    mocks.getUserFavoriteIds.mockReturnValue(new Promise(() => undefined));
    // Layout effects see the first commit, before the load effect replaces the state.
    const commits: boolean[] = [];
    render(
      <CommitProbe commits={commits}>
        <FavoriteButton recipeId="r0" />
      </CommitProbe>
    );
    await flush();

    expect(commits.length).toBeGreaterThan(0);
    expect(commits).not.toContain(true);
    expect(isShownFavorited(hearts()[0])).toBe(false);
    expect(hearts()[0]).toBeDisabled();
  });

  describe('when an older load finishes after a newer one', () => {
    function deferred() {
      let resolve: (ids: string[]) => void = () => undefined;
      let reject: (error: Error) => void = () => undefined;
      const promise = new Promise<string[]>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    /** Starts a load on path A, then one on path B that resolves to ['r0']. */
    async function loadPathAThenB() {
      signIn();
      const pathA = deferred();
      const pathB = deferred();
      mocks.getUserFavoriteIds.mockReturnValueOnce(pathA.promise);
      mocks.getUserFavoriteIds.mockReturnValueOnce(pathB.promise);

      mocks.nav.pathname = '/path-a';
      const a = render(<FavoriteButton recipeId="r0" />);
      await flush();
      a.unmount();

      mocks.nav.pathname = '/path-b';
      render(<FavoriteButton recipeId="r0" />);
      await flush();
      expect(mocks.getUserFavoriteIds).toHaveBeenCalledTimes(2);

      await act(async () => pathB.resolve(['r0']));
      await flush();
      expect(isShownFavorited(hearts()[0])).toBe(true);
      return pathA;
    }

    it('keeps the newer result when the older load resolves', async () => {
      const pathA = await loadPathAThenB();
      await act(async () => pathA.resolve([]));
      await flush();

      expect(isShownFavorited(hearts()[0])).toBe(true);
    });

    it('keeps the newer result when the older load rejects', async () => {
      const pathA = await loadPathAThenB();
      await act(async () => pathA.reject(new Error('late failure')));
      await flush();

      expect(isShownFavorited(hearts()[0])).toBe(true);
      expect(hearts()[0]).toHaveAttribute('aria-disabled', 'false');
    });
  });

  it('makes no calls while the session is still loading', async () => {
    mocks.auth.value = { isLoaded: false, user: null };
    render(<Cards list={recipes(3)} />);
    await flush();

    expect(stateCalls()).toBe(0);
    for (const heart of hearts()) expect(heart).toBeDisabled();
  });

  it('shows the right state on each card, and on cards added later, without a new call', async () => {
    signIn();
    mocks.getUserFavoriteIds.mockResolvedValue(['r1', 'r3']);
    const { rerender } = render(<Cards list={recipes(2)} />);
    await flush();

    expect(isShownFavorited(heartOf('Recipe r0'))).toBe(false);
    expect(isShownFavorited(heartOf('Recipe r1'))).toBe(true);

    rerender(<Cards list={recipes(4)} />);
    await flush();

    expect(isShownFavorited(heartOf('Recipe r2'))).toBe(false);
    expect(isShownFavorited(heartOf('Recipe r3'))).toBe(true);
    expect(stateCalls()).toBe(1);
  });

  it('updates every copy of a recipe when one is toggled, with no new state call', async () => {
    signIn();
    const list = [recipe('r0'), recipe('r1'), recipe('r0')];
    render(<Cards list={list} />);
    await flush();

    await act(async () => {
      fireEvent.click(heartOf('Recipe r0', 0));
    });
    await flush();

    expect(mocks.toggleFavorite).toHaveBeenCalledTimes(1);
    expect(mocks.toggleFavorite).toHaveBeenCalledWith('r0');
    expect(isShownFavorited(heartOf('Recipe r0', 0))).toBe(true);
    expect(isShownFavorited(heartOf('Recipe r0', 1))).toBe(true);
    expect(isShownFavorited(heartOf('Recipe r1'))).toBe(false);
    expect(stateCalls()).toBe(1);
  });

  it('leaves state unchanged when a toggle is refused', async () => {
    signIn();
    mocks.toggleFavorite.mockResolvedValue({ success: false, error: 'nope' });
    render(<Cards list={recipes(1)} />);
    await flush();

    await act(async () => {
      fireEvent.click(heartOf('Recipe r0'));
    });
    await flush();

    expect(isShownFavorited(heartOf('Recipe r0'))).toBe(false);
  });

  it('keeps a toggle that finishes while a load is still in flight', async () => {
    signIn();
    render(<Cards list={recipes(1)} />);
    await flush();

    // A reload on the next path reads the old value, then the toggle lands first.
    let resolveLoad: (ids: string[]) => void = () => undefined;
    mocks.getUserFavoriteIds.mockReturnValue(
      new Promise<string[]>((resolve) => {
        resolveLoad = resolve;
      })
    );
    mocks.nav.pathname = '/recipes';
    const { unmount } = render(<FavoriteButton recipeId="r0" />);
    await flush();
    expect(mocks.getUserFavoriteIds).toHaveBeenCalledTimes(2);
    unmount();

    await act(async () => {
      fireEvent.click(heartOf('Recipe r0'));
    });
    await flush();
    await act(async () => resolveLoad([]));
    await flush();

    expect(isShownFavorited(heartOf('Recipe r0'))).toBe(true);
  });

  it('shows the right state on a FavoriteButton used alone', async () => {
    signIn();
    mocks.getUserFavoriteIds.mockResolvedValue(['solo']);
    render(<FavoriteButton recipeId="solo" />);
    await flush();

    expect(isShownFavorited(hearts()[0])).toBe(true);
    expect(stateCalls()).toBe(1);
  });

  it('reloads once on a new page, picking up changes from elsewhere', async () => {
    signIn();
    const { unmount } = render(<Cards list={recipes(3)} />);
    await flush();
    expect(isShownFavorited(heartOf('Recipe r1'))).toBe(false);
    unmount();

    mocks.getUserFavoriteIds.mockResolvedValue(['r1']);
    mocks.nav.pathname = '/favorites';
    render(<Cards list={recipes(3)} />);
    await flush();

    expect(stateCalls()).toBe(2);
    expect(isShownFavorited(heartOf('Recipe r1'))).toBe(true);
  });

  it('never shows one user the favorites of another', async () => {
    signIn();
    mocks.getUserFavoriteIds.mockResolvedValue(['r0']);
    const { unmount } = render(<Cards list={recipes(1)} />);
    await flush();
    expect(isShownFavorited(heartOf('Recipe r0'))).toBe(true);
    unmount();

    signIn();
    mocks.getUserFavoriteIds.mockResolvedValue([]);
    render(<Cards list={recipes(1)} />);
    await flush();

    expect(isShownFavorited(heartOf('Recipe r0'))).toBe(false);
    expect(stateCalls()).toBe(2);
  });

  describe('when the load fails', () => {
    it('shows no favorite, keeps the card, blocks the toggle, and does not retry per card', async () => {
      signIn();
      mocks.getUserFavoriteIds.mockRejectedValue(new Error('db down'));
      render(<Cards list={recipes(3)} />);
      await flush();

      expect(screen.getByRole('article', { name: 'Recipe r0' })).toHaveTextContent('Recipe r0');
      for (const heart of hearts()) {
        expect(isShownFavorited(heart)).toBe(false);
        // Not `disabled`: that adds pointer-events-none, which hides the title.
        expect(heart).not.toBeDisabled();
        expect(heart).toHaveAttribute('aria-disabled', 'true');
        expect(heart).toHaveAttribute('title', expect.stringContaining('Reload the page'));
      }
      expect(stateCalls()).toBe(1);
      expect(mocks.toggleFavorite).not.toHaveBeenCalled();
    });

    it('a click shows the message, and neither toggles nor navigates', async () => {
      signIn();
      mocks.getUserFavoriteIds.mockRejectedValue(new Error('db down'));
      render(<Cards list={recipes(1)} />);
      await flush();

      const notPrevented = fireEvent.click(heartOf('Recipe r0'));
      await flush();

      expect(notPrevented).toBe(false);
      expect(mocks.toggleFavorite).not.toHaveBeenCalled();
      expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Reload the page'));
    });

    it('clears hearts known from an earlier page and recovers on the next page', async () => {
      signIn();
      mocks.getUserFavoriteIds.mockResolvedValue(['r0']);
      const first = render(<Cards list={recipes(1)} />);
      await flush();
      expect(isShownFavorited(heartOf('Recipe r0'))).toBe(true);
      first.unmount();

      mocks.getUserFavoriteIds.mockRejectedValue(new Error('db down'));
      mocks.nav.pathname = '/favorites';
      const second = render(<Cards list={recipes(1)} />);
      await flush();
      expect(isShownFavorited(heartOf('Recipe r0'))).toBe(false);
      second.unmount();

      mocks.getUserFavoriteIds.mockResolvedValue(['r0']);
      mocks.nav.pathname = '/recipes';
      render(<Cards list={recipes(1)} />);
      await flush();
      expect(isShownFavorited(heartOf('Recipe r0'))).toBe(true);
      expect(heartOf('Recipe r0')).toHaveAttribute('aria-disabled', 'false');
    });
  });
});
