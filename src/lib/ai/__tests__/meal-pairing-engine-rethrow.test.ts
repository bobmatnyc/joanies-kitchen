// @vitest-environment node
/**
 * The meal engine rethrows the cost-ceiling refusal so the action can return its typed
 * code; any other failure stays a `{ success: false }` result. Only the OpenRouter client
 * and the recipe search are mocked, so the engine's own catch block runs.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('@/app/actions/semantic-search', () => ({
  semanticSearchRecipes: async () => ({ success: true, recipes: [] }),
}));
vi.mock('../openrouter-server', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create } } }),
}));

import { PaidCallBlockedError } from '@/lib/costs';
import { generateMeal } from '../meal-pairing-engine';

beforeEach(() => {
  create.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('generateMeal cost-ceiling rethrow', () => {
  it('rejects with the PaidCallBlockedError raised by the chat completion', async () => {
    const blocked = new PaidCallBlockedError('COST_CAP_REACHED', 'Daily cost cap reached');
    create.mockRejectedValue(blocked);
    await expect(generateMeal({ cuisine: 'Italian' })).rejects.toBe(blocked);
  });

  it('turns any other completion failure into a failed result', async () => {
    create.mockRejectedValue(new Error('upstream 500'));
    await expect(generateMeal({ cuisine: 'Italian' })).resolves.toMatchObject({
      success: false,
      error: 'upstream 500',
    });
  });
});
