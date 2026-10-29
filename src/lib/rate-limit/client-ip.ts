/**
 * #17: client IP from Vercel's proxy headers.
 *
 * Why: the limiter keys anonymous callers by IP; a missing or malformed header
 * must not become a per-request unique key that escapes the limit.
 * What: prefers `x-real-ip`, then the leftmost `x-forwarded-for` entry (Vercel
 * overwrites both at its edge). Anything that is not a plausible IPv4/IPv6
 * literal yields null, which callers map to the shared unknown bucket.
 * Test: `clientIpFrom reads x-real-ip then x-forwarded-for`, `clientIpFrom rejects junk`
 */

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;
const IPV6 = /^[0-9a-f:]{2,39}$/i;

function normalize(raw: string | null | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  if (!value || value.length > 45) return null;
  if (IPV4.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255) ? value : null;
  }
  return value.includes(':') && IPV6.test(value) ? value : null;
}

export function clientIpFrom(headers: Pick<Headers, 'get'>): string | null {
  const real = normalize(headers.get('x-real-ip'));
  if (real) return real;
  return normalize(headers.get('x-forwarded-for')?.split(',')[0]);
}
