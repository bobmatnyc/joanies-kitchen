// #179: the recipe-of-day payload returned raw `images` / `image_url`, so a data: placeholder
// or a malformed value reached the client. Field names and string shapes must not change.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rows = vi.hoisted(() => ({ featured: [] as unknown[], recipe: [] as unknown[] }));

// A thenable query chain: the first select() (the featured row) and later ones (recipe join).
vi.mock('@/lib/db', () => {
  let call = 0;
  const chain = (result: () => unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ['from', 'leftJoin', 'where', 'orderBy', 'limit']) c[m] = () => c;
    // biome-ignore lint/suspicious/noThenProperty: the route awaits a drizzle query builder
    c.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
    return c;
  };
  return {
    db: {
      select: () => {
        call += 1;
        return call % 2 === 1 ? chain(() => rows.featured) : chain(() => rows.recipe);
      },
    },
  };
});
vi.mock('@/lib/db/autonomous-scraper-schema', () => ({
  recipeOfTheDay: { date: 'date', recipe_id: 'recipe_id' },
}));
vi.mock('@/lib/db/chef-schema', () => ({ chefs: { id: 'id' } }));
vi.mock('@/lib/db/schema', () => ({
  recipes: { id: 'id', chef_id: 'chef_id', deleted_at: 'deleted_at' },
}));
vi.mock('@/lib/recipe-public', () => ({ publicRecipe: {} }));
vi.mock('drizzle-orm', () => ({
  and: () => ({}),
  desc: () => ({}),
  eq: () => ({}),
  isNull: () => ({}),
  like: () => ({}),
  or: () => ({}),
}));

import { GET } from '../route';

function stored(images: string | null, image_url: string | null) {
  return {
    id: 'r-1',
    name: 'Soup',
    description: null,
    image_url,
    images,
    ingredients: '[]',
    prep_time: 1,
    cook_time: 1,
  };
}

async function fetchPayload(images: string | null, image_url: string | null) {
  rows.featured = [{ recipe_id: 'r-1', theme: 't', source_url: null }];
  rows.recipe = [{ recipe: stored(images, image_url), chef: null }];
  return (await GET()).json();
}

describe('GET /api/recipes/recipe-of-day image fields', () => {
  beforeEach(() => {
    rows.featured = [];
    rows.recipe = [];
  });

  it('drops a data: URI and keeps usable URLs, as the same JSON string', async () => {
    const body = await fetchPayload(
      '["data:image/svg+xml;base64,AAAA","https://cdn.example.com/a.jpg"]',
      'data:image/svg+xml;base64,AAAA'
    );
    expect(body.images).toBe('["https://cdn.example.com/a.jpg"]');
    expect(body.image_url).toBeNull();
  });

  it('keeps a valid payload as before and parses a Postgres literal', async () => {
    const valid = await fetchPayload('["https://cdn.example.com/a.jpg"]', 'https://x.test/h.jpg');
    expect(valid.images).toBe('["https://cdn.example.com/a.jpg"]');
    expect(valid.image_url).toBe('https://x.test/h.jpg');
    const pg = await fetchPayload('{"https://cdn.example.com/b.jpg"}', null);
    expect(pg.images).toBe('["https://cdn.example.com/b.jpg"]');
  });

  it('returns null images for garbage and null stored values', async () => {
    expect((await fetchPayload('garbage', null)).images).toBeNull();
    expect((await fetchPayload(null, null)).images).toBeNull();
  });
});
