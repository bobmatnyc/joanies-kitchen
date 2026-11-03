/**
 * #277: the heart is a real button with an action-naming label and a pressed state.
 */

import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserFavoriteIds: vi.fn(),
  auth: { value: { isLoaded: true, user: { id: 'u277' } as { id: string } | null } },
}));

vi.mock('@/app/actions/favorites', () => ({
  isFavorited: vi.fn(),
  getUserFavoriteIds: mocks.getUserFavoriteIds,
  toggleFavorite: vi.fn(),
}));
vi.mock('@/lib/use-session-user', () => ({ useSessionUser: () => mocks.auth.value }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  usePathname: () => '/recipes/x',
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { FavoriteButton } from '../FavoriteButton';

describe('FavoriteButton accessibility (#277)', () => {
  beforeEach(() => {
    mocks.getUserFavoriteIds.mockReset();
  });

  it('names the save action and is not pressed when not a favorite', async () => {
    mocks.auth.value = { isLoaded: true, user: { id: 'u277a' } };
    mocks.getUserFavoriteIds.mockResolvedValue([]);
    render(<FavoriteButton recipeId="r1" recipeName="Lemon Tart" />);
    const btn = await screen.findByRole('button', { name: 'Save Lemon Tart to favorites' });
    expect(btn.tagName).toBe('BUTTON');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the remove action and is pressed when a favorite', async () => {
    mocks.auth.value = { isLoaded: true, user: { id: 'u277b' } };
    mocks.getUserFavoriteIds.mockResolvedValue(['r1']);
    render(<FavoriteButton recipeId="r1" recipeName="Lemon Tart" />);
    const btn = await screen.findByRole('button', { name: 'Remove Lemon Tart from favorites' });
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });
});
