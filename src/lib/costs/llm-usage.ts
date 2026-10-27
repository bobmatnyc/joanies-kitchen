/**
 * LLM usage parsing and chat-client instrumentation for the cost ledger (#6).
 */

import type OpenAI from 'openai';
import {
  type CostProvider,
  computeLlmCost,
  LLM_TOKEN_PRICES,
  UNKNOWN_LLM_REQUEST_FLOOR_USD,
} from './rates';
import { reportUnknownCost, trackCost } from './tracker';

export interface LlmUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** USD reported by the provider, when present. */
  costUsd: number | undefined;
  /** False when the response carried no `usage` object at all. */
  hasUsage: boolean;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Why: OpenRouter, Perplexity and Anthropic each report usage in a different shape.
 * What: Reads token counts (`prompt_tokens`/`completion_tokens` or
 * `input_tokens`/`output_tokens`) and a measured cost from `usage.cost`
 * (OpenRouter: number; Perplexity: `{ total_cost }`). `requestedModel` wins
 * over the response's model id because it is the id the price table uses.
 * Test: `parseLlmUsage reads OpenRouter usage.cost`, `parseLlmUsage reads Perplexity cost.total_cost`,
 * `parseLlmUsage reads Anthropic input/output tokens`
 */
export function parseLlmUsage(response: unknown, requestedModel?: string): LlmUsage {
  const body = (response ?? {}) as { model?: unknown; usage?: Record<string, unknown> | null };
  const usage = body.usage ?? undefined;
  const rawCost = usage?.cost;
  let costUsd: number | undefined;
  if (typeof rawCost === 'number' && Number.isFinite(rawCost)) {
    costUsd = rawCost;
  } else if (rawCost && typeof rawCost === 'object') {
    const total = (rawCost as { total_cost?: unknown }).total_cost;
    if (typeof total === 'number' && Number.isFinite(total)) costUsd = total;
  }
  return {
    model: requestedModel ?? (typeof body.model === 'string' ? body.model : 'unknown'),
    promptTokens: num(usage?.prompt_tokens ?? usage?.input_tokens),
    completionTokens: num(usage?.completion_tokens ?? usage?.output_tokens),
    costUsd,
    hasUsage: usage !== undefined,
  };
}

/**
 * Production fallback for an unknown model: the token estimate at the most
 * expensive known model, never below the provider's per-request floor (#6).
 */
function unknownModelEstimate(
  provider: CostProvider,
  promptTokens: number,
  completionTokens: number
): number {
  let max = UNKNOWN_LLM_REQUEST_FLOOR_USD[provider] ?? 0;
  for (const model of Object.keys(LLM_TOKEN_PRICES)) {
    max = Math.max(max, computeLlmCost(model, promptTokens, completionTokens) ?? 0);
  }
  return max;
}

/**
 * Why: OpenRouter must be booked at its measured cost, falling back to
 * tokens x price only when the response has no cost field.
 * What: Records one ledger row for a chat/messages response under operation
 * `<kind>:<model>`, with units = total tokens.
 * Test: `trackLlmResponse books the measured OpenRouter cost`,
 * `trackLlmResponse falls back to tokens x price`,
 * `trackLlmResponse floors an unknown model with no usage in production`
 */
export async function trackLlmResponse(
  provider: CostProvider,
  response: unknown,
  options: { model?: string; kind?: 'chat' | 'messages' } = {}
): Promise<void> {
  const usage = parseLlmUsage(response, options.model);
  const operation = `${options.kind ?? 'chat'}:${usage.model}`;
  if (!usage.hasUsage) {
    console.warn(
      `[CostLedger] ${provider}:${operation} response had no usage; booking tokens as 0`
    );
  }
  let estimateUsd = computeLlmCost(usage.model, usage.promptTokens, usage.completionTokens);
  if (usage.costUsd === undefined && estimateUsd === undefined) {
    reportUnknownCost(`No price for model "${usage.model}" (${provider}) and no measured cost`);
    estimateUsd = unknownModelEstimate(provider, usage.promptTokens, usage.completionTokens);
  }
  await trackCost({
    provider,
    operation,
    units: usage.promptTokens + usage.completionTokens,
    measuredUsd: usage.costUsd,
    estimateUsd,
  });
}

type CreateFn = OpenAI['chat']['completions']['create'];

/**
 * Why: many call sites share a handful of OpenAI-SDK clients; instrumenting
 * the client covers them all without editing each call.
 * What: Replaces `client.chat.completions.create` with a wrapper that, for
 * non-streaming calls, asks OpenRouter for usage accounting
 * (`usage: { include: true }`), awaits the response, and records it via
 * `trackLlmResponse`. Streaming calls pass through untracked with a warning.
 * The wrapper returns a plain Promise, so `.withResponse()` is unavailable.
 * Test: `withChatCostTracking records an OpenRouter completion`
 */
export function withChatCostTracking<T extends OpenAI>(client: T, provider: CostProvider): T {
  const completions = client.chat.completions;
  const original = completions.create.bind(completions) as (
    body: Parameters<CreateFn>[0],
    options?: Parameters<CreateFn>[1]
  ) => Promise<unknown>;

  const tracked = async (
    body: Parameters<CreateFn>[0],
    options?: Parameters<CreateFn>[1]
  ): Promise<unknown> => {
    if (body.stream) {
      console.warn(`[CostLedger] Streaming ${provider} completion is not cost-tracked`);
      return original(body, options);
    }
    const requestBody = provider === 'openrouter' ? { ...body, usage: { include: true } } : body;
    const response = await original(requestBody as Parameters<CreateFn>[0], options);
    await trackLlmResponse(provider, response, { model: body.model, kind: 'chat' });
    return response;
  };

  completions.create = tracked as unknown as CreateFn;
  return client;
}
