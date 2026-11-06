/**
 * #270: /admin/flags shows the hidden-review count and controls beside the hidden
 * comments, outside the report tabs; Unhide and Remove call the action.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getHiddenReviews: vi.fn(),
  actOnHiddenReview: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/app/actions/hidden-reviews', () => ({
  getHiddenReviews: mocks.getHiddenReviews,
  actOnHiddenReview: mocks.actOnHiddenReview,
}));
vi.mock('@/app/actions/hidden-comments', () => ({
  getHiddenComments: vi.fn(),
  actOnHiddenComment: vi.fn(),
}));
vi.mock('@/app/actions/flag-recipe', () => ({
  getAllFlags: vi.fn(async () => []),
  actOnRecipeFlag: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import AdminFlagsPage from '@/app/admin/flags/page';
import { HiddenReviewsPanel } from '@/components/admin/HiddenReviewsPanel';
import { Tabs } from '@/components/ui/tabs';

const review = {
  id: 'rt1',
  recipe_id: 'r1',
  recipeName: 'Soup',
  user_id: 'author-id-long',
  rating: 4,
  review: 'mean words',
  created_at: new Date('2026-10-01'),
  pendingReports: 2,
};

/** Finds the first element of `type` in a tree, and whether it sits inside `inside`. */
function findElement(
  node: ReactNode,
  type: unknown,
  inside: unknown,
  within = false
): { props: Record<string, unknown>; within: boolean } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type, inside, within);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, unknown> & { children?: ReactNode };
  if (node.type === type) return { props, within };
  return findElement(props.children, type, inside, within || node.type === inside);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AdminFlagsPage (#270)', () => {
  it('renders the hidden-reviews panel outside the report tabs, paged by hiddenReviewsPage', async () => {
    const tree = await AdminFlagsPage({
      searchParams: Promise.resolve({ hiddenReviewsPage: '2' }),
    });
    const panel = findElement(tree, HiddenReviewsPanel, Tabs);
    expect(panel).not.toBeNull();
    expect(panel?.within).toBe(false);
    expect(panel?.props.page).toBe(2);
  });
});

describe('HiddenReviewsPanel', () => {
  it('shows the total, the text, the rating and the pending-report count', async () => {
    mocks.getHiddenReviews.mockResolvedValue({
      reviews: [review],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    render(await HiddenReviewsPanel({ page: 1 }));
    expect(screen.getByText('Hidden reviews (1)')).toBeTruthy();
    expect(screen.getByText('mean words')).toBeTruthy();
    expect(screen.getByText(/Rating 4\/5/)).toBeTruthy();
    expect(screen.getByText(/Pending reports:\s*2/)).toBeTruthy();
  });

  it('says so when no review is hidden', async () => {
    mocks.getHiddenReviews.mockResolvedValue({ reviews: [], total: 0, page: 1, pageCount: 1 });
    render(await HiddenReviewsPanel({ page: 1 }));
    expect(screen.getByText('No reviews are hidden.')).toBeTruthy();
  });

  it.each([
    ['Unhide review', 'unhide'],
    ['Remove review', 'remove'],
  ])('%s calls the action after confirmation and refreshes', async (button, action) => {
    mocks.getHiddenReviews.mockResolvedValue({
      reviews: [review],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    mocks.actOnHiddenReview.mockResolvedValue({ success: true });
    render(await HiddenReviewsPanel({ page: 1 }));

    await userEvent.click(screen.getByRole('button', { name: button }));
    expect(mocks.actOnHiddenReview).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.actOnHiddenReview).toHaveBeenCalledWith('rt1', action, '');
  });
});
