// #179: SimilarRecipesCompact parsed `images` with a bare JSON.parse during render, so a
// Postgres array literal or plain garbage crashed the page.
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SimilarRecipesCompact } from '../SimilarRecipesWidget';

const findSimilarToRecipe = vi.hoisted(() => vi.fn());

vi.mock('@/app/actions/semantic-search', () => ({ findSimilarToRecipe }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('../RecipeCard', () => ({ RecipeCard: () => null }));

function neighbour(name: string, images: unknown) {
  return { id: name, slug: name, name, images, similarity: 0.9 };
}

async function renderWith(images: unknown) {
  findSimilarToRecipe.mockResolvedValue({ success: true, recipes: [neighbour('Soup', images)] });
  render(<SimilarRecipesCompact recipeId="r-1" />);
  await waitFor(() => expect(screen.getByText('Soup')).toBeTruthy());
  return screen.queryByAltText('Soup');
}

describe('SimilarRecipesCompact image guard', () => {
  beforeEach(() => findSimilarToRecipe.mockReset());

  it('renders without throwing for a Postgres array literal and shows its first URL', async () => {
    const img = await renderWith(
      '{"https://cdn.example.com/a.jpg","https://cdn.example.com/b.jpg"}'
    );
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
  });

  it.each([
    ['plain garbage', 'not json at all'],
    ['unterminated JSON', '[not json'],
    ['data: URI', '["data:image/svg+xml;base64,AAAA"]'],
    ['non-URL entry', '["1"]'],
  ])('renders the row with the placeholder image for %s', async (_label, images) => {
    // #185: no usable image shows the shared placeholder instead of no thumbnail.
    expect((await renderWith(images))?.getAttribute('src')).toBe('/placeholders/generic.svg');
  });

  it('keeps rendering a valid JSON image as before', async () => {
    const img = await renderWith('["https://cdn.example.com/ok.jpg"]');
    expect(img?.getAttribute('src')).toBe('https://cdn.example.com/ok.jpg');
  });
});
