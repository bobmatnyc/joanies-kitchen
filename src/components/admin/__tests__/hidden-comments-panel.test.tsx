/**
 * #59: /admin/flags shows the hidden-comment count and controls outside the report
 * tabs, and the page links reach every page.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isValidElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getHiddenComments: vi.fn(),
  actOnHiddenComment: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/app/actions/hidden-comments', () => ({
  getHiddenComments: mocks.getHiddenComments,
  actOnHiddenComment: mocks.actOnHiddenComment,
}));
vi.mock('@/app/actions/flag-recipe', () => ({
  getAllFlags: vi.fn(async () => []),
  actOnRecipeFlag: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import AdminFlagsPage from '@/app/admin/flags/page';
import { HiddenCommentsPanel } from '@/components/admin/HiddenCommentsPanel';
import { Tabs } from '@/components/ui/tabs';

const comment = {
  id: 'c1',
  recipe_id: 'r1',
  recipeName: 'Soup',
  user_id: 'author-id-long',
  content: 'mean words',
  created_at: new Date('2026-10-01'),
  pendingReports: 0,
};

async function renderPanel(page: number) {
  render(await HiddenCommentsPanel({ page }));
}

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

describe('AdminFlagsPage', () => {
  it.each([
    [{ hiddenPage: '3' }, 3],
    [{}, Number.NaN],
  ])('renders the panel outside the report tabs for %j', async (searchParams, page) => {
    const tree = await AdminFlagsPage({ searchParams: Promise.resolve(searchParams) });
    const panel = findElement(tree, HiddenCommentsPanel, Tabs);
    expect(panel).not.toBeNull();
    expect(panel?.within).toBe(false);
    expect(panel?.props.page).toBe(page);
  });
});

describe('HiddenCommentsPanel', () => {
  it('shows the total and offers Unhide and Remove for a comment with no pending reports', async () => {
    mocks.getHiddenComments.mockResolvedValue({
      comments: [comment],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    await renderPanel(1);

    expect(screen.getByText('Hidden comments (1)')).toBeTruthy();
    expect(screen.getByText('mean words')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Unhide comment' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove comment' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Next' })).toBeNull();
  });

  it('states the range and links to the neighbouring pages', async () => {
    mocks.getHiddenComments.mockResolvedValue({
      comments: [comment, { ...comment, id: 'c2' }],
      total: 52,
      page: 2,
      pageCount: 3,
    });
    await renderPanel(2);

    expect(mocks.getHiddenComments).toHaveBeenCalledWith(2);
    expect(screen.getByText('Hidden comments (52)')).toBeTruthy();
    expect(screen.getByText('Showing 26-27 of 52')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Previous' }).getAttribute('href')).toBe(
      '/admin/flags?hiddenPage=1'
    );
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(
      '/admin/flags?hiddenPage=3'
    );
  });

  it('says so when no comment is hidden', async () => {
    mocks.getHiddenComments.mockResolvedValue({ comments: [], total: 0, page: 1, pageCount: 1 });
    await renderPanel(1);
    expect(screen.getByText('Hidden comments (0)')).toBeTruthy();
    expect(screen.getByText('No comments are hidden.')).toBeTruthy();
  });

  it('shows no comment data when the read is refused', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.getHiddenComments.mockRejectedValue(new Error('Admin access required'));
    await renderPanel(1);
    expect(screen.getByText('Failed to load hidden comments')).toBeTruthy();
    expect(screen.queryByText('mean words')).toBeNull();
    logged.mockRestore();
  });

  it.each([
    ['Unhide comment', 'unhide'],
    ['Remove comment', 'remove'],
  ])('%s calls the action after confirmation and refreshes the page', async (button, action) => {
    mocks.getHiddenComments.mockResolvedValue({
      comments: [comment],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    mocks.actOnHiddenComment.mockResolvedValue({ success: true });
    await renderPanel(1);

    await userEvent.click(screen.getByRole('button', { name: button }));
    expect(mocks.actOnHiddenComment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.actOnHiddenComment).toHaveBeenCalledWith('c1', action, '');
  });

  it('shows a stale-page error and does not refresh', async () => {
    mocks.getHiddenComments.mockResolvedValue({
      comments: [comment],
      total: 1,
      page: 1,
      pageCount: 1,
    });
    mocks.actOnHiddenComment.mockResolvedValue({ success: false, error: 'no longer hidden' });
    await renderPanel(1);

    await userEvent.click(screen.getByRole('button', { name: 'Remove comment' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('no longer hidden')).toBeTruthy();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
