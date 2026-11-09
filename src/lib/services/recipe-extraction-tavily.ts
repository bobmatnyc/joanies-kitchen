/**
 * Tavily Extract tier for `RecipeExtractionService` (#302: moved from
 * recipe-extraction.service.ts to keep it under the 500-line cap).
 */

import {
  assertWithinDailyCap,
  TAVILY_EXTRACT_FLOOR_URLS,
  trackCost,
  unitsOrFloor,
} from '@/lib/costs';

/** Fetch a page's raw content via Tavily Extract; null when Tavily returns none. */
export async function fetchWithTavilyExtract(apiKey: string, url: string): Promise<string | null> {
  // #57: daily cost ceiling hard stop before the paid call.
  await assertWithinDailyCap();
  const response = await fetch('https://api.tavily.com/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      urls: [url],
      extract_depth: 'advanced',
      format: 'markdown',
      timeout: 15,
      chunks_per_source: 5,
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Tavily Extract API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ raw_content?: string }>;
    failed_results?: Array<{ error: string }>;
  };
  // #77: Tavily bills only extracted URLs; all-failed books nothing, an unknown empty shape books the floor.
  const allFailed = !data.results?.length && (data.failed_results?.length ?? 0) > 0;
  if (!allFailed) {
    await trackCost({
      provider: 'tavily',
      operation: 'extract.advanced',
      units: unitsOrFloor(data.results?.length, TAVILY_EXTRACT_FLOOR_URLS),
    });
  }

  if (data.results?.[0]?.raw_content) {
    return data.results[0].raw_content;
  }

  if (data.failed_results?.[0]?.error) {
    throw new Error(`Tavily Extract failed: ${data.failed_results[0].error}`);
  }

  return null;
}
