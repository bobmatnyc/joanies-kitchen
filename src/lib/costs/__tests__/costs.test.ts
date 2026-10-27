/**
 * Unit tests for the crawl cost ledger (#6): rate lookup, measured-cost
 * override, unknown-operation behaviour, OpenRouter usage parsing, and the
 * fail-open insert path.
 */

import type OpenAI from 'openai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { insertedRows, insertMock } = vi.hoisted(() => {
  const insertedRows: Record<string, unknown>[] = [];
  const insertMock = vi.fn(() => ({
    values: vi.fn(async (row: Record<string, unknown>) => {
      insertedRows.push(row);
    }),
  }));
  return { insertedRows, insertMock };
});

vi.mock('@/lib/db', () => ({ db: { insert: insertMock } }));
vi.mock('@/lib/db/autonomous-scraper-schema', () => ({ crawlCostEvents: {} }));

import {
  COST_RATES,
  computeLlmCost,
  lookupRate,
  parseLlmUsage,
  resolveCost,
  setCostRunId,
  trackCost,
  trackLlmResponse,
  UnknownCostOperationError,
  withChatCostTracking,
  withCostRun,
} from '..';

const RUN_ID = '11111111-2222-4333-8444-555555555555';

beforeEach(() => {
  insertedRows.length = 0;
  insertMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('rate lookup', () => {
  it('lookupRate returns the table entry for a known operation', () => {
    expect(lookupRate('tavily', 'search.advanced')).toEqual(COST_RATES['tavily:search.advanced']);
    expect(lookupRate('tavily', 'search.advanced')?.usdPerUnit).toBeCloseTo(0.016);
  });

  it('lookupRate returns undefined for an unknown operation', () => {
    expect(lookupRate('tavily', 'search.turbo')).toBeUndefined();
  });

  it('computeLlmCost prices tokens by model', () => {
    // 1M input @ $1 + 1M output @ $5
    expect(computeLlmCost('anthropic/claude-haiku-4-5', 1_000_000, 1_000_000)).toBeCloseTo(6);
  });

  it('computeLlmCost returns undefined for an unknown model', () => {
    expect(computeLlmCost('vendor/no-such-model', 10, 10)).toBeUndefined();
  });
});

describe('resolveCost', () => {
  it('resolveCost prefers a measured cost over the rate table', () => {
    const row = resolveCost({ provider: 'tavily', operation: 'search.basic', measuredUsd: 0.5 });
    expect(row).toMatchObject({ usd: 0.5, estimated: false });
  });

  it('resolveCost uses units x rate when nothing is measured', () => {
    const row = resolveCost({ provider: 'firecrawl', operation: 'scrape', units: 3 });
    expect(row.usd).toBeCloseTo(3 * (COST_RATES['firecrawl:scrape']?.usdPerUnit ?? NaN));
    expect(row.estimated).toBe(true);
  });

  it('trackCost throws on an unknown operation outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    await expect(trackCost({ provider: 'tavily', operation: 'search.turbo' })).rejects.toThrow(
      UnknownCostOperationError
    );
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('trackCost records an unknown operation as estimated in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const row = await trackCost({ provider: 'tavily', operation: 'search.turbo' });
    expect(row.estimated).toBe(true);
    expect(row.usd).toBeGreaterThan(0); // never a silent $0
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tavily:search.turbo'));
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]).toMatchObject({ estimated: true, operation: 'search.turbo' });
  });

  it('withCostRun attaches the run id set inside it; non-UUID ids are ignored', async () => {
    await withCostRun(async () => {
      setCostRunId('dry-run-123');
      expect(resolveCost({ provider: 'brave', operation: 'web-search' }).runId).toBeNull();
      setCostRunId(RUN_ID);
      await trackCost({ provider: 'brave', operation: 'web-search' });
    });
    expect(insertedRows[0]).toMatchObject({ run_id: RUN_ID, provider: 'brave' });
    expect(resolveCost({ provider: 'brave', operation: 'web-search' }).runId).toBeNull();
  });
});

describe('fail-open insert', () => {
  it('trackCost logs and swallows a failed insert', async () => {
    insertMock.mockImplementationOnce(() => ({
      values: vi.fn(async () => {
        throw new Error('connection refused');
      }),
    }));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const row = await trackCost({ provider: 'serpapi', operation: 'search' });
    expect(row.usd).toBeCloseTo(0.015);
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('[CostLedger] Failed to record cost event serpapi:search'),
      expect.any(Error)
    );
  });
});

describe('LLM usage parsing', () => {
  it('parseLlmUsage reads OpenRouter usage.cost', () => {
    const usage = parseLlmUsage(
      {
        model: 'anthropic/claude-4.5-haiku-20251001',
        usage: { prompt_tokens: 1200, completion_tokens: 300, total_tokens: 1500, cost: 0.00271 },
      },
      'anthropic/claude-haiku-4-5'
    );
    expect(usage).toEqual({
      model: 'anthropic/claude-haiku-4-5',
      promptTokens: 1200,
      completionTokens: 300,
      costUsd: 0.00271,
      hasUsage: true,
    });
  });

  it('parseLlmUsage reads Perplexity cost.total_cost', () => {
    const usage = parseLlmUsage({
      model: 'sonar',
      usage: { prompt_tokens: 10, completion_tokens: 20, cost: { total_cost: 0.0051 } },
    });
    expect(usage.costUsd).toBe(0.0051);
    expect(usage.model).toBe('sonar');
  });

  it('parseLlmUsage reads Anthropic input/output tokens', () => {
    const usage = parseLlmUsage({ usage: { input_tokens: 40, output_tokens: 7 } }, 'x');
    expect(usage).toMatchObject({ promptTokens: 40, completionTokens: 7, costUsd: undefined });
  });

  it('trackLlmResponse books the measured OpenRouter cost', async () => {
    await trackLlmResponse(
      'openrouter',
      { usage: { prompt_tokens: 1000, completion_tokens: 100, cost: 0.0042 } },
      { model: 'anthropic/claude-haiku-4-5' }
    );
    expect(insertedRows[0]).toMatchObject({
      provider: 'openrouter',
      operation: 'chat:anthropic/claude-haiku-4-5',
      units: '1100',
      usd: '0.004200',
      estimated: false,
    });
  });

  it('trackLlmResponse falls back to tokens x price', async () => {
    await trackLlmResponse(
      'openrouter',
      { usage: { prompt_tokens: 1000, completion_tokens: 1000 } },
      { model: 'anthropic/claude-haiku-4-5' }
    );
    // 1000 * $1/M + 1000 * $5/M = $0.006
    expect(insertedRows[0]).toMatchObject({ usd: '0.006000', estimated: true });
  });

  it('trackLlmResponse throws for an unpriced model with no cost outside production', async () => {
    await expect(
      trackLlmResponse('openrouter', { usage: { prompt_tokens: 5 } }, { model: 'vendor/new' })
    ).rejects.toThrow(UnknownCostOperationError);
  });

  it('withChatCostTracking records an OpenRouter completion', async () => {
    const create = vi.fn(async (body: Record<string, unknown>) => ({
      model: body.model,
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 },
    }));
    const client = { chat: { completions: { create } } } as unknown as OpenAI;

    const tracked = withChatCostTracking(client, 'openrouter');
    const result = await tracked.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(result.choices[0]?.message?.content).toBe('ok');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ usage: { include: true } }),
      undefined
    );
    expect(insertedRows[0]).toMatchObject({
      operation: 'chat:openai/gpt-4o-mini',
      usd: '0.000100',
      estimated: false,
    });
  });
});
