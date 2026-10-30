/**
 * #154: with the Auth.js env vars missing, /api/auth/* answers without calling
 * Auth.js — signed-out for session reads, 503 for everything else — in preview
 * and production alike.
 */
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ADMIN_SESSION = { user: { id: 'user_1', isAdmin: true }, expires: '2099-01-01' };

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));
vi.mock('@/auth', () => ({ handlers: { GET: mocks.GET, POST: mocks.POST } }));

import { GET, POST } from '../route';

function setEnv(vercelEnv: 'preview' | 'production', configured: boolean) {
  vi.stubEnv('VERCEL_ENV', vercelEnv);
  vi.stubEnv('AUTH_SECRET', configured ? 'test-secret' : '');
  vi.stubEnv('AUTH_GOOGLE_ID', configured ? 'test-id' : '');
  vi.stubEnv('AUTH_GOOGLE_SECRET', configured ? 'test-google-secret' : '');
}

function request(path: string, method: 'GET' | 'POST' = 'GET') {
  return new NextRequest(`https://preview.example.test${path}`, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // Stand-in for a working Auth.js: any call here is a session read.
  mocks.GET.mockResolvedValue(Response.json(ADMIN_SESSION));
  mocks.POST.mockResolvedValue(Response.json({ url: 'https://accounts.google.com/' }));
});

describe('/api/auth/[...nextauth] (#154)', () => {
  it('preview + unconfigured: session GET is signed-out without calling Auth.js', async () => {
    setEnv('preview', false);
    const res = await GET(request('/api/auth/session'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toBeNull();
    expect(mocks.GET).not.toHaveBeenCalled();
  });

  it('preview + configured: session GET is handled by Auth.js', async () => {
    setEnv('preview', true);
    const res = await GET(request('/api/auth/session'));
    await expect(res.json()).resolves.toEqual(ADMIN_SESSION);
    expect(mocks.GET).toHaveBeenCalledTimes(1);
  });

  it('production + unconfigured: fails closed — no session, sign-in refused', async () => {
    setEnv('production', false);

    const session = await GET(request('/api/auth/session'));
    await expect(session.json()).resolves.toBeNull();

    const csrf = await GET(request('/api/auth/csrf'));
    expect(csrf.status).toBe(503);

    const signIn = await POST(request('/api/auth/signin/google', 'POST'));
    expect(signIn.status).toBe(503);
    await expect(signIn.json()).resolves.toEqual({ error: 'Sign-in is not configured' });

    expect(mocks.GET).not.toHaveBeenCalled();
    expect(mocks.POST).not.toHaveBeenCalled();
  });
});
