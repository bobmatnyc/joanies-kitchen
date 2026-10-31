/**
 * #228: every site that parses an LLM reply takes the first balanced JSON
 * object or array, so trailing prose, citation markers or a second block no
 * longer break the parse. Malformed replies keep each site's old failure result.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  llm: vi.fn(),
  generate: vi.fn(),
  scrape: vi.fn(),
  dbSet: vi.fn(),
  row: {
    id: 'r1',
    name: 'Soup',
    slug: 'soup',
    description: 'd',
    ingredients: '["1 onion"]',
    instructions: '["Chop"]',
  },
}));

const chatClient = { chat: { completions: { create: mocks.llm } } };

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: mocks.llm } };
  },
}));
vi.mock('@/lib/costs', () => ({
  withChatCostTracking: (client: unknown) => client,
  isPaidCallBlocked: () => false,
}));
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => chatClient,
  MODELS: { CLAUDE_3_HAIKU: 'haiku' },
}));
vi.mock('@/lib/admin', () => ({ requireAdmin: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db', () => {
  const update = () => ({
    set: (values: unknown) => {
      mocks.dbSet(values);
      return { where: () => ({ returning: async () => [mocks.row] }) };
    },
  });
  const select = () => ({
    from: () => ({ where: () => ({ limit: async () => [mocks.row] }) }),
  });
  return { db: { select, update } };
});
vi.mock('@/lib/ai/openrouter-client', () => ({
  isOpenRouterAvailable: () => true,
  openrouterGenerate: mocks.generate,
  DEFAULT_OPENROUTER_MODEL: 'test-model',
}));
vi.mock('@/lib/ai/ollama-client', () => ({
  isOllamaAvailable: async () => false,
  ollamaGenerate: vi.fn(),
  DEFAULT_OLLAMA_MODEL: 'none',
}));
vi.mock('@/lib/firecrawl', () => ({ scrapeRecipePage: mocks.scrape }));
vi.mock('@/lib/serpapi', () => ({ filterRecipeSites: vi.fn(), searchRecipesWithSerpAPI: vi.fn() }));
vi.mock('@/lib/brave-search', () => ({ searchRecipes: vi.fn() }));

import { formatInstructionsWithLLM, parseIngredientsWithLLM } from '@/app/actions/admin-edit';
import { classifyRecipeInstructions } from '@/lib/ai/instruction-classifier';
import { generateMealWithSemanticSearch } from '@/lib/ai/meal-pairing-system';
import { discoverWeeklyRecipes } from '@/lib/perplexity-discovery';
import { convertUrlToRecipe } from '@/lib/recipe-crawl-steps';
import { extractAndValidateRecipe, generateRecipeMetadata } from '@/lib/recipe-discovery-steps';
import { cleanRecipesWithOllama } from '@/lib/services/recipe-cleaner.service';

const json = (v: unknown) => JSON.stringify(v);
const fence = (v: unknown) => `\`\`\`json\n${json(v)}\n\`\`\``;
const reply = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(() => {
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    vi.spyOn(console, level).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  mocks.llm.mockReset();
  mocks.generate.mockReset();
  mocks.scrape.mockReset();
  mocks.dbSet.mockReset();
});

describe('perplexity-discovery (#228)', () => {
  const recipe = { title: 'Soup', url: 'https://x.com/soup', source: 'X', snippet: 's' };
  const week = { year: 2026, week: 44, startDate: '2026-10-26', endDate: '2026-11-01' };
  const run = (content: string) => {
    mocks.llm.mockResolvedValue(reply(content));
    return discoverWeeklyRecipes(week as never);
  };

  it('parses an array followed by citation markers', async () => {
    const result = await run(`${json([recipe])}\n\n[1][2]`);
    expect(result.success).toBe(true);
    expect(result.recipes.map((r) => r.title)).toEqual(['Soup']);
  });

  it('parses the first of two arrays', async () => {
    const result = await run(`${json([recipe])}\n${json([{ ...recipe, title: 'Other' }])}`);
    expect(result.recipes.map((r) => r.title)).toEqual(['Soup']);
  });

  it('returns the failure result for a malformed array', async () => {
    const result = await run('[{"title": oops}]');
    expect(result).toMatchObject({ success: false, recipes: [] });
  });

  it.each([
    ['a stray [1] before the real array', `Sources [1]:\n${json([recipe])}`],
    ['an array with a non-object element', json([recipe, 'x'])],
  ])('refuses %s', async (_label, content) => {
    expect(await run(content)).toEqual({
      success: false,
      recipes: [],
      error: 'Invalid response format from Perplexity',
    });
  });
});

describe('admin-edit LLM helpers (#228)', () => {
  const cases = [
    ['parseIngredientsWithLLM', parseIngredientsWithLLM, 'ingredients'],
    ['formatInstructionsWithLLM', formatInstructionsWithLLM, 'instructions'],
  ] as const;

  it.each(cases)('%s parses an array followed by prose', async (_n, fn, key) => {
    mocks.llm.mockResolvedValue(reply(`${json(['a', 'b'])}\n\nNote: see [step 2] above.`));
    const result = await fn('r1');
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>)[key]).toEqual(['a', 'b']);
  });

  it.each(cases)('%s parses the first of two arrays', async (_n, fn, key) => {
    mocks.llm.mockResolvedValue(reply(`${json(['a'])}\n${json(['z'])}`));
    const result = await fn('r1');
    expect((result.data as Record<string, unknown>)[key]).toEqual(['a']);
  });

  it.each(cases)('%s returns the failure result for a malformed array', async (_n, fn) => {
    mocks.llm.mockResolvedValue(reply('["a", oops]'));
    const result = await fn('r1');
    expect(result.success).toBe(false);
  });

  it.each([
    ['a stray [1] before the real array', `See [1].\n${json(['a', 'b'])}`],
    ['an array with a non-string element', json(['a', 2])],
  ])('refuses %s and writes nothing', async (_label, content) => {
    for (const [, fn] of cases) {
      mocks.llm.mockResolvedValue(reply(content));
      const result = await fn('r1');
      expect(result).toEqual({ success: false, error: 'Failed to parse LLM response' });
    }
    expect(mocks.dbSet).not.toHaveBeenCalled();
  });

  it.each(cases)('%s still writes an empty array, as on base', async (_n, fn, key) => {
    mocks.llm.mockResolvedValue(reply('[]'));
    const result = await fn('r1');
    expect(result.success).toBe(true);
    expect(mocks.dbSet).toHaveBeenCalledWith(expect.objectContaining({ [key]: '[]' }));
  });
});

describe('recipe-discovery-steps (#228)', () => {
  const recipe = {
    name: 'Soup',
    description: 'd',
    ingredients: ['1 onion'],
    instructions: ['Chop'],
    confidenceScore: 0.9,
    isValid: true,
  };
  const meta = { cuisine: 'Thai', tags: ['quick'], difficulty: 'easy', dietaryInfo: [] };

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, text: async () => `<p>${'recipe text '.repeat(20)}</p>` }))
    );
  });

  const extract = (content: string) => {
    mocks.llm.mockResolvedValue(reply(content));
    return extractAndValidateRecipe('https://x.com/soup', 'Soup');
  };
  const tag = (content: string) => {
    mocks.llm.mockResolvedValue(reply(content));
    return generateRecipeMetadata(recipe);
  };

  it('extractAndValidateRecipe parses an object followed by prose', async () => {
    const result = await extract(`${json(recipe)}\n\nI hope this {helps}.`);
    expect(result.success).toBe(true);
    expect(result.recipe?.name).toBe('Soup');
  });

  it('extractAndValidateRecipe parses the first of two fenced blocks', async () => {
    const result = await extract(`${fence(recipe)}\n${fence({ ...recipe, name: 'Other' })}`);
    expect(result.recipe?.name).toBe('Soup');
  });

  it('extractAndValidateRecipe returns the parse failure for malformed JSON', async () => {
    const result = await extract('{name: Soup}');
    expect(result).toEqual({ success: false, error: 'Failed to parse LLM response as JSON' });
  });

  it('generateRecipeMetadata parses an object followed by prose', async () => {
    expect(await tag(`${json(meta)}\nThis looks {spicy}.`)).toMatchObject({ cuisine: 'Thai' });
  });

  it('generateRecipeMetadata parses the first of two fenced blocks', async () => {
    const result = await tag(`${fence(meta)}\n${fence({ ...meta, cuisine: 'French' })}`);
    expect(result.cuisine).toBe('Thai');
  });

  it('generateRecipeMetadata still returns defaults for malformed JSON', async () => {
    expect(await tag('{cuisine: Thai}')).toEqual({
      cuisine: 'International',
      tags: [],
      difficulty: 'medium',
      dietaryInfo: [],
    });
  });
});

describe('recipe-cleaner (#228)', () => {
  const cleaned = {
    title: 'Soup',
    description: 'd',
    ingredients: ['1 onion'],
    instructions: '1. Chop',
  };

  beforeEach(() => {
    // Skip the 1s pause between recipes.
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => {
      fn();
      return 0;
    }) as never);
  });

  const run = (content: string) => {
    mocks.generate.mockResolvedValue(content);
    return cleanRecipesWithOllama(1);
  };

  it('parses an object followed by prose', async () => {
    expect(await run(`${json(cleaned)}\n\nChanges: fixed {typos}.`)).toMatchObject({
      processed: 1,
      errors: [],
    });
  });

  it('parses the first of two objects', async () => {
    expect(await run(`${json(cleaned)}\n${json({ ...cleaned, title: 'Other' })}`)).toMatchObject({
      processed: 1,
      errors: [],
    });
  });

  it('records a parse error for malformed JSON', async () => {
    const result = await run('{title: Soup}');
    expect(result.processed).toBe(0);
    expect(result.errors[0]).toMatch(/JSON parse failed/);
  });
});

describe('instruction-classifier batch (#228)', () => {
  const steps = [
    { step_index: 0, confidence: 0.9, work_type: 'prep' },
    { step_index: 1, confidence: 0.8, work_type: 'cook' },
  ];

  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const run = (content: string) => {
    mocks.llm.mockResolvedValue(reply(content));
    return classifyRecipeInstructions(['Chop', 'Boil']);
  };

  it('parses an array followed by prose', async () => {
    const result = await run(`${fence(steps)}\n\nBoth steps are [simple].`);
    expect(result.map((m) => m.step_index)).toEqual([0, 1]);
  });

  it('parses the first of two arrays', async () => {
    const result = await run(`${json(steps)}\n${json([steps[0]])}`);
    expect(result).toHaveLength(2);
  });

  it('returns an empty list for malformed JSON', async () => {
    expect(await run('[{step_index: 0}]')).toEqual([]);
  });

  it.each([
    ['a stray [1] before the real array', `Steps [1]:\n${json(steps)}`],
    ['an array with a non-object element', json([steps[0], 3])],
  ])('returns an empty list for %s', async (_label, content) => {
    expect(await run(content)).toEqual([]);
  });
});

describe('recipe-crawl-steps convertUrlToRecipe (#228)', () => {
  const recipe = {
    name: 'Soup',
    description: 'd',
    ingredients: ['1 onion'],
    instructions: ['Chop'],
    confidenceScore: 0.9,
    isValid: true,
  };

  const run = (content: string) => {
    mocks.scrape.mockResolvedValue({ markdown: '# Soup', metadata: {} });
    mocks.llm.mockResolvedValue(reply(content));
    return convertUrlToRecipe('https://x.com/soup');
  };

  it('parses an object followed by prose', async () => {
    const result = await run(`${fence(recipe)}\n\nLet me know if you need {more}.`);
    expect(result.success).toBe(true);
    expect(result.recipe?.name).toBe('Soup');
  });

  it('parses the first of two objects', async () => {
    const result = await run(`${json(recipe)}\n${json({ ...recipe, name: 'Other' })}`);
    expect(result.recipe?.name).toBe('Soup');
  });

  it('returns the failure result for malformed JSON', async () => {
    const result = await run('{name: Soup}');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('meal-pairing-system (#228)', () => {
  const course = {
    name: 'Salad',
    description: 'd',
    dominant_textures: [],
    temperature: 'cold',
    prep_time_minutes: 5,
    key_ingredients: [],
    pairing_rationale: 'r',
  };
  const plan = {
    appetizer: course,
    main: course,
    side: course,
    dessert: course,
    meal_analysis: {},
  };

  const run = (text: string) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ text }] }) }))
    );
    return generateMealWithSemanticSearch({ mode: 'freestyle' });
  };

  it('parses an object followed by prose', async () => {
    const result = await run(`${json(plan)}\n\nEnjoy your {meal}!`);
    expect(result.main.name).toBe('Salad');
  });

  it('parses the first of two objects', async () => {
    const other = { ...plan, main: { ...course, name: 'Steak' } };
    const result = await run(`${fence(plan)}\n${fence(other)}`);
    expect(result.main.name).toBe('Salad');
  });

  it('throws for malformed JSON', async () => {
    await expect(run('{appetizer: Salad}')).rejects.toThrow();
  });
});
