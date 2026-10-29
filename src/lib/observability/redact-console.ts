/**
 * #55 S3: redacts secrets from server console output, including Next's own.
 *
 * Why: Next logs unhandled server errors itself through `console.error`
 * (e.g. a server action fed a non-JSON body printed the raw email in its
 * `SyntaxError`). Our `app-error` line was clean; Next's line was not.
 * What: `installConsoleRedaction` wraps `console.error` and `console.warn`.
 * String arguments and the `message`/`stack` of Error arguments (and their
 * `cause` chain) pass through `redactLogText`. Errors are copied, never
 * mutated. Other argument types pass through untouched. If redaction throws,
 * the original arguments are logged. Installing twice is a no-op.
 * Limits: output written straight to `process.stdout`/`stderr`, `console.log`
 * and `console.info`, and secrets nested inside plain objects are not covered.
 * Test: `src/lib/observability/__tests__/redact-console.test.ts`
 */

import { redactLogText } from './report-error';

const WRAPPED = Symbol.for('joanies.redactConsole');
const MAX_CAUSE_DEPTH = 3;

type ConsoleFn = (...args: unknown[]) => void;

function redactError(error: Error, depth: number): Error {
  // Same prototype and own properties (digest, code, ...) so inspection looks the same.
  const copy = Object.create(Object.getPrototypeOf(error)) as Error;
  Object.defineProperties(copy, Object.getOwnPropertyDescriptors(error));
  const define = (key: string, value: unknown) =>
    Object.defineProperty(copy, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  if (typeof error.message === 'string') define('message', redactLogText(error.message));
  if (typeof error.stack === 'string') define('stack', redactLogText(error.stack));
  const cause = (error as { cause?: unknown }).cause;
  if (cause !== undefined) {
    define('cause', depth < MAX_CAUSE_DEPTH ? redactArg(cause, depth + 1) : '[cause omitted]');
  }
  return copy;
}

/** Redacted copy of one console argument; non-string, non-Error values are returned as is. */
export function redactArg(arg: unknown, depth = 0): unknown {
  if (typeof arg === 'string') return redactLogText(arg);
  if (arg instanceof Error) return redactError(arg, depth);
  return arg;
}

/** Wraps one console method; the wrapper never throws on redaction failure. */
export function wrapConsoleMethod(original: ConsoleFn): ConsoleFn {
  const wrapped: ConsoleFn = function (this: unknown, ...args: unknown[]) {
    let safe: unknown[];
    try {
      safe = args.map((arg) => redactArg(arg));
    } catch {
      // #55: redaction failed; log the original rather than lose the line.
      safe = args;
    }
    return original.apply(this, safe);
  };
  (wrapped as unknown as Record<symbol, boolean>)[WRAPPED] = true;
  return wrapped;
}

/** Installs the wrapper on `console.error` and `console.warn` once per process. */
export function installConsoleRedaction(target: Console = console): void {
  for (const method of ['error', 'warn'] as const) {
    const current = target[method] as ConsoleFn & Record<symbol, boolean>;
    if (typeof current !== 'function' || current[WRAPPED]) continue;
    target[method] = wrapConsoleMethod(current);
  }
}
