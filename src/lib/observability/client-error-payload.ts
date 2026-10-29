/**
 * #55 S2: the wire format error boundaries send to `POST /api/client-error`.
 *
 * Why: the browser and the route must agree on one small, capped payload so
 * the route can reject anything else without reading it twice.
 * What: field caps, the boundary allowlist, and `parseClientErrorPayload`,
 * which returns the validated payload or null. Unknown keys are rejected.
 * Test: `src/lib/observability/__tests__/client-error-route.test.ts`
 */

export const CLIENT_ERROR_ENDPOINT = '/api/client-error';
export const MAX_CLIENT_ERROR_BODY_BYTES = 2048;

export const CLIENT_ERROR_FIELD_CAPS = {
  name: 100,
  message: 1000,
  digest: 100,
  pathname: 300,
} as const;

/** Every error boundary that reports; the route rejects any other value. */
export const CLIENT_ERROR_BOUNDARIES = [
  'root',
  'global',
  'meals',
  'meals-new',
  'meals-detail',
] as const;

export type ClientErrorBoundary = (typeof CLIENT_ERROR_BOUNDARIES)[number];

export interface ClientErrorPayload {
  name: string;
  message: string;
  digest?: string;
  boundary: ClientErrorBoundary;
  pathname: string;
}

const ALLOWED_KEYS = new Set(['name', 'message', 'digest', 'boundary', 'pathname']);

function cappedString(value: unknown, cap: number): value is string {
  return typeof value === 'string' && value.length <= cap;
}

/** Validated payload, or null for anything malformed or over a field cap. */
export function parseClientErrorPayload(input: unknown): ClientErrorPayload | null {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) return null;
  const obj = input as Record<string, unknown>;
  if (Object.keys(obj).some((key) => !ALLOWED_KEYS.has(key))) return null;
  const { name, message, digest, boundary, pathname } = obj;
  if (!cappedString(name, CLIENT_ERROR_FIELD_CAPS.name)) return null;
  if (!cappedString(message, CLIENT_ERROR_FIELD_CAPS.message)) return null;
  if (digest !== undefined && !cappedString(digest, CLIENT_ERROR_FIELD_CAPS.digest)) return null;
  if (!CLIENT_ERROR_BOUNDARIES.includes(boundary as ClientErrorBoundary)) return null;
  if (!cappedString(pathname, CLIENT_ERROR_FIELD_CAPS.pathname) || !pathname.startsWith('/')) {
    return null;
  }
  return {
    name,
    message,
    digest: digest as string | undefined,
    boundary: boundary as ClientErrorBoundary,
    pathname,
  };
}
