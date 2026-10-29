/**
 * #22: a signed-in visitor must not start a second Google sign-in, because
 * Auth.js would link the new Google account to the current user.
 */
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock('@/lib/auth', () => ({ auth: mocks.auth }));
vi.mock('@/auth', () => ({ signIn: mocks.signIn }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import SignInPage from '@/app/sign-in/[[...sign-in]]/page';

const SIGNED_OUT = { userId: null };
const SIGNED_IN = { userId: 'user_a' };

function render(callbackUrl?: string) {
  return SignInPage({ searchParams: Promise.resolve(callbackUrl ? { callbackUrl } : {}) });
}

/** Depth-first search of the returned element tree for the <form>. */
function findFormAction(node: ReactNode): (() => Promise<void>) | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findFormAction(child);
      if (found) return found;
    }
    return null;
  }
  const el = node as ReactElement<{ action?: () => Promise<void>; children?: ReactNode }>;
  if (el.type === 'form' && el.props.action) return el.props.action;
  return findFormAction(el.props?.children);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('AUTH_SECRET', 's');
  vi.stubEnv('AUTH_GOOGLE_ID', 'id');
  vi.stubEnv('AUTH_GOOGLE_SECRET', 'secret');
});

describe('SignInPage', () => {
  it('redirects a signed-in visitor to the safe callback path instead of offering sign-in', async () => {
    mocks.auth.mockResolvedValue(SIGNED_IN);
    await expect(render('/favorites')).rejects.toThrow('NEXT_REDIRECT:/favorites');
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('never redirects a signed-in visitor off-site', async () => {
    mocks.auth.mockResolvedValue(SIGNED_IN);
    await expect(render('//evil.example')).rejects.toThrow('NEXT_REDIRECT:/');
  });

  it('refuses to start Google sign-in if the visitor signed in after the page loaded', async () => {
    mocks.auth.mockResolvedValue(SIGNED_OUT);
    const action = findFormAction(await render('/favorites'));
    expect(action).not.toBeNull();
    mocks.auth.mockResolvedValue(SIGNED_IN);
    await expect(action?.()).rejects.toThrow('NEXT_REDIRECT:/favorites');
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it('links the Terms and Privacy Policy next to the Google button', async () => {
    mocks.auth.mockResolvedValue(SIGNED_OUT);
    const { renderToStaticMarkup } = await import('react-dom/server');
    const html = renderToStaticMarkup(await render('/favorites'));
    expect(html).toContain('By continuing you agree to the');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
  });

  it('starts Google sign-in for a signed-out visitor', async () => {
    mocks.auth.mockResolvedValue(SIGNED_OUT);
    const action = findFormAction(await render('/favorites'));
    await action?.();
    expect(mocks.signIn).toHaveBeenCalledWith('google', { redirectTo: '/favorites' });
  });
});

describe('SignInPage local-staging bypass (#60 D5f)', () => {
  const EMAIL = 'staging@example.test';
  function stubBypass(extra: Record<string, string | undefined> = {}) {
    vi.stubEnv('LOCAL_STAGING_AUTH_BYPASS', '1');
    vi.stubEnv('LOCAL_STAGING_AUTH_EMAIL', EMAIL);
    vi.stubEnv('DATABASE_URL', 'postgres://u@127.0.0.1:5432/db');
    for (const k of ['VERCEL', 'VERCEL_ENV', 'VERCEL_URL']) vi.stubEnv(k, undefined);
    for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
  }
  async function html() {
    const { renderToStaticMarkup } = await import('react-dom/server');
    return renderToStaticMarkup(await render('/favorites'));
  }

  it('shows no bypass marker or button when a Vercel marker is present', async () => {
    mocks.auth.mockResolvedValue(SIGNED_OUT);
    stubBypass({ VERCEL: '1' });
    const out = await html();
    expect(out).not.toContain('LOCAL STAGING');
    expect(out).not.toContain('local-staging-bypass');
    expect(out.match(/<form/g)).toHaveLength(1);
  });

  it('shows the marker without the email and signs in through the bypass provider', async () => {
    mocks.auth.mockResolvedValue(SIGNED_OUT);
    stubBypass({ AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '' });
    const out = await html();
    expect(out).toContain('LOCAL STAGING AUTH BYPASS ACTIVE');
    expect(out).not.toContain(EMAIL);
    expect(out).not.toContain('Continue with Google');
    expect(out).not.toContain('Sign-in is not configured');
    await findFormAction(await render('/favorites'))?.();
    expect(mocks.signIn).toHaveBeenCalledWith('local-staging', { redirectTo: '/favorites' });
  });
});
