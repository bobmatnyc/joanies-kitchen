/** #17: Jina rerank, moved out of the semantic-search action file (500-line cap). */

import { assertWithinDailyCap, trackCost } from '@/lib/costs';

/**
 * Rerank a list of candidate recipes against a query using Jina Reranker v2.
 * Returns an array of indices (into `candidates`) ordered by relevance.
 * If the API fails or is not configured, returns null so callers fall through
 * to the original ordering (graceful degradation).
 */
export async function rerankWithJina(
  query: string,
  candidates: Array<{ id: string; name: string; description?: string | null }>
): Promise<number[] | null> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) return null;
  if (candidates.length < 3) return null;

  const documents = candidates.map((c) => `${c.name}. ${c.description ?? ''}`.trim());

  try {
    // #57: a blocked guard throws into the catch below, so the caller keeps the original order.
    await assertWithinDailyCap();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://api.jina.ai/v1/rerank', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'jina-reranker-v2-base-multilingual',
        query,
        documents,
        top_n: candidates.length,
        return_documents: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[Jina Reranker] HTTP ${response.status}, falling back to original order`);
      return null;
    }
    // #57: rerank spend was not in the ledger, so the daily cap could not see it.
    await trackCost({ provider: 'jina', operation: 'rerank' });

    const json = (await response.json()) as {
      results?: Array<{ index: number; relevance_score: number }>;
    };

    if (!json.results?.length) return null;

    return json.results.sort((a, b) => b.relevance_score - a.relevance_score).map((r) => r.index);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[Jina Reranker] Request failed, falling back to original order: ${msg}`);
    return null;
  }
}
