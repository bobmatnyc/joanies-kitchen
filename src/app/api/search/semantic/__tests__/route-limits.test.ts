// @vitest-environment node
/** #17/#57: the semantic-search route maps typed refusals to HTTP status codes. */

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const search = vi.hoisted(() => vi.fn());
vi.mock('@/app/actions/semantic-search', () => ({
  semanticSearchRecipes: search,
  hybridSearchRecipes: search,
}));

import { GET, POST } from '../route';

const refused = (errorCode: string) => ({
  success: false,
  recipes: [],
  error: 'refused',
  errorCode,
  retryAfterSec: 17,
});

describe('#17 /api/search/semantic limits', () => {
  it('returns 429 with Retry-After over the rate limit', async () => {
    search.mockResolvedValueOnce(refused('RATE_LIMITED'));
    const response = await GET(new NextRequest('http://localhost/api/search/semantic?q=soup'));
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('17');
  });

  it('returns 503, not 429, when the limiter is unavailable', async () => {
    search.mockResolvedValueOnce(refused('LIMITER_UNAVAILABLE'));
    const response = await GET(new NextRequest('http://localhost/api/search/semantic?q=soup'));
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBeNull();
  });

  it('returns 503 at the daily cost ceiling', async () => {
    search.mockResolvedValueOnce(refused('COST_CAP_REACHED'));
    const request = new NextRequest('http://localhost/api/search/semantic', {
      method: 'POST',
      body: JSON.stringify({ query: 'soup' }),
    });
    expect((await POST(request)).status).toBe(503);
  });
});

describe('#96 D57 GET minSimilarity', () => {
  it('omits minSimilarity when absent and passes an explicit value through', async () => {
    search.mockResolvedValue({ success: true, recipes: [] });
    await GET(new NextRequest('http://localhost/api/search/semantic?q=soup'));
    expect(search.mock.lastCall?.[1].minSimilarity).toBeUndefined();
    await GET(new NextRequest('http://localhost/api/search/semantic?q=soup&minSimilarity=0'));
    expect(search.mock.lastCall?.[1].minSimilarity).toBe(0);
  });
});
