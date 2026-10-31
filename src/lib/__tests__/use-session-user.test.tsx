/** #22: useSessionUser reads the signed-in user from Auth.js useSession. */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: mocks.useSession }));

import { useSessionUser } from '@/lib/use-session-user';

const ADA = {
  id: 'u1',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  image: 'i.png',
  isAdmin: false,
};

function session(user: Record<string, unknown>) {
  mocks.useSession.mockReturnValue({ status: 'authenticated', data: { user, expires: 'x' } });
  return renderHook(() => useSessionUser()).result.current;
}

beforeEach(() => vi.clearAllMocks());

describe('useSessionUser', () => {
  it('loading: not loaded, no user', () => {
    mocks.useSession.mockReturnValue({ data: undefined, status: 'loading' });
    expect(renderHook(() => useSessionUser()).result.current).toEqual({
      isLoaded: false,
      user: null,
    });
  });

  it('signed out: loaded, no user', () => {
    mocks.useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    expect(renderHook(() => useSessionUser()).result.current).toEqual({
      isLoaded: true,
      user: null,
    });
  });

  it('signed in: returns the session user as-is', () => {
    expect(session(ADA)).toEqual({ isLoaded: true, user: ADA });
  });

  it('a session user without an id counts as signed out', () => {
    expect(session({ ...ADA, id: undefined })).toEqual({ isLoaded: true, user: null });
    expect(session({ ...ADA, id: '' })).toEqual({ isLoaded: true, user: null });
  });

  it.each([true, false])('isAdmin %s reaches the caller unchanged', (isAdmin) => {
    expect(session({ ...ADA, isAdmin }).user?.isAdmin).toBe(isAdmin);
  });
});
