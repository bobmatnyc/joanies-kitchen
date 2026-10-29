// #94: carousel must render a usable image for every recipe and never throw on bad `images`.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import { SharedRecipeCarousel } from '../SharedRecipeCarousel';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: test stand-in for next/image
  default: ({ src, alt, onError }: { src: string; alt: string; onError?: () => void }) => (
    // biome-ignore lint/a11y/useAltText: alt is passed through
    <img src={src} alt={alt} onError={onError} />
  ),
}));

vi.mock('@/lib/utils/recipe-placeholders', () => ({
  getPlaceholderImage: () => '/placeholder.jpg',
}));

function recipe(id: string, images: unknown, image_url: string | null = null): Recipe {
  return {
    id,
    name: `Recipe ${id}`,
    images,
    image_url,
    tags: null,
    cuisine: null,
    difficulty: null,
    is_ai_generated: false,
  } as unknown as Recipe;
}

function srcOf(name: string): string | null {
  return screen.getByAltText(name).getAttribute('src');
}

describe('SharedRecipeCarousel', () => {
  it('renders every card when images are malformed, empty, objects or non-http', () => {
    render(
      <SharedRecipeCarousel
        recipes={[
          recipe('malformed', '[not json'),
          recipe('empty', ''),
          recipe('emptyArray', '[]'),
          recipe('object', '[{}]', 'https://cdn.example.com/legacy.jpg'),
          recipe('relative', '["images/x.jpg"]'),
          recipe('good', '["https://cdn.example.com/a.jpg"]'),
        ]}
      />
    );
    expect(srcOf('Recipe malformed')).toBe('/placeholder.jpg');
    expect(srcOf('Recipe empty')).toBe('/placeholder.jpg');
    expect(srcOf('Recipe emptyArray')).toBe('/placeholder.jpg');
    expect(srcOf('Recipe object')).toBe('https://cdn.example.com/legacy.jpg');
    expect(srcOf('Recipe relative')).toBe('/placeholder.jpg');
    expect(srcOf('Recipe good')).toBe('https://cdn.example.com/a.jpg');
  });

  it('skips object, empty and non-http first entries (old getHeroImage returned parsed[0])', () => {
    render(
      <SharedRecipeCarousel
        recipes={[
          recipe('obj', '[{"foo":1}, "https://cdn.example.com/b.jpg"]'),
          recipe('blank', '[""]', 'https://cdn.example.com/legacy.jpg'),
          recipe('data', '["data:image/png;base64,AAA"]'),
        ]}
      />
    );
    expect(srcOf('Recipe obj')).toBe('https://cdn.example.com/b.jpg');
    expect(srcOf('Recipe blank')).toBe('https://cdn.example.com/legacy.jpg');
    expect(srcOf('Recipe data')).toBe('/placeholder.jpg');
  });

  it('swaps in the placeholder when the image fails to load', () => {
    render(
      <SharedRecipeCarousel recipes={[recipe('broken', '["https://dead.example.com/a.jpg"]')]} />
    );
    const img = screen.getByAltText('Recipe broken');
    fireEvent.error(img);
    expect(srcOf('Recipe broken')).toBe('/placeholder.jpg');
    expect(img.style.display).not.toBe('none');
  });
});
