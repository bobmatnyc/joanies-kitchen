import { describe, expect, it } from 'vitest';
import { nonRecipePathRule } from '@/lib/services/ingestion-url-rules';

// #315 follow-up: roundup/hub pages from the 2026-11-15 06:00Z cron run.
describe('nonRecipePathRule hub-slug (#315 follow-up)', () => {
  it.each([
    'https://omnivorescookbook.com/authentic-chinese-noodle-recipes',
    'https://omnivorescookbook.com/chinese-new-year-recipes/',
    'https://omnivorescookbook.com/asian-thanksgiving-recipes',
    'https://omnivorescookbook.com/chinese-leftover-chicken-recipes',
    'https://omnivorescookbook.com/top-sichuan-recipes',
  ])('rejects #315 hub slugs: %s', (url) => {
    expect(nonRecipePathRule(url)).toBe('hub-slug');
  });

  it.each([
    'https://example.com/best-vegan-lasagna/',
    'https://example.com/recipes/chicken-curry',
    'https://example.com/recipe/sichuan-mapo-tofu',
    'https://example.com/2024/05/rhubarb-crisp/',
    'https://example.com/chinese-noodle-recipe',
    'https://example.com/recipes/',
    // #315 follow-up: a real recipe (11-15 recipe of the day); prod false positive.
    'https://zerowastemelrose.org/food-waste-recipes-tips',
    // Same URL shape as the recipe above, so it is not pre-rejected; the
    // post-fetch check still rejects it.
    'https://minimalistbaker.com/earth-day-recipes-tips-to-reduce-plastic',
  ])('keeps #315 single-recipe paths: %s', (url) => {
    expect(nonRecipePathRule(url)).toBeNull();
  });
});
