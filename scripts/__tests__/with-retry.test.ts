import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../lib/with-retry';

// A fetch stand-in that never answers until its signal aborts, like a stalled download.
function hangingFetch(signal: AbortSignal): Promise<Response> {
  return new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

const fast = { timeoutMs: 20, backoffMs: 1000, sleep: () => Promise.resolve() };

describe('withRetry (#96 model fetch)', () => {
  it('retries after a timed-out attempt and returns the next result', async () => {
    const fetchMock = vi
      .fn<(url: string, init: { signal: AbortSignal }) => Promise<Response>>()
      .mockImplementationOnce((_url, init) => hangingFetch(init.signal))
      .mockResolvedValueOnce(new Response('ok'));
    const sleeps: number[] = [];

    const response = await withRetry(
      (signal) => fetchMock('https://hf.example/model', { signal }),
      {
        ...fast,
        attempts: 3,
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      }
    );

    expect(await response.text()).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(sleeps).toEqual([1000]);
  });

  it('fails closed after the last attempt', async () => {
    const fetchMock = vi.fn((signal: AbortSignal) => hangingFetch(signal));

    const error = await withRetry(fetchMock, { ...fast, attempts: 3 }).catch((e: unknown) => e);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((error as Error).name).toBe('TimeoutError');
  });

  it('backs off exponentially between attempts', async () => {
    const sleeps: number[] = [];
    await withRetry(() => Promise.reject(new Error('HTTP 503')), {
      ...fast,
      attempts: 3,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    }).catch(() => undefined);
    expect(sleeps).toEqual([1000, 2000]);
  });
});
