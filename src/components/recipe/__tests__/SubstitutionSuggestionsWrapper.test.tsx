// #67: signed-out visitors must not trigger the paid substitution action on page load.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubstitutionSuggestionsWrapper } from '../SubstitutionSuggestionsWrapper';

const auth = vi.hoisted(() => ({
  value: { isLoaded: true, user: null as { id: string } | null },
}));
const subAction = vi.hoisted(() => vi.fn());
const inventoryAction = vi.hoisted(() => vi.fn());

vi.mock('@/lib/use-session-user', () => ({ useSessionUser: () => auth.value }));

const U1 = { id: 'u1' };
vi.mock('@/app/actions/substitutions', () => ({
  getMultipleIngredientSubstitutions: subAction,
}));
vi.mock('@/app/actions/inventory', () => ({ getUserInventory: inventoryAction }));

const INGREDIENTS = ['butter', 'flour'];
const RESULTS = INGREDIENTS.map((ingredient) => ({
  ingredient,
  substitutions: [],
  source: 'static',
  notes: 'none',
}));

// fresh element each call: rerendering the same element would be bailed out by React
const makeUi = () => (
  <SubstitutionSuggestionsWrapper recipeId="r1" recipeName="Cake" ingredients={INGREDIENTS} />
);
function renderWrapper() {
  return render(makeUi());
}

beforeEach(() => {
  subAction.mockReset();
  inventoryAction.mockReset();
  subAction.mockResolvedValue({ success: true, data: RESULTS });
  inventoryAction.mockResolvedValue({ success: true, data: [] });
});

describe('SubstitutionSuggestionsWrapper', () => {
  it('signed out: zero action calls on mount, exactly one after several clicks', async () => {
    auth.value = { isLoaded: true, user: null };
    renderWrapper();
    const button = await screen.findByRole('button', { name: /show substitutions/i });
    expect(subAction).toHaveBeenCalledTimes(0);

    // synchronous burst: all clicks land before React re-renders, so only the ref guard stops them
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
      fireEvent.click(button);
    });

    await waitFor(() => expect(subAction).toHaveBeenCalledTimes(1));
    expect(inventoryAction).not.toHaveBeenCalled();
  });

  it('signed in: loads on mount without a click', async () => {
    auth.value = { isLoaded: true, user: U1 };
    renderWrapper();
    await waitFor(() => expect(subAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /show substitutions/i })).toBeNull();
  });

  it('auth loading then signed in: fetches on mount, never shows the button', async () => {
    auth.value = { isLoaded: false, user: null };
    const { rerender } = renderWrapper();
    expect(subAction).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /show substitutions/i })).toBeNull();

    auth.value = { isLoaded: true, user: U1 };
    rerender(makeUi());
    await waitFor(() => expect(subAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /show substitutions/i })).toBeNull();
  });

  it('signed in then signed out: no refetch until a click', async () => {
    auth.value = { isLoaded: true, user: U1 };
    const { rerender } = renderWrapper();
    await waitFor(() => expect(subAction).toHaveBeenCalledTimes(1));

    auth.value = { isLoaded: true, user: null };
    rerender(makeUi());
    await screen.findByRole('button', { name: /show substitutions/i });
    expect(subAction).toHaveBeenCalledTimes(1);
  });

  it('#95: AI_FAILED shows the error card with Try again, not an empty card', async () => {
    auth.value = { isLoaded: true, user: U1 };
    subAction.mockResolvedValue({
      success: false,
      error: 'Could not generate',
      errorCode: 'AI_FAILED',
    });
    renderWrapper();
    expect(await screen.findByText('Could not generate')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('#95: a failed ingredient in a mixed batch renders failed with retry; successes stay', async () => {
    auth.value = { isLoaded: true, user: U1 };
    subAction.mockResolvedValue({
      success: true,
      data: [
        { ...RESULTS[0], notes: undefined, failed: true, has_substitutions: false },
        {
          ...RESULTS[1],
          has_substitutions: true,
          substitutions: [
            {
              original_ingredient: 'flour',
              substitute_ingredient: 'oat flour',
              confidence: 'high',
              confidence_score: 0.9,
              reason: 'r',
              source: 'ai',
            },
          ],
        },
      ],
    });
    renderWrapper();
    expect(await screen.findByText('Failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    expect(screen.getByText('butter')).toBeTruthy();
    expect(screen.getByText('flour')).toBeTruthy();
  });

  it('error after click: retry control fetches once more', async () => {
    auth.value = { isLoaded: true, user: null };
    subAction.mockResolvedValueOnce({ success: false, error: 'boom' });
    renderWrapper();
    fireEvent.click(await screen.findByRole('button', { name: /show substitutions/i }));
    const retry = await screen.findByRole('button', { name: /try again/i });
    expect(subAction).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);
    await waitFor(() => expect(subAction).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/smart substitutions/i)).toBeTruthy();
  });
});
