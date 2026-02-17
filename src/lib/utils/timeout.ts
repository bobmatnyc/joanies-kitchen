/**
 * Timeout and Retry Utilities
 *
 * Provides robust timeout and retry mechanisms for async operations
 * with exponential backoff and circuit breaker patterns.
 */

/**
 * Options for retry logic
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay between retries in ms (default: 1000) */
  initialDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay between retries in ms (default: 10000) */
  maxDelay?: number;
  /** Function to determine if error is retryable (default: all errors retryable) */
  shouldRetry?: (error: unknown) => boolean;
  /** Callback invoked on each retry attempt */
  onRetry?: (attempt: number, error: unknown) => void;
}

/**
 * Wraps a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Custom error message for timeout
 * @returns Promise that rejects if timeout is exceeded
 *
 * @example
 * const data = await withTimeout(
 *   fetch('/api/data'),
 *   5000,
 *   'Request timed out after 5 seconds'
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = `Operation timed out after ${timeoutMs}ms`
): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Executes a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Result of the function
 *
 * @example
 * const data = await withRetry(
 *   () => searchRecipes(query),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    backoffMultiplier = 2,
    maxDelay = 10000,
    shouldRetry = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw error;
      }

      // Notify about retry
      if (onRetry) {
        onRetry(attempt, error);
      }

      // Wait before retrying with exponential backoff
      await sleep(Math.min(delay, maxDelay));
      delay *= backoffMultiplier;
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Combines timeout and retry logic
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout for each attempt in milliseconds
 * @param retryOptions - Retry configuration options
 * @returns Result of the function
 *
 * @example
 * const data = await withTimeoutAndRetry(
 *   () => searchRecipes(query),
 *   10000,
 *   { maxAttempts: 3 }
 * );
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  retryOptions: RetryOptions = {}
): Promise<T> {
  return withRetry(
    () => withTimeout(fn(), timeoutMs, `Request timeout after ${timeoutMs}ms`),
    {
      ...retryOptions,
      // Don't retry on timeout errors by default (override if needed)
      shouldRetry: (error) => {
        // Don't retry timeouts unless explicitly configured
        if (error instanceof Error && error.message.includes('timeout')) {
          return retryOptions.shouldRetry ? retryOptions.shouldRetry(error) : false;
        }
        return retryOptions.shouldRetry ? retryOptions.shouldRetry(error) : true;
      },
    }
  );
}

/**
 * Simple sleep utility
 *
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Circuit breaker state
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject immediately
  HALF_OPEN = 'HALF_OPEN', // Testing if recovered
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close circuit (default: 60000) */
  resetTimeout?: number;
  /** Time window in ms to track failures (default: 60000) */
  windowSize?: number;
}

/**
 * Circuit breaker implementation to prevent cascading failures
 *
 * @example
 * const breaker = new CircuitBreaker({ failureThreshold: 3 });
 * const data = await breaker.execute(() => fetchData());
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime?: number;
  private nextAttemptTime?: number;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 60000,
      windowSize: options.windowSize ?? 60000,
    };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if it's time to attempt recovery
      if (this.nextAttemptTime && Date.now() >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN - too many recent failures');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.CLOSED;
    this.nextAttemptTime = undefined;
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    const now = Date.now();

    // Reset count if outside window
    if (this.lastFailureTime && now - this.lastFailureTime > this.options.windowSize) {
      this.failureCount = 0;
    }

    this.failureCount++;
    this.lastFailureTime = now;

    // Open circuit if threshold exceeded
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = now + this.options.resetTimeout;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.nextAttemptTime = undefined;
  }
}
