'use client';

/**
 * #55 S2: error boundaries report through here to `POST /api/client-error`.
 *
 * Why: client exceptions must reach the `app-error` log once per error, and
 * reporting must never break the error UI it runs inside.
 * What: `useReportBoundaryError` sends each error object once (a WeakSet
 * dedupes re-renders and StrictMode double effects). `sendClientError` uses
 * `navigator.sendBeacon`, falls back to `fetch` with keepalive, and swallows
 * every failure. Only the pathname is sent, never the query or hash.
 * Test: `src/lib/observability/__tests__/report-client-error.test.tsx`
 */

import { useEffect } from 'react';
import {
  CLIENT_ERROR_ENDPOINT,
  CLIENT_ERROR_FIELD_CAPS,
  type ClientErrorBoundary,
} from './client-error-payload';

const reported = new WeakSet<object>();

function str(value: unknown, cap: number): string {
  return typeof value === 'string' ? value.slice(0, cap) : '';
}

/** Fire-and-forget send; returns whether this call sent (false for a repeat). Never throws. */
export function sendClientError(error: unknown, boundary: ClientErrorBoundary): boolean {
  try {
    if (error !== null && typeof error === 'object') {
      if (reported.has(error)) return false;
      reported.add(error);
    }
    const e = (error ?? {}) as { name?: unknown; message?: unknown; digest?: unknown };
    const digest = str(e.digest, CLIENT_ERROR_FIELD_CAPS.digest);
    const body = JSON.stringify({
      name: str(e.name, CLIENT_ERROR_FIELD_CAPS.name) || 'Error',
      message: str(e.message, CLIENT_ERROR_FIELD_CAPS.message),
      ...(digest ? { digest } : {}),
      boundary,
      pathname: str(window.location.pathname, CLIENT_ERROR_FIELD_CAPS.pathname) || '/',
    });
    const blob = new Blob([body], { type: 'application/json' });
    if (
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(CLIENT_ERROR_ENDPOINT, blob)
    ) {
      return true;
    }
    void fetch(CLIENT_ERROR_ENDPOINT, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

/** Reports `error` once from an error boundary. */
export function useReportBoundaryError(error: unknown, boundary: ClientErrorBoundary): void {
  useEffect(() => {
    sendClientError(error, boundary);
  }, [error, boundary]);
}
