/**
 * #314: the LLM structuring step sent only the first 12,000 chars of the page.
 * On long blog posts (smittenkitchen, 11-11 prod run) the recipe card sits past
 * that cut, behind prose and reader comments, so the LLM saw no recipe and the
 * page was skipped as non-recipe. These tests capture the prompt the service
 * sends through the fake OpenRouter client.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/costs', () => ({
  trackCost: vi.fn(),
  withChatCostTracking: <T>(client: T) => client,
}));
vi.mock('@/lib/ai/jina-scraper', () => ({ fetchContentWithJina: vi.fn() }));

import { RecipeExtractionService } from '@/lib/services/recipe-extraction.service';

type StructureFn = (content: string, url: string) => Promise<Record<string, unknown> | null>;

const URL = 'https://smittenkitchen.com/2019/05/potato-vareniki/';
const OLD_CAP = 12000;

/** Runs the private LLM structuring step and returns the page content it sent. */
async function sentContent(content: string): Promise<string> {
  const svc = new RecipeExtractionService();
  const create = vi.fn(async (_req: { messages: { content: string }[] }) => ({
    choices: [{ message: { content: '{}' } }],
  }));
  (svc as unknown as { _openrouter: unknown })._openrouter = { chat: { completions: { create } } };
  const fn = (svc as unknown as { structureWithClaude: StructureFn }).structureWithClaude.bind(svc);
  await fn(content, URL);
  expect(create).toHaveBeenCalledTimes(1);
  const prompt = create.mock.calls[0][0].messages[0].content;
  const m = prompt.match(/\nContent:\n([\s\S]*)\n\nReturn a JSON object with these fields/);
  if (!m) throw new Error(`prompt has no Content section:\n${prompt.slice(0, 300)}`);
  return m[1];
}

const PROSE =
  'I have been thinking about dumplings for weeks, about the ones my grandmother folded on ' +
  'Sunday mornings while the radio played, about how the dough never seemed to stick to her ' +
  'counter and always stuck to mine. The ingredients are humble and the method is patient. ' +
  'This year the cookbook from Kachka arrived and I finally had a reason to try again.\n\n';

const COMMENT = (n: number): string =>
  `${n}.   **Reader ${n}** I made these last weekend and they were wonderful, though I used ` +
  `the simple filling and a little more salt than you suggest. My kids folded half of them. ` +
  `[May 18, 2019 at 7:06 pm](${URL}#comment-${n})[Reply](${URL}?replytocom=${n}#respond)\n\n`;

const CARD_INGREDIENT = '1 1/2 pounds (680 grams) yukon gold potatoes, peeled and diced';
const CARD_DOUGH = '3 1/2 cups (450 grams) all-purpose flour, plus more for counter';
const CARD_STEP_1 =
  '**For the simple potato filling:** Place potatoes in medium saucepan and add milk and salt.';
const CARD_STEP_LAST =
  '**To cook the vareniki:** Bring a large pot of salted water to a boil and cook in batches.';

/** A Jina-reader-shaped smittenkitchen post: nav, long prose, early comments, card, comments. */
function smittenPost(paragraphs = 32, comments = 40): string {
  const nav = [
    'Title: potato vareniki',
    '',
    `URL Source: ${URL}`,
    '',
    'Markdown Content:',
    '[Skip to content](https://smittenkitchen.com/#content)',
    '',
    '*   [Surprise me!](https://smittenkitchen.com/?random)',
    '*   [Recipes](https://smittenkitchen.com/recipes)',
    '*   [Books](https://smittenkitchen.com/book/)',
    '',
    `# [potato vareniki](${URL})`,
    '',
  ].join('\n');
  const prose = PROSE.repeat(paragraphs);
  const earlyComments = `##### Readers asked\n\n${[1, 2, 3, 4, 5].map(COMMENT).join('')}`;
  const card = [
    '### Potato Vareniki',
    '',
    '*   **Servings:**Makes about 110 dumplings by hand',
    '*   **Time:**2 hours 30 minutes',
    '*   [Print](https://smittenkitchen.com/#)',
    '',
    '##### Simple potato filling',
    '',
    `*   ${CARD_INGREDIENT}`,
    '*   1 cup plus 2 tablespoons milk, any variety',
    '*   1 teaspoon kosher salt',
    '*   2 tablespoons unsalted butter',
    '',
    '##### Dumpling dough',
    '',
    `*   ${CARD_DOUGH}`,
    '*   1 tablespoon kosher salt',
    '*   1 large egg',
    '',
    CARD_STEP_1,
    '',
    '**Make the dumpling dough:** Combine flour and salt in a large bowl with a fork, then knead.',
    '',
    CARD_STEP_LAST,
    '',
  ].join('\n');
  const tail = `## 140 comments on potato vareniki\n\n${Array.from({ length: comments }, (_, i) =>
    COMMENT(i + 6)
  ).join('')}`;
  return `${nav}${prose}${earlyComments}\n${card}\n${tail}`;
}

beforeEach(() => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
  for (const m of ['log', 'debug', 'warn', 'error'] as const) {
    vi.spyOn(console, m).mockImplementation(() => undefined);
  }
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('structureWithClaude content window (#314)', () => {
  it('sends the recipe card of a long post whose card sits past char 12,000', async () => {
    const page = smittenPost();
    // The fixture must reproduce the prod shape: the card starts past the old cut.
    expect(page.indexOf('### Potato Vareniki')).toBeGreaterThan(OLD_CAP);
    expect(page.length).toBeGreaterThan(OLD_CAP * 1.5);

    const sent = await sentContent(page);
    expect(sent).toContain(CARD_INGREDIENT);
    expect(sent).toContain(CARD_DOUGH);
    expect(sent).toContain(CARD_STEP_1);
    expect(sent).toContain(CARD_STEP_LAST);
    expect(sent).toContain('Title: potato vareniki'); // the head slice keeps the title
    expect(sent.length).toBeLessThanOrEqual(OLD_CAP); // the cost bound holds
  });

  it('sends a page under the cap exactly as before', async () => {
    // A whole post under the cap whose card sits past the head slice, so a window would change it.
    const page = smittenPost(16, 2);
    expect(page.length).toBeLessThanOrEqual(OLD_CAP);
    expect(page.indexOf('### Potato Vareniki')).toBeGreaterThan(5000);
    expect(await sentContent(page)).toBe(page);
  });

  it('falls back to the first 12,000 chars when a long page has no recipe marker', async () => {
    const page = `Title: a long essay\n\n${PROSE.repeat(60)}`;
    expect(page.length).toBeGreaterThan(OLD_CAP);
    expect(await sentContent(page)).toBe(page.slice(0, OLD_CAP));
  });

  it('anchors on an Ingredients heading when lines carry no quantities', async () => {
    const card =
      '## Ingredients\n\n- flour\n- eggs\n- salt\n\n## Instructions\n\n' +
      '1. Mix the flour, eggs and salt into a firm dough.\n2. Rest, roll and cut it.\n';
    const page = `Title: fresh pasta\n\n${PROSE.repeat(40)}${card}${COMMENT(1).repeat(20)}`;
    expect(page.indexOf('## Ingredients')).toBeGreaterThan(OLD_CAP);
    const sent = await sentContent(page);
    expect(sent).toContain(card);
    expect(sent.length).toBeLessThanOrEqual(OLD_CAP);
  });

  const PRODUCE_CARD =
    '## Ingredients\n\n- 2 onions\n- 3 carrots\n\n## Instructions\n\n1. Chop everything.\n';
  const UNIT_RUN = '- 1 cup flour\n- 2 cups milk\n- 1 tsp salt\n';

  it('sends a card at ~5k on a 40k page', async () => {
    const page = `Title: soup\n\n${PROSE.repeat(13)}${PRODUCE_CARD}${COMMENT(1).repeat(140)}`;
    expect(page.indexOf('## Ingredients')).toBeGreaterThan(4000);
    expect(page.indexOf('## Ingredients')).toBeLessThan(6000);
    expect(page.length).toBeGreaterThan(40000);
    const sent = await sentContent(page);
    expect(sent).toContain(PRODUCE_CARD);
    expect(sent.length).toBeLessThanOrEqual(OLD_CAP);
  });

  it('keeps an early produce-only card when a unit-line run appears later', async () => {
    const page =
      `Title: soup\n\n${PROSE.repeat(13)}${PRODUCE_CARD}${COMMENT(1).repeat(80)}` +
      `## A reader's variation\n\n${UNIT_RUN}${COMMENT(2).repeat(40)}`;
    expect(page.indexOf('Chop everything')).toBeLessThan(OLD_CAP);
    expect(page.indexOf(UNIT_RUN)).toBeGreaterThan(OLD_CAP * 2);
    const sent = await sentContent(page);
    expect(sent).toContain('Chop everything');
    expect(sent.length).toBeLessThanOrEqual(OLD_CAP);
  });

  it('sends a card in the last 1k of a long page', async () => {
    const page = `Title: stew\n\n${PROSE.repeat(80)}${PRODUCE_CARD}`;
    expect(page.length - page.indexOf('## Ingredients')).toBeLessThan(1000);
    expect(page.length).toBeGreaterThan(OLD_CAP * 2);
    const sent = await sentContent(page);
    expect(sent).toContain(PRODUCE_CARD);
    expect(sent.length).toBeLessThanOrEqual(OLD_CAP);
  });
});
