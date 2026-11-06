/**
 * #270: ReviewsList offers Report on another user's review only when signed in, never on
 * your own review or a review with no text, and tells the author when moderation hid theirs.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewsList } from '@/components/recipe/ReviewsList';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/app/actions/rate-recipe', () => ({
  getRecipeRatings: vi.fn(async () => []),
  rateRecipe: vi.fn(),
  deleteRating: vi.fn(),
}));
vi.mock('@/app/actions/report-rating-review', () => ({ reportRatingReview: vi.fn() }));

const base = {
  rating: 4,
  createdAt: new Date('2026-10-01'),
  updatedAt: new Date('2026-10-01'),
  userName: 'Someone',
};
const REVIEWS = [
  { ...base, id: 'mine', userId: 'me', review: 'my words' },
  { ...base, id: 'theirs', userId: 'them', review: 'their words' },
  { ...base, id: 'stars', userId: 'other', review: null },
];

function show(
  currentUserId?: string,
  initialReviews: Parameters<typeof ReviewsList>[0]['initialReviews'] = REVIEWS
) {
  render(
    <ReviewsList
      recipeId="r1"
      currentUserId={currentUserId}
      initialReviews={initialReviews}
      initialFetched
    />
  );
}

describe('ReviewsList report button (#270)', () => {
  it("is offered on another user's review with text, not on your own or a star-only one", () => {
    show('me');
    expect(screen.getAllByRole('button', { name: 'Report review' })).toHaveLength(1);
  });

  it('is absent when signed out', () => {
    show(undefined);
    expect(screen.queryByRole('button', { name: 'Report review' })).toBeNull();
  });

  it('tells the author that their review is hidden', () => {
    show('me', [{ ...REVIEWS[0], review: null, reviewHidden: true }]);
    expect(screen.getByText('Hidden by moderation')).toBeTruthy();
  });

  it('shows no hidden notice on a review that is not hidden', () => {
    show('me');
    expect(screen.queryByText('Hidden by moderation')).toBeNull();
  });
});
