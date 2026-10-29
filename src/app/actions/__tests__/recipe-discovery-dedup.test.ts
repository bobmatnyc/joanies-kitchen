// @vitest-environment node
/**
 * #135: `discoverRecipeFromUrl` links a duplicate to the stored recipe instead
 * of inserting it, against a real `recipes` table (PGlite). Page fetch and LLM
 * are stubbed.
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ db: undefined as unknown, llmCreate: vi.fn() }));

vi.mock('@/lib/db', () => ({
  get db() {
    return state.db;
  },
}));
vi.mock('@/lib/auth-guard', () => ({
  requireAuth: vi.fn(async () => ({ userId: 'user-1' })),
  checkAuth: vi.fn(async () => ({ userId: 'user-1', isAuthenticated: true })),
}));
vi.mock('@/lib/rate-limit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit')>()),
  enforceRateLimit: vi.fn(async () => ({ allowed: true, count: 1, limit: 30 })),
}));
vi.mock('@/lib/brave-search', () => ({ searchRecipes: vi.fn() }));
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create: state.llmCreate } } }),
  MODELS: { CLAUDE_3_HAIKU: 'anthropic/claude-3-haiku' },
}));
vi.mock('@/lib/ai/embeddings', () => ({ generateRecipeEmbedding: vi.fn() }));
vi.mock('@/lib/db/embeddings', () => ({ saveRecipeEmbedding: vi.fn() }));

import { createVisibilityDb } from '@/app/actions/__tests__/recipe-visibility-db';
import { discoverRecipeFromUrl } from '@/app/actions/recipe-discovery';
import { recipes } from '@/lib/db/schema';

let client: PGlite;
const fetchSpy = vi.fn(
  async () => new Response(`<html><body>${'Chicken soup recipe. '.repeat(20)}</body></html>`)
);
const count = async () =>
  (await client.query<{ n: number }>('SELECT count(*)::int AS n FROM "recipes"')).rows[0].n;

beforeAll(async () => {
  const built = await createVisibilityDb([recipes], { recipes }, { constraints: true });
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "recipes";');
  await client.exec(`INSERT INTO "recipes" (id, user_id, name, ingredients, instructions, source, is_public, moderation_status)
    VALUES ('seed-1', 'someone', 'Chicken Soup', '[]', '[]', 'https://www.a.com/chicken-soup/', true, 'approved'),
           ('hidden', 'someone', 'Pie', '[]', '[]', 'https://c.com/pie', true, 'rejected')`);
  fetchSpy.mockClear();
  state.llmCreate.mockReset();
  state.llmCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            name: 'Chicken soup',
            description: 'Soup',
            ingredients: ['1 chicken'],
            instructions: ['Simmer'],
            confidenceScore: 0.9,
            isValid: true,
          }),
        },
      },
    ],
  });
  vi.stubGlobal('fetch', fetchSpy);
  for (const level of ['log', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

describe('discoverRecipeFromUrl duplicate guard (#135)', () => {
  it('links a URL variant to the stored recipe without fetching the page', async () => {
    const res = await discoverRecipeFromUrl('http://a.com/chicken-soup?utm_medium=social');
    expect(res).toMatchObject({ success: true, duplicateOf: 'seed-1', recipe: { id: 'seed-1' } });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await count()).toBe(2);
  });

  it('links a same-title page on the same host before the metadata LLM call', async () => {
    const res = await discoverRecipeFromUrl('https://a.com/another-soup');
    expect(res).toMatchObject({ success: true, duplicateOf: 'seed-1' });
    expect(state.llmCreate).toHaveBeenCalledTimes(1); // extraction only
    expect(await count()).toBe(2);
  });

  it('skips, without linking, a duplicate of a hidden recipe', async () => {
    const res = await discoverRecipeFromUrl('https://c.com/pie/');
    expect(res).toEqual({
      success: false,
      error: 'skipped: duplicate of hidden',
      duplicateOf: 'hidden',
    });
    expect(await count()).toBe(2);
  });
});
