// @vitest-environment node
/**
 * #256: a segment that sets its own `openGraph` or `twitter` replaces the root one whole,
 * so it must name the generated default image itself when the page has none.
 */

import { describe, expect, it, vi } from 'vitest';

const OWN = 'https://example.com/photos/own.jpg';
const state = vi.hoisted(() => ({ withImage: false }));

vi.mock('@/app/actions/chefs', () => ({
  getChefBySlug: async () => ({
    success: true,
    chef: {
      display_name: 'Chef',
      name: 'chef',
      bio: 'b',
      profile_image_url: state.withImage ? 'https://example.com/photos/own.jpg' : null,
    },
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
      imageUrl: state.withImage ? 'https://example.com/photos/own.jpg' : null,
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
      image_url: state.withImage ? 'https://example.com/photos/own.jpg' : null,
    },
  }),
}));

import { generateMetadata as chefMetadata } from '@/app/chef/[slug]/page';
import { metadata as fridgeMetadata } from '@/app/fridge/layout';
import { generateMetadata as ingredientMetadata } from '@/app/ingredients/[slug]/page';
import { generateMetadata as toolMetadata } from '@/app/tools/[slug]/page';

const params = Promise.resolve({ slug: 'x' });

type Social = { openGraph?: { images?: Array<{ url: string }> }; twitter?: { images?: string[] } };

function urls(md: unknown): { og: string[]; tw: string[] } {
  const m = md as Social;
  return {
    og: (m.openGraph?.images ?? []).map((i) => i.url),
    tw: m.twitter?.images ?? [],
  };
}

describe('#256 default social image', () => {
  it('/fridge names the generated default for og and twitter', () => {
    expect(urls(fridgeMetadata)).toEqual({ og: ['/opengraph-image'], tw: ['/opengraph-image'] });
  });

  const dynamic = [
    ['chef', () => chefMetadata({ params })],
    ['tool', () => toolMetadata({ params })],
    ['ingredient', () => ingredientMetadata({ params })],
  ] as const;

  it.each(dynamic)('%s page without an image falls back to the default', async (_n, load) => {
    state.withImage = false;
    expect(urls(await load())).toEqual({ og: ['/opengraph-image'], tw: ['/opengraph-image'] });
  });

  it.each(dynamic)('%s page with an image keeps it', async (_n, load) => {
    state.withImage = true;
    expect(urls(await load())).toEqual({ og: [OWN], tw: [OWN] });
  });
});
