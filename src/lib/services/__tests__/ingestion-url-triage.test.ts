/**
 * #300: pure URL triage and run-outcome rules for the autonomous crawl.
 * Service-level behaviour is in `run-accounting.test.ts` (#300 blocks).
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import {
  dedupeDiscoveredUrls,
  finalRunStatus,
  nonRecipeSkipReason,
  type RunEnd,
  runStopReason,
  withoutFragment,
} from '@/lib/services/ingestion-url-triage';
import type { ExtractionTierAttempt } from '@/lib/services/recipe-extraction.types';

const POST = 'https://homedishrecipes.com/zero-waste-broth/';
const BBC = 'https://www.bbcgoodfood.com/recipes/leftover-soup';

describe('dedupeDiscoveredUrls (#300 a)', () => {
  it('drops URLs that differ only by fragment, keeping the first without its fragment', () => {
    const discovered = [
      `${POST}#`,
      `${POST}#subscribe`,
      `${POST}#respond`,
      POST,
      `${BBC}#site-main`,
      `${BBC}#commentsFeed`,
      'https://a.example/recipes/stew/#x', // trailing /#x
      'https://a.example/recipes/stew',
    ].map((url, i) => ({ url, title: `t${i}` }));

    const { unique, duplicates } = dedupeDiscoveredUrls(discovered);

    expect(unique).toEqual([
      { url: POST, title: 't0' },
      { url: BBC, title: 't4' },
      { url: 'https://a.example/recipes/stew/', title: 't6' },
    ]);
    expect(duplicates).toBe(5);
  });

  it('keeps URLs that select a different page (path or query)', () => {
    const discovered = [
      'https://a.example/recipes/stew',
      'https://a.example/recipes/soup',
      'https://a.example/recipe?id=1',
      'https://a.example/recipe?id=2',
    ].map((url) => ({ url }));
    expect(dedupeDiscoveredUrls(discovered)).toEqual({ unique: discovered, duplicates: 0 });
  });

  it.each([
    ['https://a.example/x', 'https://a.example/x'],
    ['https://a.example/x#', 'https://a.example/x'],
    ['https://a.example/x/#respond', 'https://a.example/x/'],
    ['https://a.example/x?q=1#a#b', 'https://a.example/x?q=1'],
  ])('withoutFragment(%s) is %s', (input, expected) => {
    expect(withoutFragment(input)).toBe(expected);
  });
});

const att = (...pairs: [ExtractionTierAttempt['tier'], ExtractionTierAttempt['result']][]) => ({
  attempts: pairs.map(([tier, result]) => ({ tier, result })),
});

describe('nonRecipeSkipReason (#300 b)', () => {
  it('a page a tier read with no recipe evidence is a skip, labelled by the hub/listicle detector', () => {
    expect(nonRecipeSkipReason(att(['jina', 'no_recipe']), 'https://a.example/recipes/x')).toBe(
      'non-recipe page: no recipe schema, ingredients or instructions (read by jina)'
    );
    expect(
      nonRecipeSkipReason(
        att(['firecrawl', 'error'], ['jina', 'no_recipe']),
        'https://cabot.example/blogs/food/root-stem-recipes'
      )
    ).toBe(
      'hub/listicle page: no recipe schema, ingredients or instructions (read by jina; firecrawl error)'
    );
    expect(
      nonRecipeSkipReason(
        att(['firecrawl', 'no_recipe']),
        'https://a.example/x',
        '25 Easy Recipes for Scraps'
      )
    ).toMatch(/^hub\/listicle page: /);
  });

  // Fail-Open Check: each of these is a real failure and must stay an error.
  it.each([
    ['rate limit with no fallback', att(['firecrawl', 'error'])],
    ['network error on every tier', att(['firecrawl', 'error'], ['jina', 'error'])],
    ['no tier got content', att(['firecrawl', 'empty'], ['jina', 'empty'])],
    [
      'a recipe page that fails to parse',
      att(['firecrawl', 'recipe_partial'], ['jina', 'no_recipe']),
    ],
    [
      'a recipe page that fails to parse (later tier)',
      att(['jina', 'no_recipe'], ['tavily_extract', 'recipe_partial']),
    ],
    ['no tier ran (or the extractor reported nothing)', att()],
  ])('%s is an error (null), never a skip', (_name, report) => {
    expect(
      nonRecipeSkipReason(report, 'https://cabot.example/blogs/food/root-stem-recipes')
    ).toBeNull();
  });
});

const end = (over: Partial<RunEnd>): RunEnd => ({
  pipelineError: false,
  deadline: false,
  budgetStopped: false,
  recipesStored: 0,
  maxRecipes: 5,
  errors: [],
  ...over,
});

describe('finalRunStatus and runStopReason (#300 c, d)', () => {
  it.each([
    [
      'target reached with errors',
      end({ recipesStored: 5, errors: ['x: failed'] }),
      'completed',
      'target',
    ],
    ['target reached, no errors', end({ recipesStored: 5 }), 'completed', 'target'],
    [
      'deadline cut',
      end({ deadline: true, recipesStored: 1, errors: ['deadline: stopped after 270s'] }),
      'partial',
      'deadline',
    ],
    ['budget stop', end({ budgetStopped: true, recipesStored: 1 }), 'partial', 'budget'],
    [
      'URLs ran out, errors and some stored',
      end({ recipesStored: 1, errors: ['x'] }),
      'partial',
      'exhausted',
    ],
    ['URLs ran out, errors and none stored', end({ errors: ['x'] }), 'failed', 'exhausted'],
    ['URLs ran out, clean', end({ recipesStored: 2 }), 'completed', 'exhausted'],
  ] as const)('%s → status %s, stop %s', (_name, e, status, stop) => {
    expect(finalRunStatus(e)).toBe(status);
    expect(runStopReason(e)).toBe(stop);
  });

  it('a pipeline error stops with reason error', () => {
    expect(runStopReason(end({ pipelineError: true, deadline: true }))).toBe('error');
  });
});
