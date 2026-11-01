/**
 * RecipeComments must call its server action once per recipeId. An unmemoized
 * loader in the effect's deps re-ran the effect after every state update and
 * looped server-action POSTs on every recipe page.
 */

import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getRecipeComments: vi.fn(),
  getRecipeCommentCount: vi.fn(),
  addRecipeComment: vi.fn(),
  updateRecipeComment: vi.fn(),
  deleteRecipeComment: vi.fn(),
}));

vi.mock('@/app/actions/social', () => mocks);

import { CommentsList } from '../CommentsList';
import { RecipeComments } from '../RecipeComments';

const COMMENT = {
  id: 'c1',
  user_id: 'u1',
  recipe_id: 'r1',
  content: 'Lovely soup',
  is_edited: false,
  is_flagged: false,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  user_name: 'Joanie',
};

/** Lets pending action promises resolve and the resulting re-renders commit. */
async function flushRenders(rounds = 10) {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

describe('RecipeComments load count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRecipeComments.mockResolvedValue({ success: true, data: [COMMENT] });
    mocks.getRecipeCommentCount.mockResolvedValue({ success: true, data: 1 });
  });

  it('calls getRecipeComments exactly once on mount', async () => {
    render(<RecipeComments recipeId="r1" isAuthenticated={false} />);
    await flushRenders();

    // The loaded comment proves the effect ran and its state updates committed.
    expect(screen.getByText('Lovely soup')).toBeInTheDocument();
    expect(screen.getByText('Comments (1)')).toBeInTheDocument();
    expect(mocks.getRecipeComments).toHaveBeenCalledTimes(1);
  });

  // #269: holds at 6b2549e too, because RecipeComments only mounts the list when
  // the count is above zero. The list's own contract is the next test.
  it('calls getRecipeComments exactly once for a recipe with no comments', async () => {
    mocks.getRecipeComments.mockResolvedValue({ success: true, data: [] });
    render(<RecipeComments recipeId="r1" isAuthenticated={false} />);
    await flushRenders();

    expect(screen.getByText('Comments')).toBeInTheDocument();
    expect(mocks.getRecipeComments).toHaveBeenCalledTimes(1);
  });

  // #269: an empty list means the host already fetched and found nothing.
  it('CommentsList adds no fetch of its own when given no comments', async () => {
    mocks.getRecipeComments.mockResolvedValue({ success: true, data: [] });
    render(<CommentsList recipeId="r1" initialComments={[]} totalCount={0} />);
    await flushRenders();

    expect(screen.getByText('No comments yet')).toBeInTheDocument();
    expect(mocks.getRecipeComments).not.toHaveBeenCalled();
  });

  it('reloads exactly once when recipeId changes', async () => {
    const { rerender } = render(<RecipeComments recipeId="r1" isAuthenticated={false} />);
    await flushRenders();
    rerender(<RecipeComments recipeId="r2" isAuthenticated={false} />);
    await flushRenders();

    expect(mocks.getRecipeComments).toHaveBeenCalledTimes(2);
    expect(mocks.getRecipeComments).toHaveBeenNthCalledWith(1, 'r1');
    expect(mocks.getRecipeComments).toHaveBeenNthCalledWith(2, 'r2');
  });
});
