/**
 * #185: a card for a recipe whose stored image is the source site's logo showed the
 * logo. It must show the same placeholder as a recipe with no image.
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import { RecipeCard } from '../RecipeCard';
import { SharedRecipeCard } from '../SharedRecipeCard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/recipes',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock('@/components/favorites/FavoriteButton', () => ({ FavoriteButton: () => null }));
vi.mock('@/app/actions/recipes', () => ({ copyRecipeToCollection: vi.fn() }));

const LOGO = 'https://cookingchew.com/wp-content/uploads/2025/03/MSN-New-Logo-e1741397184120.png';

const logoRecipe = {
  id: 'r-185',
  slug: 'pasta-bake',
  name: 'Pasta Bake',
  description: 'A bake',
  tags: '[]',
  images: JSON.stringify([LOGO]),
  image_url: LOGO,
  prep_time: 10,
  cook_time: 20,
  servings: 4,
} as unknown as Recipe;

describe('recipe card placeholder (#185)', () => {
  it('RecipeCard shows the placeholder, not the stored logo', () => {
    render(<RecipeCard recipe={logoRecipe} />);
    expect(screen.getByAltText('Pasta Bake').getAttribute('src')).toBe('/placeholders/generic.svg');
  });

  it('SharedRecipeCard shows the placeholder, not the stored logo', () => {
    render(<SharedRecipeCard recipe={logoRecipe} />);
    expect(screen.getByAltText('Pasta Bake').getAttribute('src')).toBe('/placeholders/generic.svg');
  });
});
