/** #163: sitemap URLs must be clean when NEXT_PUBLIC_APP_URL ends in a newline. */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => {
  const rows = (data: unknown[]) => ({ from: () => ({ where: async () => data }) });
  let call = 0;
  return {
    db: {
      select: () => {
        call += 1;
        return call % 2 === 1
          ? rows([{ id: 'r1', slug: 'soup', updated_at: null, is_system_recipe: false }])
          : rows([{ slug: 'basil', updated_at: null }]);
      },
    },
  };
});

describe('sitemap', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('has no whitespace or double slash in any URL when the env value ends in a newline', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://joanies.kitchen\n');
    const { default: sitemap } = await import('@/app/sitemap');
    const entries = await sitemap();

    expect(entries.length).toBeGreaterThan(2);
    for (const { url } of entries) {
      expect(url).not.toMatch(/\s/);
      expect(url.replace('https://', '')).not.toContain('//');
    }
    expect(entries.map((e) => e.url)).toContain('https://joanies.kitchen/recipes/soup');
  });
});
