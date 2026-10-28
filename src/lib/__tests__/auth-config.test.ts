/** #22: the edge-safe Auth.js config — Google only, JWT sessions, session mapping. */
import type { Session } from 'next-auth';
import { describe, expect, it } from 'vitest';
import { authConfig } from '@/auth.config';

function mapSession(token: Record<string, unknown>) {
  const session = { user: { name: 'A' }, expires: '' } as unknown as Session;
  // biome-ignore lint/suspicious/noExplicitAny: callback params are a wide union in Auth.js types
  return authConfig.callbacks.session({ session, token } as any) as Session;
}

describe('authConfig', () => {
  it('offers Google as the only provider and uses 7-day JWT sessions', () => {
    expect(authConfig.providers.map((p) => (p as unknown as { id: string }).id)).toEqual([
      'google',
    ]);
    expect(authConfig.session).toEqual({ strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 });
  });

  it('exposes the token user id and admin flag on the session', () => {
    expect(mapSession({ sub: 'user_1', isAdmin: true }).user).toMatchObject({
      id: 'user_1',
      isAdmin: true,
    });
  });

  it.each([undefined, false, 'true', 1])('treats token isAdmin %o as not admin', (isAdmin) => {
    expect(mapSession({ sub: 'user_1', isAdmin }).user.isAdmin).toBe(false);
  });
});
