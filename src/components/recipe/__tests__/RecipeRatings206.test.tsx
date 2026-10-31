/**
 * #206: RecipeRatings fetched page 0 on mount, then ReviewsList fetched it again on its own
 * mount whenever the first page was empty. A recipe page load must call getRecipeRatings once.
 * The real RecipeRatings and ReviewsList run here over a mocked server-action module.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeRatings } from '@/components/recipe/RecipeRatings';
import { ReviewsList } from '@/components/recipe/ReviewsList';

const getRecipeRatings = vi.hoisted(() => vi.fn(async () => [] as unknown[]));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/app/actions/rate-recipe', () => ({
  getRecipeRatings,
  getUserRating: vi.fn(async () => null),
  rateRecipe: vi.fn(),
  deleteRating: vi.fn(),
}));
vi.mock('@/components/recipe/RatingDisplay', () => ({ RatingDisplay: () => null }));
vi.mock('@/components/recipe/RatingInput', () => ({ RatingInput: () => null }));

const PROPS = {
  recipeId: 'r-206',
  averageRating: null,
  totalRatings: 0,
  isAuthenticated: false,
};

describe('RecipeRatings ratings fetch (#206)', () => {
  beforeEach(() => {
    getRecipeRatings.mockClear();
  });

  it('calls getRecipeRatings once on mount for a recipe with no reviews', async () => {
    render(<RecipeRatings {...PROPS} />);
    await screen.findByText('No reviews yet. Be the first to review this recipe!');
    // Let any second, effect-driven fetch settle before counting.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getRecipeRatings).toHaveBeenCalledTimes(1);
    expect(getRecipeRatings).toHaveBeenCalledWith('r-206', 10, 0);
  });

  it('still calls it once after a re-render with the same props', async () => {
    const { rerender } = render(<RecipeRatings {...PROPS} />);
    await screen.findByText('No reviews yet. Be the first to review this recipe!');
    rerender(<RecipeRatings {...PROPS} />);
    await waitFor(() => expect(getRecipeRatings).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getRecipeRatings).toHaveBeenCalledTimes(1);
  });
});

describe('ReviewsList initialFetched (#206)', () => {
  beforeEach(() => {
    getRecipeRatings.mockClear();
  });

  it('without initialFetched, an empty initialReviews still fetches page 0 once', async () => {
    render(<ReviewsList recipeId="r-206" initialReviews={[]} />);
    await screen.findByText('No reviews yet. Be the first to review this recipe!');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getRecipeRatings).toHaveBeenCalledTimes(1);
    expect(getRecipeRatings).toHaveBeenCalledWith('r-206', 10, 0);
  });

  it('with initialFetched, Load More Reviews still fetches the next page', async () => {
    const reviews = Array.from({ length: 10 }, (_, i) => ({
      id: `rev-${i}`,
      userId: `u-${i}`,
      rating: 4,
      review: `review ${i}`,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      userName: `User ${i}`,
    }));
    render(<ReviewsList recipeId="r-206" initialReviews={reviews} initialFetched />);
    expect(getRecipeRatings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Load More Reviews' }));
    await waitFor(() => expect(getRecipeRatings).toHaveBeenCalledTimes(1));
    expect(getRecipeRatings).toHaveBeenCalledWith('r-206', 10, 10);
  });
});
