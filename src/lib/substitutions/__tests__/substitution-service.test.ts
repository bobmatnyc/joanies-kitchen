// #24: error arm of AI substitution generation (OpenRouter 404 from the ZDR guardrail).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const create = vi.fn();
vi.mock('@/lib/ai/openrouter-server', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create } } }),
}));

import { getCacheStats, getSubstitutions } from '../substitution-service';

describe('#24 AI substitution error arm', () => {
  beforeEach(() => {
    create.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns has_substitutions:false on a 404, logs the status, and does not cache the failure', async () => {
    const err = Object.assign(new Error('404 No endpoints found'), { status: 404 });
    create.mockRejectedValue(err);
    const before = getCacheStats().total;

    const result = await getSubstitutions('zzz-unlisted-ingredient');

    expect(result.failed).toBe(true); // #95: a failure, not an empty success
    expect(result.has_substitutions).toBe(false);
    expect(result.substitutions).toEqual([]);
    expect(result.notes).toBe(
      'Unable to generate substitutions at this time. Please try again later.'
    );
    expect(console.error).toHaveBeenCalledWith(
      'AI substitution generation failed',
      expect.objectContaining({ status: 404, ingredient: 'zzz-unlisted-ingredient' })
    );
    expect(getCacheStats().total).toBe(before);

    // A second call must hit the client again (not a cached failure).
    await getSubstitutions('zzz-unlisted-ingredient');
    expect(create).toHaveBeenCalledTimes(2);
  });
});
