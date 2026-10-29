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
  MAX_CLIENT_ERROR_BODY_BYTES,
} from './client-error-payload';

const reported = new WeakSet<object>();

/** #55 S3: the server keeps 300 chars of message, so the client sends no more. */
export const CLIENT_MESSAGE_CHARS = 300;

function str(value: unknown, cap: number): string {
  return typeof value === 'string' ? value.slice(0, cap) : '';
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * #55 S3: JSON body within the server's byte cap. Characters are not bytes, so
 * the message (then the name) is shortened until the encoded body fits.
 */
export function buildClientErrorBody(error: unknown, boundary: ClientErrorBoundary): string {
  const e = (error ?? {}) as { name?: unknown; message?: unknown; digest?: unknown };
  const digest = str(e.digest, CLIENT_ERROR_FIELD_CAPS.digest);
  let name = str(e.name, CLIENT_ERROR_FIELD_CAPS.name) || 'Error';
  let message = str(e.message, CLIENT_MESSAGE_CHARS);
  const pathname = str(window.location.pathname, CLIENT_ERROR_FIELD_CAPS.pathname) || '/';
  const encode = () =>
    JSON.stringify({ name, message, ...(digest ? { digest } : {}), boundary, pathname });
  let body = encode();
  while (byteLength(body) > MAX_CLIENT_ERROR_BODY_BYTES && message.length > 0) {
    message = message.slice(0, Math.floor(message.length / 2));
    body = encode();
  }
  if (byteLength(body) > MAX_CLIENT_ERROR_BODY_BYTES) {
    name = 'Error';
    body = encode();
  }
  return body;
}

/** Fire-and-forget send; returns whether this call sent (false for a repeat). Never throws. */
export function sendClientError(error: unknown, boundary: ClientErrorBoundary): boolean {
  try {
    const key = error !== null && typeof error === 'object' ? error : null;
    if (key && reported.has(key)) return false;
    const body = buildClientErrorBody(error, boundary);
    let sent = false;
    try {
      sent =
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(CLIENT_ERROR_ENDPOINT, new Blob([body], { type: 'application/json' }));
    } catch {
      // #55: a throwing sendBeacon falls through to fetch keepalive.
      sent = false;
    }
    if (!sent) {
      void fetch(CLIENT_ERROR_ENDPOINT, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined);
    }
    // #55: mark only once a send attempt went out, so a failed attempt can retry.
    if (key) reported.add(key);
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
