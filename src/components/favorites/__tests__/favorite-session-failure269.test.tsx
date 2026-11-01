/**
 * #269: a failed client session fetch reads as "no user" while the cookie can stay
 * valid, so the server would still act on a toggle. Runs the real SessionProvider.
 */

import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserFavoriteIds: vi.fn(),
  toggleFavorite: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/app/actions/favorites', () => ({
  getUserFavoriteIds: mocks.getUserFavoriteIds,
  toggleFavorite: mocks.toggleFavorite,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/search',
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

import { FavoriteButton } from '../FavoriteButton';

async function flush() {
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const sessionResponse = () =>
  new Response(JSON.stringify({ user: { id: 'session-user' }, expires: '2099-01-01' }), {
    status: 200,
  });

const renderButton = () =>
  render(
    <SessionProvider refetchInterval={300}>
      <FavoriteButton recipeId="r0" />
    </SessionProvider>
  );

const isShownFavorited = (button: HTMLElement) =>
  button.querySelector('svg')?.classList.contains('fill-current') ?? false;

describe('FavoriteButton when the session fetch fails (#269)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getUserFavoriteIds.mockResolvedValue(['r0']);
    mocks.toggleFavorite.mockResolvedValue({ success: true, isFavorited: false });
  });

  it('never toggles when the first session fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      })
    );
    renderButton();
    await flush();

    fireEvent.click(screen.getByRole('button'));
    await flush();

    expect(mocks.toggleFavorite).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('reload the page'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('never toggles when a session refetch fails after a signed-in load', async () => {
    const fetchMock = vi.fn(async () => sessionResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderButton();
    await flush();
    expect(isShownFavorited(screen.getByRole('button'))).toBe(true);

    fetchMock.mockImplementation(async () => {
      throw new Error('offline');
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await flush();

    fireEvent.click(screen.getByRole('button'));
    await flush();

    expect(mocks.toggleFavorite).not.toHaveBeenCalled();
  });
});
