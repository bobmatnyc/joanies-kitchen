/**
 * #55 S2: request handling for `POST /api/client-error`.
 *
 * Why: client exceptions were invisible; they must reach the same `app-error`
 * line as server errors (D31, and the D85 sink plugs in at `reportError`).
 * What: reads at most `MAX_CLIENT_ERROR_BODY_BYTES`, validates, counts the
 * caller's IP against the `client-error` bucket, then logs one `app-error`
 * line with source `client`. Responses carry fixed bodies and never echo
 * input. It reads no cookies, no user id, and only the IP headers the limiter
 * needs. A limiter outage fails closed with 503.
 * Test: `src/lib/observability/__tests__/client-error-route.test.ts`
 */

import { checkRateLimit, type RateLimitResult, rateLimitKey } from '@/lib/rate-limit';
import { MAX_CLIENT_ERROR_BODY_BYTES, parseClientErrorPayload } from './client-error-payload';
import { reportError } from './report-error';

export interface ClientErrorDeps {
  /** Counts one call for `key`; defaults to the `client-error` bucket in `usage_counters`. */
  limit?: (key: string) => Promise<RateLimitResult>;
}

const TEXT = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };

function fixed(status: number, body: string, extra: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...TEXT, ...extra } });
}

/** Reads the body, aborting once it passes `max` bytes. Null means oversized. */
async function readCapped(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(buf);
}

/**
 * #55 S3: one IPv6 client usually owns a whole /64, so key IPv6 by its /64
 * prefix; otherwise rotating the low 64 bits escapes the limit. IPv4 and the
 * shared unknown key pass through unchanged.
 */
export function clientErrorKey(key: string): string {
  if (!key.startsWith('ip:') || !key.includes(':', 3)) return key;
  const ip = key.slice(3);
  const parts = ip.split('::');
  if (parts.length > 2) return key;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const gap = 8 - left.length - right.length;
  if (parts.length === 2 ? gap < 1 : gap !== 0) return key;
  const groups = [...left, ...Array<string>(Math.max(gap, 0)).fill('0'), ...right];
  if (groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return key;
  return `ip6:${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

export async function handleClientError(
  req: Request,
  deps: ClientErrorDeps = {}
): Promise<Response> {
  try {
    const text = await readCapped(req, MAX_CLIENT_ERROR_BODY_BYTES);
    if (text === null) return fixed(400, 'bad request');
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return fixed(400, 'bad request');
    }
    const payload = parseClientErrorPayload(json);
    if (!payload) return fixed(400, 'bad request');

    const key = clientErrorKey(rateLimitKey(null, req.headers)); // #55: IPv6 by /64
    const verdict = await (deps.limit ?? ((k) => checkRateLimit('client-error', k)))(key);
    if (!verdict.allowed) {
      if (verdict.reason === 'unavailable') return fixed(503, 'unavailable');
      return fixed(429, 'too many requests', { 'Retry-After': String(verdict.retryAfterSec) });
    }

    const error = Object.assign(new Error(payload.message), {
      name: payload.name,
      digest: payload.digest,
    });
    reportError(error, { source: 'client', path: payload.pathname, detail: payload.boundary });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    // #55: fail closed; an unexpected failure never crashes the request.
    return fixed(503, 'unavailable');
  }
}
