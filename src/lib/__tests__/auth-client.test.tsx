/** #22: Clerk-shaped client hooks over Auth.js useSession. */
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock('next-auth/react', () => ({ useSession: mocks.useSession, signIn: vi.fn() }));

import { useAuth, useUser } from '@/lib/auth-client';

beforeEach(() => vi.clearAllMocks());

describe('useAuth / useUser', () => {
  it('reports loading, then signed-out', () => {
    mocks.useSession.mockReturnValue({ data: null, status: 'loading' });
    expect(renderHook(() => useAuth()).result.current).toEqual({
      isLoaded: false,
      isSignedIn: false,
      userId: null,
    });
    mocks.useSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    expect(renderHook(() => useUser()).result.current).toEqual({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });
  });

  it('maps a session user to the Clerk fields the app reads', () => {
    mocks.useSession.mockReturnValue({
      status: 'authenticated',
      data: {
        user: {
          id: 'u1',
          name: 'Ada Lovelace',
          email: 'ada@example.test',
          image: 'i.png',
          isAdmin: true,
        },
      },
    });
    expect(renderHook(() => useAuth()).result.current).toEqual({
      isLoaded: true,
      isSignedIn: true,
      userId: 'u1',
    });
    expect(renderHook(() => useUser()).result.current.user).toMatchObject({
      id: 'u1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      fullName: 'Ada Lovelace',
      imageUrl: 'i.png',
      primaryEmailAddress: { emailAddress: 'ada@example.test' },
      publicMetadata: { isAdmin: 'true' },
    });
  });
});
