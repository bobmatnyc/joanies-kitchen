// @vitest-environment node
/**
 * #164: recipe, chef, tool and ingredient pages must not state `og:image` dimensions.
 * Their images are arbitrary external or Blob files of unknown size, and a hardcoded
 * 1200x630 was wrong (a 1024x1024 recipe hero was advertised as 1200x630).
 */

import { describe, expect, it, vi } from 'vitest';

const EXTERNAL = 'https://example.com/photos/crab-salad.jpg';

vi.mock('@/app/recipes/[slug]/recipe-access', () => ({
  findVisibleRecipe: async () => ({
    id: 'r1',
    slug: 'crab-salad',
    name: 'Crab Salad',
    description: 'd',
    cuisine: null,
    tags: '[]',
    images: JSON.stringify([EXTERNAL]),
    image_url: EXTERNAL,
  }),
  loadVisibleRecipeOrNotFound: async () => undefined,
}));
vi.mock('@/app/actions/chefs', () => ({
  getChefBySlug: async () => ({
    success: true,
    chef: { display_name: 'Chef', name: 'chef', bio: 'b', profile_image_url: EXTERNAL },
  }),
}));
vi.mock('@/app/actions/tools', () => ({
  getToolBySlug: async () => ({
    success: true,
    tool: {
      displayName: 'Whisk',
      name: 'whisk',
      category: 'c',
      description: 'd',
      imageUrl: EXTERNAL,
    },
  }),
}));
vi.mock('@/app/actions/ingredients', () => ({
  getIngredientBySlug: async () => ({
    success: true,
    ingredient: {
      display_name: 'Basil',
      name: 'basil',
      category: 'c',
      description: 'd',
      image_url: EXTERNAL,
    },
  }),
}));

import { generateMetadata as chefMetadata } from '@/app/chef/[slug]/page';
import { generateMetadata as ingredientMetadata } from '@/app/ingredients/[slug]/page';
import { generateMetadata as recipeMetadata } from '@/app/recipes/[slug]/layout';
import { generateMetadata as toolMetadata } from '@/app/tools/[slug]/page';

const params = Promise.resolve({ slug: 'x' });

/** The first Open Graph image entry of a resolved metadata object. */
function firstOgImage(md: { openGraph?: unknown }): Record<string, unknown> {
  const images = (md.openGraph as { images?: Array<Record<string, unknown>> }).images;
  expect(images).toHaveLength(1);
  return (images as Array<Record<string, unknown>>)[0];
}

describe('#164 og:image dimensions', () => {
  const cases = [
    ['recipe', () => recipeMetadata({ params })],
    ['chef', () => chefMetadata({ params })],
    ['tool', () => toolMetadata({ params })],
    ['ingredient', () => ingredientMetadata({ params })],
  ] as const;

  it.each(cases)('%s page keeps the image URL and states no width or height', async (_n, load) => {
    const image = firstOgImage(await load());
    expect(image.url).toBe(EXTERNAL);
    expect(image).not.toHaveProperty('width');
    expect(image).not.toHaveProperty('height');
  });

  it('recipe page leaves twitter:card unchanged', async () => {
    const md = await recipeMetadata({ params });
    expect(md.twitter).toMatchObject({ card: 'summary_large_image', images: [EXTERNAL] });
  });
});
