// #95: an AI failure is reported as a failure, not an empty success.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/session-user', () => ({
  getSessionUserId: async () => 'u1',
  getSessionUser: async () => ({ id: 'u1' }),
}));
vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: async () => ({ allowed: true }),
}));

const create = vi.fn();
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create } } }),
}));

import { getMultipleIngredientSubstitutions } from '../substitutions';

const aiOk = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          ingredient_category: 'misc',
          substitutions: [
            {
              substitute_ingredient: 'thing',
              confidence: 'high',
              confidence_score: 0.9,
              reason: 'works',
            },
          ],
        }),
      },
    },
  ],
};

describe('#95 getMultipleIngredientSubstitutions AI failure', () => {
  beforeEach(() => {
    create.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('reports an AI 404 as success:false with AI_FAILED', async () => {
    create.mockRejectedValue(Object.assign(new Error('404 No endpoints'), { status: 404 }));
    const result = await getMultipleIngredientSubstitutions(['zzz-fail-only-ingredient']);
    expect(result).toMatchObject({ success: false, errorCode: 'AI_FAILED' });
    expect(console.error).toHaveBeenCalledWith(
      'AI substitution generation failed',
      expect.objectContaining({ status: 404 })
    );
  });

  it('static-only path is unchanged', async () => {
    const result = await getMultipleIngredientSubstitutions(['butter']);
    expect(result.success).toBe(true);
    expect(result.data?.[0].failed).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('mixed batch keeps successes and marks the failed one', async () => {
    create.mockImplementation(async (req: { messages: { content: string }[] }) => {
      if (req.messages.some((m) => m.content.includes('zzz-mixed-bad'))) {
        throw Object.assign(new Error('404'), { status: 404 });
      }
      return aiOk;
    });
    const result = await getMultipleIngredientSubstitutions(['butter', 'zzz-mixed-bad']);
    expect(result.success).toBe(true);
    const [ok, bad] = result.data ?? [];
    expect(ok.failed).toBeUndefined();
    expect(ok.substitutions.length).toBeGreaterThan(0);
    expect(bad.failed).toBe(true);
  });
});
