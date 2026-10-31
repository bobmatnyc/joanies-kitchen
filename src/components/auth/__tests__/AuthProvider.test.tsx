/**
 * #154: AuthProvider, fed `isAuthConfigured()` the way the root layout feeds it,
 * renders signed-out with no `/api/auth/session` fetch when Auth.js is not
 * configured, and mounts the real SessionProvider when it is.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { isAuthConfigured } from '@/lib/auth-env';
import { useSessionUser } from '@/lib/use-session-user';

const fetchMock = vi.fn();

function Probe() {
  const { isLoaded, user } = useSessionUser();
  if (!isLoaded) return <p>loading</p>;
  return <p>{user ? `signed-in:${user.id}` : 'signed-out'}</p>;
}

function setEnv(vercelEnv: 'preview' | 'production', configured: boolean) {
  vi.stubEnv('VERCEL_ENV', vercelEnv);
  vi.stubEnv('AUTH_SECRET', configured ? 'test-secret' : '');
  vi.stubEnv('AUTH_GOOGLE_ID', configured ? 'test-id' : '');
  vi.stubEnv('AUTH_GOOGLE_SECRET', configured ? 'test-google-secret' : '');
}

function sessionFetches() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/auth/session'));
}

beforeEach(() => {
  fetchMock.mockReset();
  // A fresh Response per call: a body can be read only once.
  fetchMock.mockImplementation(async () =>
    Response.json({ user: { id: 'user_1' }, expires: '2099-01-01' })
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('AuthProvider (#154)', () => {
  it('preview + unconfigured: renders signed-out without fetching the session', async () => {
    setEnv('preview', false);
    render(
      <AuthProvider enabled={isAuthConfigured()}>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByText('signed-out')).toBeInTheDocument();
    // Let any mount effect run before asserting no request went out.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sessionFetches()).toHaveLength(0);
  });

  it('preview + configured: reads the session from /api/auth/session', async () => {
    setEnv('preview', true);
    render(
      <AuthProvider enabled={isAuthConfigured()}>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('signed-in:user_1')).toBeInTheDocument());
    expect(sessionFetches().length).toBeGreaterThan(0);
  });
});
