// #67: signed-out visitors must not trigger the paid substitution action on page load.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubstitutionSuggestionsWrapper } from '../SubstitutionSuggestionsWrapper';

const auth = vi.hoisted(() => ({ value: { isSignedIn: false, userId: null as string | null } }));
const subAction = vi.hoisted(() => vi.fn());
const inventoryAction = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth-client', () => ({ useAuth: () => auth.value }));
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

function renderWrapper() {
  return render(
    <SubstitutionSuggestionsWrapper recipeId="r1" recipeName="Cake" ingredients={INGREDIENTS} />
  );
}

beforeEach(() => {
  subAction.mockReset();
  inventoryAction.mockReset();
  subAction.mockResolvedValue({ success: true, data: RESULTS });
  inventoryAction.mockResolvedValue({ success: true, data: [] });
});

describe('SubstitutionSuggestionsWrapper', () => {
  it('signed out: zero action calls on mount, exactly one after several clicks', async () => {
    auth.value = { isSignedIn: false, userId: null };
    renderWrapper();
    const button = await screen.findByRole('button', { name: /show substitutions/i });
    expect(subAction).toHaveBeenCalledTimes(0);

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(subAction).toHaveBeenCalledTimes(1));
    expect(inventoryAction).not.toHaveBeenCalled();
  });

  it('signed in: loads on mount without a click', async () => {
    auth.value = { isSignedIn: true, userId: 'u1' };
    renderWrapper();
    await waitFor(() => expect(subAction).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /show substitutions/i })).toBeNull();
  });
});
