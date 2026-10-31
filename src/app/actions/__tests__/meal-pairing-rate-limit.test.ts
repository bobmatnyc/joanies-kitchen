// @vitest-environment node
/**
 * generateBalancedMeal is rate limited per user before its paid LLM call,
 * against the real usage_counters upsert (PGlite).
 */

import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  dbDown: false,
  generateMeal: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => 'user-meal-1',
  getSessionUser: async () => ({ id: 'user-meal-1' }),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '203.0.113.9' }),
}));
vi.mock('@/lib/rate-limit/counter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limit/counter')>()),
  defaultUsageDb: async () => {
    if (state.dbDown) throw new Error('relation "usage_counters" does not exist');
    return state.db;
  },
}));
vi.mock('@/lib/ai/meal-pairing-engine', () => ({ generateMeal: state.generateMeal }));

import { PaidCallBlockedError } from '@/lib/costs';
import { usageCounters } from '@/lib/db/usage-counters-schema';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { generateBalancedMeal } from '../meal-pairing';
import { createVisibilityDb } from './recipe-visibility-db';

const { limit } = RATE_LIMITS['meal-pairing'];
let client: PGlite;

beforeAll(async () => {
  const built = await createVisibilityDb([usageCounters], { usageCounters }, { constraints: true });
  client = built.client;
  state.db = built.db;
});

afterAll(async () => {
  await client?.close();
});

beforeEach(async () => {
  await client.exec('DELETE FROM "usage_counters";');
  state.dbDown = false;
  state.generateMeal.mockReset();
  state.generateMeal.mockResolvedValue({ success: true, mealPlan: {} });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('generateBalancedMeal rate limit', () => {
  it('allows N calls per window and refuses call N+1 before the LLM call', async () => {
    for (let i = 0; i < limit; i++) {
      const result = await generateBalancedMeal({ cuisine: 'Italian' });
      expect(result.success).toBe(true);
    }
    expect(state.generateMeal).toHaveBeenCalledTimes(limit);
    const over = await generateBalancedMeal({ cuisine: 'Italian' });
    expect(over).toMatchObject({ success: false, errorCode: 'RATE_LIMITED' });
    expect(state.generateMeal).toHaveBeenCalledTimes(limit);
  });

  it('fails closed with LIMITER_UNAVAILABLE and no LLM call when the limiter is down', async () => {
    state.dbDown = true;
    const result = await generateBalancedMeal({ cuisine: 'Italian' });
    expect(result).toMatchObject({ success: false, errorCode: 'LIMITER_UNAVAILABLE' });
    expect(state.generateMeal).not.toHaveBeenCalled();
  });

  it('maps the cost-ceiling refusal to its typed code', async () => {
    state.generateMeal.mockRejectedValue(new PaidCallBlockedError('COST_CAP_REACHED', 'cap'));
    const result = await generateBalancedMeal({ cuisine: 'Italian' });
    expect(result).toMatchObject({ success: false, errorCode: 'COST_CAP_REACHED' });
  });
});
