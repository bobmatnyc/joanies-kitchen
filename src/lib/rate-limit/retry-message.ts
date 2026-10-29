/** Client-safe: a refusal message with the retry time appended when the limiter gave one. */
export function withRetryAfter(message: string, retryAfterSec?: number): string {
  if (!retryAfterSec || retryAfterSec <= 0) return message;
  const wait =
    retryAfterSec >= 3600
      ? `${Math.ceil(retryAfterSec / 3600)} h`
      : retryAfterSec >= 60
        ? `${Math.ceil(retryAfterSec / 60)} min`
        : `${retryAfterSec} s`;
  return `${message} Try again in ${wait}.`;
}
