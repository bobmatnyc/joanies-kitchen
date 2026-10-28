/**
 * #47: each autocomplete row shows the name and category as separate,
 * spaced, left-aligned elements instead of two runs of text that the global
 * centered inline-flex button rule glued together.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions/ingredient-search', () => ({
  getIngredientSuggestions: vi.fn(async () => ({
    success: true,
    suggestions: [
      { id: '1', name: 'frying-chicken', displayName: 'Frying Chicken', category: 'proteins', isCommon: true },
    ],
  })),
}));

import { FridgeInput } from '../FridgeInput';

describe('FridgeInput suggestions (#47)', () => {
  it('renders name and category as separated, left-aligned parts of one row', async () => {
    render(<FridgeInput onSearch={async () => {}} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'chicken' } });

    const row = await screen.findByTestId('suggestion-row', {}, { timeout: 2000 });
    const button = row.closest('button');
    const category = screen.getByTestId('suggestion-category');

    expect(row).toHaveTextContent('Frying Chicken');
    expect(category).toHaveTextContent('proteins');
    expect(row).toContainElement(category);
    // Separation: the row is a flex row with a gap; the category is its own element.
    expect(row.className).toMatch(/\bflex\b/);
    expect(row.className).toMatch(/\bgap-\d/);
    expect(category.previousElementSibling).toHaveTextContent('Frying Chicken');
    // Alignment: the button overrides the global `justify-content: center`.
    expect(row.className).toMatch(/\bw-full\b/);
    expect(button?.className).toMatch(/!justify-start/);
  });
});
