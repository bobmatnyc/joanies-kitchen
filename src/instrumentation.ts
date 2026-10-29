/**
 * #55 S1: Next.js instrumentation hook. `onRequestError` fires once per
 * unhandled server error (RSC render, route handler, server action,
 * middleware) and forwards it to `reportError`. Headers are never read.
 * Test: `src/lib/observability/__tests__/report-error.test.ts`
 */

import { installConsoleRedaction } from '@/lib/observability/redact-console';
import { type ErrorSource, reportError } from '@/lib/observability/report-error';

/**
 * #55 S3: Next prints its own server error lines through console.error, raw
 * (an email reached prod logs this way). Redact them on the Node runtime only.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME === 'nodejs') installConsoleRedaction();
}

const ROUTE_TYPES: ReadonlySet<string> = new Set([
  'render',
  'route',
  'action',
  'middleware',
  'proxy',
]);

export function onRequestError(
  error: unknown,
  request: { path?: string },
  context: { routePath?: string; routeType?: string; renderSource?: string }
): void {
  // #55: map Next's routeType onto our source enum; unknown types stay "unknown".
  const routeType = context?.routeType ?? '';
  reportError(error, {
    source: (ROUTE_TYPES.has(routeType) ? routeType : 'unknown') as ErrorSource,
    path: request?.path,
    route: context?.routePath,
    detail: context?.renderSource,
  });
}
