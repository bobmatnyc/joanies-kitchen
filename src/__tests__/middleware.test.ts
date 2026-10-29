// @vitest-environment node
/**
 * #22: with Auth.js env vars unset, middleware treats every request as
 * anonymous — even when a session would otherwise decode to an admin.
 * `next-auth` is mocked so that its wrapper always attaches a signed-in admin;
 * only the "not configured" branch in src/middleware.ts keeps the request
 * anonymous.
 */
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth', () => ({
  default: () => ({
    auth: (handler: (req: NextRequest & { auth: unknown }) => Response) => (req: NextRequest) =>
      handler(Object.assign(req, { auth: { user: { id: 'u_admin', isAdmin: true } } })),
  }),
}));

import middleware from '@/middleware';

function call(path: string) {
  return middleware(new NextRequest(`http://localhost${path}`), {} as never) as Response;
}

afterEach(() => vi.unstubAllEnvs());

describe('middleware with Auth.js not configured', () => {
  it.each(['AUTH_SECRET', 'AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'])(
    'treats requests as anonymous when %s is unset',
    (name) => {
      vi.stubEnv('AUTH_SECRET', 's');
      vi.stubEnv('AUTH_GOOGLE_ID', 'id');
      vi.stubEnv('AUTH_GOOGLE_SECRET', 'secret');
      vi.stubEnv(name, '');

      const admin = call('/admin');
      expect(admin.status).toBe(307);
      expect(new URL(admin.headers.get('location') ?? '').pathname).toBe('/sign-in');

      const api = call('/api/meal-plans/x');
      expect(api.status).toBe(401);
    }
  );

  it('lets a signed-out visitor reach /recipes but not /recipes/new or /recipes/edit', () => {
    vi.stubEnv('AUTH_SECRET', '');
    expect(call('/recipes').status).toBe(200);
    for (const path of ['/recipes/new', '/recipes/edit/abc']) {
      const res = call(path);
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/sign-in');
    }
  });

  it('uses the session when Auth.js is configured (control)', () => {
    vi.stubEnv('AUTH_SECRET', 's');
    vi.stubEnv('AUTH_GOOGLE_ID', 'id');
    vi.stubEnv('AUTH_GOOGLE_SECRET', 'secret');
    expect(call('/admin').status).toBe(200);
  });
});
