// @vitest-environment node
/**
 * #138: a database failure while loading a recipe is a 500, never a 404 and never a 200.
 *
 * `findVisibleRecipe` returns null only for 'Recipe not found'. Any other `getRecipe`
 * error must throw, so `generateMetadata` and `RecipeLayout` reject with a plain Error
 * (no Next control-flow digest) and the layout never renders its children. The real
 * `getRecipe` runs against a db whose every query throws.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOT_FOUND_DIGEST = 'NEXT_HTTP_ERROR_FALLBACK;404';
const CHILDREN = 'CHILDREN_SENTINEL';

vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => null,
  getSessionUser: async () => null,
}));
vi.mock('@/lib/auth-users', () => ({ getUserAdminFlag: async () => false }));
vi.mock('@/lib/db', () => ({
  db: new Proxy(
    {},
    {
      get() {
        throw new Error('connection refused');
      },
    }
  ),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

import { getRecipe } from '@/app/actions/recipes';
import RecipeLayout, { generateMetadata } from '@/app/recipes/[slug]/layout';

async function rejection(
  fn: () => Promise<unknown>
): Promise<{ digest?: string; message: string }> {
  try {
    await fn();
  } catch (error) {
    const e = error as { digest?: string; message?: string };
    return { digest: e.digest, message: String(e.message) };
  }
  throw new Error('expected the call to reject, but it resolved');
}

describe('/recipes/[slug] database failure (#138)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockReturnValue(undefined);
  });

  it('precondition: getRecipe reports the db failure as a non-"not found" error', async () => {
    expect(await getRecipe('any-slug')).toEqual({
      success: false,
      error: 'Failed to fetch recipe',
    });
  });

  it('generateMetadata throws a non-404 error and does not return the 404 metadata', async () => {
    const params = Promise.resolve({ slug: 'db-down-metadata' });
    const err = await rejection(() => generateMetadata({ params }));

    expect(err.message).toBe('Failed to load recipe: Failed to fetch recipe');
    expect(err.digest).toBeUndefined();
    expect(err.digest).not.toBe(NOT_FOUND_DIGEST);
    expect(err.digest ?? '').not.toContain('404');
  });

  it('RecipeLayout throws a non-404 error, so it neither renders children nor calls notFound()', async () => {
    const params = Promise.resolve({ slug: 'db-down-layout' });
    const rendered = vi.fn();
    const err = await rejection(async () => {
      rendered(await RecipeLayout({ children: CHILDREN, params }));
    });

    expect(err.message).toBe('Failed to load recipe: Failed to fetch recipe');
    expect(err.digest).toBeUndefined();
    expect(err.digest).not.toBe(NOT_FOUND_DIGEST);
    expect(rendered).not.toHaveBeenCalled();
  });
});
