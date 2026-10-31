/**
 * #22: /favorites sends a signed-out visitor to sign-in before loading any
 * favorites, and loads them for a signed-in user.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sessionUserId: vi.fn(),
  getUserFavorites: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/session-user', () => ({ getSessionUserId: mocks.sessionUserId }));
vi.mock('@/app/actions/favorites', () => ({ getUserFavorites: mocks.getUserFavorites }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import FavoritesPage from '@/app/favorites/page';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUserFavorites.mockResolvedValue([]);
});

describe('FavoritesPage', () => {
  it('redirects a signed-out visitor to sign-in before loading favorites', async () => {
    mocks.sessionUserId.mockResolvedValue(null);
    await expect(FavoritesPage()).rejects.toThrow('NEXT_REDIRECT:/sign-in?redirect=/favorites');
    expect(mocks.getUserFavorites).not.toHaveBeenCalled();
  });

  it('loads favorites for a signed-in user', async () => {
    mocks.sessionUserId.mockResolvedValue('user_a');
    await FavoritesPage();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getUserFavorites).toHaveBeenCalledOnce();
  });
});
