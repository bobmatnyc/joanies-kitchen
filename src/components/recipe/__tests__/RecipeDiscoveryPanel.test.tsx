// #82: a refused discovery shows its message and retry time, never "Discovery complete!".
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeDiscoveryPanel } from '../RecipeDiscoveryPanel';

const discover = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/components/auth/RequireAuth', () => ({
  RequireAuthAI: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/app/actions/recipe-discovery', () => ({
  discoverRecipes: discover,
  discoverRecipeFromUrl: vi.fn(),
}));
vi.mock('@/lib/toast', () => ({
  toast: { error: toastError, success: vi.fn(), info: vi.fn() },
}));

const EMPTY_STATS = { searched: 0, validated: 0, saved: 0, failed: 0, skipped: 0 };

beforeEach(() => {
  discover.mockReset();
  toastError.mockReset();
});

describe('RecipeDiscoveryPanel refusals', () => {
  it.each([
    [
      'RATE_LIMITED',
      'Too many recipe discovery requests; try again later',
      7200,
      'Try again in 2 h.',
    ],
    ['LIMITER_UNAVAILABLE', 'recipe discovery is temporarily unavailable', undefined, undefined],
    ['COST_CAP_REACHED', 'Daily cost cap reached', undefined, undefined],
  ])(
    '%s shows the error, not "Discovery complete!"',
    async (errorCode, error, retryAfterSec, tail) => {
      discover.mockResolvedValue({
        success: false,
        recipes: [],
        stats: EMPTY_STATS,
        error,
        errorCode,
        retryAfterSec,
      });
      render(<RecipeDiscoveryPanel />);
      const input = screen.getByPlaceholderText('Search recipes or paste URL...');
      fireEvent.change(input, { target: { value: 'soup' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(toastError.mock.calls[0][0]).toContain(error);
      if (tail) expect(toastError.mock.calls[0][0]).toContain(tail);
      expect(screen.queryByText(/Discovery complete!/)).toBeNull();
    }
  );
});
