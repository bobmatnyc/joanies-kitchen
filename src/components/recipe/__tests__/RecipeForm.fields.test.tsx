// #184: RecipeForm parsed ingredients, instructions and tags with a bare JSON.parse, so a
// malformed stored value crashed the edit page, and a name-only save would have rewritten it.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import { RecipeForm } from '../RecipeForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const updateRecipe = vi.hoisted(() => vi.fn());
const createRecipe = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/recipes', () => ({ createRecipe, updateRecipe }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../ImageUploader', () => ({ ImageUploader: () => <div /> }));

vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

function recipe(fields: { ingredients: string; instructions: string; tags: string }): Recipe {
  return { id: 'r-1', name: 'Soup', images: null, image_url: null, ...fields } as unknown as Recipe;
}

const VALID = { ingredients: '["water","salt"]', instructions: '["boil"]', tags: '["soup"]' };
const MALFORMED = {
  ingredients: '{"water","salt"}', // Postgres array literal
  instructions: 'Boil the water.\nAdd salt.', // plain text
  tags: '{soup,easy}', // Postgres array literal
};

beforeEach(() => {
  updateRecipe.mockReset().mockResolvedValue({ success: true, data: { id: 'r-1' } });
  createRecipe.mockReset().mockResolvedValue({ success: true, data: { id: 'r-2' } });
});

async function renameAndSubmit(mock: typeof updateRecipe) {
  fireEvent.change(screen.getByLabelText('Recipe Name *'), { target: { value: 'Renamed' } });
  fireEvent.click(screen.getByRole('button', { name: /update|create/i }));
  await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
}

describe('RecipeForm loads malformed ingredients, instructions and tags (#184)', () => {
  it('does not throw and shows the readable lines', () => {
    render(<RecipeForm recipe={recipe(MALFORMED)} />);
    expect(
      screen
        .getAllByPlaceholderText('Describe this step...')
        .map((i) => (i as HTMLInputElement).value)
    ).toEqual(['Boil the water.', 'Add salt.']);
  });

  it('shows valid values exactly as before', () => {
    render(<RecipeForm recipe={recipe(VALID)} />);
    expect(
      screen.getAllByPlaceholderText('e.g., 2 cups flour').map((i) => (i as HTMLInputElement).value)
    ).toEqual(['water', 'salt']);
  });
});

describe('RecipeForm name-only save keeps stored fields (#184)', () => {
  it.each([
    ['malformed', MALFORMED],
    ['valid', VALID],
  ])('omits ingredients, instructions and tags (%s)', async (_label, fields) => {
    render(<RecipeForm recipe={recipe(fields)} />);
    await renameAndSubmit(updateRecipe);
    const payload = updateRecipe.mock.calls[0][1];
    expect(payload.name).toBe('Renamed');
    expect('ingredients' in payload).toBe(false);
    expect('instructions' in payload).toBe(false);
    expect('tags' in payload).toBe(false);
  });

  it('writes the new ingredients after an edit, and still omits the untouched instructions and tags', async () => {
    render(<RecipeForm recipe={recipe(MALFORMED)} />);
    const [first] = screen.getAllByPlaceholderText('e.g., 2 cups flour');
    fireEvent.change(first, { target: { value: '2 cups water' } });
    await renameAndSubmit(updateRecipe);
    const payload = updateRecipe.mock.calls[0][1];
    expect(JSON.parse(payload.ingredients)).toEqual(['2 cups water']);
    expect('instructions' in payload).toBe(false);
    expect('tags' in payload).toBe(false);
  });
});

describe('RecipeForm create path (#184)', () => {
  it('still writes ingredients, instructions and tags', async () => {
    render(<RecipeForm />);
    fireEvent.change(screen.getByPlaceholderText('e.g., 2 cups flour'), {
      target: { value: 'flour' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe this step...'), {
      target: { value: 'mix' },
    });
    await renameAndSubmit(createRecipe);
    const payload = createRecipe.mock.calls[0][0];
    expect(payload.ingredients).toBe('["flour"]');
    expect(payload.instructions).toBe('["mix"]');
    expect(payload.tags).toBeNull();
  });
});
