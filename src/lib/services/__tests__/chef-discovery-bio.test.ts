// @vitest-environment node
/**
 * Chef discovery never stores raw page text as a bio: whatever the LLM step
 * does, the result is a clean prose bio or undefined.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const page = vi.hoisted(() => ({ content: '' }));

vi.mock('@/lib/ai/jina-scraper', () => ({ fetchContentWithJina: async () => page.content }));
vi.mock('@/lib/costs', () => ({ assertWithinDailyCap: vi.fn(), trackLlmResponse: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {} }));

import { ChefDiscoveryService } from '@/lib/services/chef-discovery.service';

const CHROME_PAGE = `Skip to content
[Instagram](https://instagram.com/x)[Pinterest](https://pinterest.com/x)
*   [Home](https://example.de/)
*   [Recipes](https://example.de/recipes)
Subscribe to my newsletter and get my free eBook with 10 easy plant-based dinners!
Search`;

const PROSE = 'Anja is a Berlin-based cook who builds vegetarian meals around seasonal produce.';
const PROSE_PAGE = `${CHROME_PAGE}\n${PROSE}\n© 2024 All rights reserved.`;

type BioService = {
  generateBio(name: string, site: string): Promise<string | undefined>;
  summariseBio(name: string, content: string): Promise<string>;
};

function service(): BioService {
  return new ChefDiscoveryService() as unknown as BioService;
}

beforeEach(() => {
  vi.stubEnv('JINA_API_KEY', 'test');
  vi.stubEnv('ANTHROPIC_API_KEY', 'test');
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('generateBio', () => {
  it.each([
    ['throws', () => Promise.reject(new Error('boom'))],
    ['returns empty', () => Promise.resolve('')],
    ['returns nav text', () => Promise.resolve(CHROME_PAGE)],
  ])('falls back to the page prose when summariseBio %s', async (_label, impl) => {
    const s = service();
    vi.spyOn(s, 'summariseBio').mockImplementation(impl);

    page.content = PROSE_PAGE;
    expect(await s.generateBio('Anja', 'https://example.de')).toBe(PROSE);

    page.content = CHROME_PAGE;
    expect(await s.generateBio('Anja', 'https://example.de')).toBeUndefined();
  });

  it('keeps a summary that names a social network', async () => {
    const s = service();
    const summary =
      'Anja is a Berlin cook whose vegetarian recipes reach many readers on Instagram.';
    vi.spyOn(s, 'summariseBio').mockResolvedValue(summary);
    page.content = PROSE_PAGE;
    expect(await s.generateBio('Anja', 'https://example.de')).toBe(summary);
  });
});
