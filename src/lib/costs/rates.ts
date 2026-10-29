/**
 * Per-operation cost rates for paid external providers (#6).
 *
 * These are list-price ESTIMATES used only when the provider does not report a
 * measured USD cost for the call. A measured cost passed to `trackCost()`
 * always overrides them. Adjust a rate here when a plan or price changes; the
 * ledger stores the USD figure computed at call time, so history is unaffected.
 */

export type CostProvider =
  | 'tavily'
  | 'firecrawl'
  | 'jina'
  | 'openrouter'
  | 'anthropic'
  | 'openai'
  | 'perplexity'
  | 'brave'
  | 'serpapi';

/** Flat per-unit rate for a `provider:operation` key. */
export interface CostRate {
  usdPerUnit: number;
  /** What one unit is, for readers of the ledger (`request`, `credit`, `token`, ...). */
  unit: string;
}

/** Per-1M-token price for an LLM model, plus an optional flat per-request fee. */
export interface LlmTokenPrice {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  requestUsd?: number;
}

const TAVILY_USD_PER_CREDIT = 0.008; // pay-as-you-go
const FIRECRAWL_USD_PER_CREDIT = 16 / 3000; // Hobby plan: $16 / 3,000 credits
// #75: Jina per-token price, $0.02 per 1M tokens — the list rate adopted in #6,
// source https://jina.ai/embeddings/#pricing (re-check there when the plan changes).
// Shared by reader and embeddings.
export const JINA_USD_PER_TOKEN = 0.02 / 1_000_000;

/**
 * #75: smallest USD amount `crawl_cost_events.usd` (numeric(12,6)) can hold.
 * A cost below it is written as 0.000000 and never reaches the daily-cap sum.
 */
export const LEDGER_USD_RESOLUTION = 0.000001;

/** #75: ~4 chars/token, used only when Jina omits `usage.total_tokens`. */
const JINA_CHARS_PER_TOKEN_ESTIMATE = 4;

/**
 * Flat rates keyed `provider:operation`. LLM chat operations are priced per
 * model through `LLM_TOKEN_PRICES` instead and do not appear here.
 */
export const COST_RATES: Readonly<Record<string, CostRate>> = {
  // Tavily: basic search = 1 credit, advanced = 2; extract = 1 (basic) or 2 (advanced) credits per 5 URLs.
  'tavily:search.basic': { usdPerUnit: TAVILY_USD_PER_CREDIT, unit: 'request' },
  'tavily:search.advanced': { usdPerUnit: 2 * TAVILY_USD_PER_CREDIT, unit: 'request' },
  'tavily:extract.basic': { usdPerUnit: TAVILY_USD_PER_CREDIT / 5, unit: 'url' },
  'tavily:extract.advanced': { usdPerUnit: (2 * TAVILY_USD_PER_CREDIT) / 5, unit: 'url' },
  // Firecrawl bills in credits: a plain scrape is 1 credit, a crawl reports creditsUsed.
  'firecrawl:scrape': { usdPerUnit: FIRECRAWL_USD_PER_CREDIT, unit: 'credit' },
  'firecrawl:crawl': { usdPerUnit: FIRECRAWL_USD_PER_CREDIT, unit: 'credit' },
  // Jina bills reader and embeddings by token.
  'jina:reader': { usdPerUnit: JINA_USD_PER_TOKEN, unit: 'token' },
  'jina:embeddings': { usdPerUnit: JINA_USD_PER_TOKEN, unit: 'token' },
  // #57: rerank was untracked; ~$0.00004 per call (estimate from #17).
  'jina:rerank': { usdPerUnit: 0.00004, unit: 'request' },
  // Per-request search APIs.
  'brave:web-search': { usdPerUnit: 0.005, unit: 'request' },
  'serpapi:search': { usdPerUnit: 0.015, unit: 'request' },
  // OpenAI DALL-E 3, 1024x1024 standard quality.
  'openai:images.dall-e-3': { usdPerUnit: 0.04, unit: 'image' },
};

/**
 * Per-model token prices, keyed by the model id as sent to the provider.
 * Free models are listed at $0 so they are known, not unknown.
 */
export const LLM_TOKEN_PRICES: Readonly<Record<string, LlmTokenPrice>> = {
  'anthropic/claude-haiku-4-5': { inputUsdPerMTok: 1, outputUsdPerMTok: 5 },
  'claude-haiku-4-5': { inputUsdPerMTok: 1, outputUsdPerMTok: 5 },
  'anthropic/claude-3-haiku': { inputUsdPerMTok: 0.25, outputUsdPerMTok: 1.25 },
  'anthropic/claude-3.5-sonnet': { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  'anthropic/claude-sonnet-4.5': { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  'claude-sonnet-4-20250514': { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  'openai/gpt-4o': { inputUsdPerMTok: 2.5, outputUsdPerMTok: 10 },
  'openai/gpt-4o-mini': { inputUsdPerMTok: 0.15, outputUsdPerMTok: 0.6 },
  'openai/gpt-3.5-turbo': { inputUsdPerMTok: 0.5, outputUsdPerMTok: 1.5 },
  'mistralai/mixtral-8x7b-instruct': { inputUsdPerMTok: 0.54, outputUsdPerMTok: 0.54 },
  'perplexity/sonar': { inputUsdPerMTok: 1, outputUsdPerMTok: 1 },
  'perplexity/sonar-reasoning': { inputUsdPerMTok: 1, outputUsdPerMTok: 5 },
  'perplexity/sonar-pro': { inputUsdPerMTok: 3, outputUsdPerMTok: 15 },
  sonar: { inputUsdPerMTok: 1, outputUsdPerMTok: 1, requestUsd: 0.005 },
  'google/gemini-2.0-flash-exp:free': { inputUsdPerMTok: 0, outputUsdPerMTok: 0 },
  'google/gemini-2.5-flash-lite': { inputUsdPerMTok: 0.1, outputUsdPerMTok: 0.4 }, // #24
  'google/gemini-3.1-flash-lite': { inputUsdPerMTok: 0.25, outputUsdPerMTok: 1.5 }, // #24: ZDR-compliant
  'meta-llama/llama-3.2-3b-instruct:free': { inputUsdPerMTok: 0, outputUsdPerMTok: 0 },
  'mistralai/mistral-7b-instruct:free': { inputUsdPerMTok: 0, outputUsdPerMTok: 0 },
};

/**
 * Per-request floor for an LLM call to a model missing from `LLM_TOKEN_PRICES`
 * (same idea as sonar's flat `requestUsd`). It keeps an unknown model with no
 * `usage` data from being booked at $0, since its token estimate is then 0.
 */
export const UNKNOWN_LLM_REQUEST_FLOOR_USD: Readonly<Partial<Record<CostProvider, number>>> = {
  openrouter: 0.01,
  anthropic: 0.01,
  perplexity: 0.005,
};

/**
 * Why: a one-query embedding costs ~2e-7 USD, which the 6-decimal ledger column
 * rounded to $0, so Jina spend never counted toward the daily cap (#75).
 * What: Returns tokens x `JINA_USD_PER_TOKEN`, rounded UP to
 * `LEDGER_USD_RESOLUTION` (minimum one unit). With no usable token count it
 * estimates tokens from the input length (conservative estimate, not fail-closed).
 * Test: `a Jina call adds its token cost to today`,
 * `a Jina call with no usage still records a non-zero cost`
 */
export function jinaEmbeddingCost(
  totalTokens: number | null | undefined,
  inputs: readonly string[]
): { tokens: number; usd: number } {
  const reported = Number(totalTokens);
  // #75: no usage → estimate from input length instead of booking $0.
  const tokens =
    Number.isFinite(reported) && reported > 0
      ? reported
      : Math.max(
          1,
          Math.ceil(inputs.reduce((n, text) => n + text.length, 0) / JINA_CHARS_PER_TOKEN_ESTIMATE)
        );
  // #75: round up to the ledger's resolution so a tiny call is never stored as 0.
  const steps = Math.max(1, Math.ceil((tokens * JINA_USD_PER_TOKEN) / LEDGER_USD_RESOLUTION));
  return { tokens, usd: steps * LEDGER_USD_RESOLUTION };
}

/** Returns the flat rate for `provider:operation`, or undefined when unknown. */
export function lookupRate(provider: CostProvider, operation: string): CostRate | undefined {
  return COST_RATES[`${provider}:${operation}`];
}

/**
 * Why: OpenRouter sometimes omits `usage.cost`; tokens times list price is the
 * next-best figure.
 * What: Returns USD for the given token counts, or undefined for an unknown model.
 * Test: `computeLlmCost prices tokens by model`, `computeLlmCost returns undefined for an unknown model`
 */
export function computeLlmCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number | undefined {
  const price = LLM_TOKEN_PRICES[model];
  if (!price) return undefined;
  return (
    (promptTokens * price.inputUsdPerMTok + completionTokens * price.outputUsdPerMTok) / 1_000_000 +
    (price.requestUsd ?? 0)
  );
}

/**
 * Highest known flat rate for a provider, or its unknown-LLM request floor when
 * that is higher. Used as the conservative production fallback for an unknown
 * operation, so it is never recorded as a silent $0.
 */
export function providerFallbackRate(provider: CostProvider): number {
  const prefix = `${provider}:`;
  // #6: LLM providers have no flat rates, so start from their request floor.
  let max = UNKNOWN_LLM_REQUEST_FLOOR_USD[provider] ?? 0;
  for (const [key, rate] of Object.entries(COST_RATES)) {
    if (key.startsWith(prefix) && rate.usdPerUnit > max) max = rate.usdPerUnit;
  }
  return max;
}
