// #179: RecipeForm parsed `recipe.images` with a bare JSON.parse, so a malformed stored value
// crashed the edit page.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import { RecipeForm } from '../RecipeForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const updateRecipe = vi.hoisted(() => vi.fn());
const createRecipe = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/recipes', () => ({ createRecipe, updateRecipe }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The uploader is stubbed so the test reads exactly what the form hands it.
vi.mock('../ImageUploader', () => ({
  ImageUploader: ({
    images,
    onChange,
  }: {
    images: string[];
    onChange: (images: string[]) => void;
  }) => (
    <div>
      <ul data-testid="images">
        {images.map((src) => (
          <li key={src}>{src}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...images, 'https://cdn.example.com/new.jpg'])}
      >
        add-image
      </button>
    </div>
  ),
}));

// Radix Switch/Select measure with ResizeObserver, which jsdom lacks.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

function recipe(images: unknown): Recipe {
  return {
    id: 'r-1',
    name: 'Soup',
    ingredients: '["water"]',
    instructions: '["boil"]',
    tags: '[]',
    images,
    image_url: null,
  } as unknown as Recipe;
}

function listed(): string[] {
  return Array.from(screen.getByTestId('images').querySelectorAll('li')).map(
    (li) => li.textContent ?? ''
  );
}

describe('RecipeForm images', () => {
  it('loads and shows the existing images from valid JSON', () => {
    render(<RecipeForm recipe={recipe('["https://cdn.example.com/a.jpg"]')} />);
    expect(listed()).toEqual(['https://cdn.example.com/a.jpg']);
  });

  it('loads a Postgres array literal', () => {
    render(<RecipeForm recipe={recipe('{"https://cdn.example.com/a.jpg"}')} />);
    expect(listed()).toEqual(['https://cdn.example.com/a.jpg']);
  });

  it.each([
    ['unterminated JSON', '[not json'],
    ['plain garbage', 'garbage'],
    ['data: URI', '["data:image/png;base64,AAAA"]'],
  ])('shows an empty image list for %s instead of throwing', (_label, images) => {
    render(<RecipeForm recipe={recipe(images)} />);
    expect(listed()).toEqual([]);
  });
});

describe('RecipeForm submit keeps stored images (#179)', () => {
  beforeEach(() => {
    updateRecipe.mockReset().mockResolvedValue({ success: true, data: { id: 'r-1' } });
    createRecipe.mockReset().mockResolvedValue({ success: true, data: { id: 'r-2' } });
  });

  async function renameAndSubmit() {
    fireEvent.change(screen.getByLabelText('Recipe Name *'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /update|save|create/i }));
    await waitFor(() =>
      expect(updateRecipe.mock.calls.length + createRecipe.mock.calls.length).toBe(1)
    );
  }

  it.each([
    ['unusable entries mixed with a URL', '["images/x.jpg","https://a.test/b.jpg"]'],
    ['non-JSON text', '[not json'],
  ])('omits images and image_url when only the name changed (%s)', async (_label, images) => {
    render(<RecipeForm recipe={recipe(images)} />);
    await renameAndSubmit();
    const payload = updateRecipe.mock.calls[0][1];
    expect(payload.name).toBe('Renamed');
    expect('images' in payload).toBe(false);
    expect('image_url' in payload).toBe(false);
  });

  it('writes the cleaned list once images were changed through the uploader', async () => {
    render(<RecipeForm recipe={recipe('["images/x.jpg","https://a.test/b.jpg"]')} />);
    fireEvent.click(screen.getByText('add-image'));
    await renameAndSubmit();
    expect(updateRecipe.mock.calls[0][1].images).toBe(
      '["https://a.test/b.jpg","https://cdn.example.com/new.jpg"]'
    );
  });

  it('a new recipe still writes images and image_url', async () => {
    render(<RecipeForm />);
    fireEvent.click(screen.getByText('add-image'));
    fireEvent.change(screen.getByPlaceholderText('e.g., 2 cups flour'), {
      target: { value: 'flour' },
    });
    fireEvent.change(screen.getByPlaceholderText('Describe this step...'), {
      target: { value: 'mix' },
    });
    await renameAndSubmit();
    const payload = createRecipe.mock.calls[0][0];
    expect(payload.images).toBe('["https://cdn.example.com/new.jpg"]');
    expect(payload.image_url).toBe('https://cdn.example.com/new.jpg');
  });
});
