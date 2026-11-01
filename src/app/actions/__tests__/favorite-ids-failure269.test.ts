/** #269: a failed id lookup rejects, so the client cannot read it as "no favorites". */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  listFavoriteRecipeIds: vi.fn(),
  getSessionUserId: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/favorites', () => ({ listFavoriteRecipeIds: mocks.listFavoriteRecipeIds }));
vi.mock('@/lib/recipe-visibility', () => ({
  findViewableRecipe: vi.fn(),
  getRecipeViewer: vi.fn(),
}));
vi.mock('@/lib/session-user', () => ({
  getSessionUser: vi.fn(),
  getSessionUserId: mocks.getSessionUserId,
}));

import { getUserFavoriteIds } from '@/app/actions/favorites';

describe('getUserFavoriteIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns the ids for a signed-in user', async () => {
    mocks.getSessionUserId.mockResolvedValue('u1');
    mocks.listFavoriteRecipeIds.mockResolvedValue(['r1', 'r2']);
    await expect(getUserFavoriteIds()).resolves.toEqual(['r1', 'r2']);
  });

  it('returns [] for a signed-out caller without querying', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    await expect(getUserFavoriteIds()).resolves.toEqual([]);
    expect(mocks.listFavoriteRecipeIds).not.toHaveBeenCalled();
  });

  it('rejects when the lookup fails', async () => {
    mocks.getSessionUserId.mockResolvedValue('u1');
    mocks.listFavoriteRecipeIds.mockRejectedValue(new Error('db down'));
    await expect(getUserFavoriteIds()).rejects.toThrow('db down');
  });
});
