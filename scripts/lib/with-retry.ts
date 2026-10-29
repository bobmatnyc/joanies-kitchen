/**
 * #96 D57: bounded retry with a per-attempt timeout, for the build-time model fetch.
 *
 * Why: a stalled Hugging Face download must not hang `next build`; a transient
 * failure should not fail it either, but a persistent one must.
 * What: calls `attempt(signal)` up to `attempts` times. Each call gets a fresh
 * `AbortSignal.timeout(timeoutMs)`, which the caller passes to `fetch` so it
 * also aborts a stalled body read. Waits `backoffMs * 2^(n-1)` between tries.
 * After the last failure it rethrows that failure (fails closed).
 * Test: `retries after a timed-out attempt and returns the next result`,
 * `fails closed after the last attempt`
 */
export interface RetryOptions {
  attempts: number;
  timeoutMs: number;
  backoffMs: number;
  /** Injected so tests skip the real backoff. */
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown) => void;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(
  attempt: (signal: AbortSignal) => Promise<T>,
  { attempts, timeoutMs, backoffMs, sleep = realSleep, onRetry }: RetryOptions
): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError(`attempts must be a positive integer, got ${attempts}`);
  }
  let lastError: unknown;
  for (let n = 1; n <= attempts; n++) {
    try {
      return await attempt(AbortSignal.timeout(timeoutMs));
    } catch (error) {
      lastError = error;
      if (n === attempts) break;
      onRetry?.(n, error);
      await sleep(backoffMs * 2 ** (n - 1));
    }
  }
  throw lastError;
}
