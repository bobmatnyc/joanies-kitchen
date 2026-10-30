/**
 * #185: the extraction service picked the site header logo as the recipe image.
 * These page shapes go through the service's own Firecrawl and markdown mappers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/costs', () => ({
  trackCost: vi.fn(),
  withChatCostTracking: <T>(client: T) => client,
}));
vi.mock('@/lib/ai/jina-scraper', () => ({ fetchContentWithJina: vi.fn() }));

import { RecipeExtractionService } from '@/lib/services/recipe-extraction.service';

const LOGO = 'https://omnivorescookbook.com/wp-content/themes/oc2025/images/logo.svg';
const PHOTO =
  'https://omnivorescookbook.com/wp-content/uploads/2023/10/230726_Lions-Head-Meatballs_4.jpg';
const PAGE_URL = 'https://omnivorescookbook.com/lions-head-meatballs/';

type Mapped = { image_url?: string } | null;
interface Internals {
  parseMarkdown(
    markdown: string,
    metadata: Record<string, unknown> | undefined,
    url: string
  ): Mapped;
  mapFirecrawlSchema(data: unknown, url: string, metadata?: Record<string, unknown>): Mapped;
}

function service(): Internals {
  return new RecipeExtractionService() as unknown as Internals;
}

/** A Jina/Firecrawl markdown page: the header logo renders before the dish photo. */
const PAGE = [
  `![Omnivore's Cookbook](${LOGO})`,
  "# Lion's Head Pork Meatballs",
  `![Lion's Head Meatballs](${PHOTO} "Lion's Head Meatballs")`,
  '## Ingredients',
  '- 1 lb ground pork',
].join('\n');

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('extraction image picker (#185)', () => {
  it('logo first, dish photo second in the markdown: picks the photo', () => {
    expect(service().parseMarkdown(PAGE, undefined, PAGE_URL)?.image_url).toBe(PHOTO);
  });

  it('a logo og:image falls through to the body photo', () => {
    expect(service().parseMarkdown(PAGE, { ogImage: LOGO }, PAGE_URL)?.image_url).toBe(PHOTO);
  });

  it('only a logo on the page: no image', () => {
    const logoOnly = `![Logo](${LOGO})\n# Lion's Head Pork Meatballs`;
    expect(service().parseMarkdown(logoOnly, undefined, PAGE_URL)?.image_url).toBeUndefined();
  });

  it('JSON-LD Recipe.image is the logo, og:image is the photo: picks the photo', () => {
    const data = { '@type': 'Recipe', name: "Lion's Head", image: { url: LOGO } };
    expect(service().mapFirecrawlSchema(data, PAGE_URL, { ogImage: PHOTO })?.image_url).toBe(PHOTO);
  });
});
