// #179: RecipeForm parsed `recipe.images` with a bare JSON.parse, so a malformed stored value
// crashed the edit page.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import { RecipeForm } from '../RecipeForm';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock('@/app/actions/recipes', () => ({ createRecipe: vi.fn(), updateRecipe: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// The uploader is stubbed so the test reads exactly what the form hands it.
vi.mock('../ImageUploader', () => ({
  ImageUploader: ({ images }: { images: string[] }) => (
    <ul data-testid="images">
      {images.map((src) => (
        <li key={src}>{src}</li>
      ))}
    </ul>
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
