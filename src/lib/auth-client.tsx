'use client';

import { signIn, useSession } from 'next-auth/react';
import { cloneElement, isValidElement, type MouseEvent, type ReactElement } from 'react';

/**
 * Clerk-shaped client hooks over Auth.js `useSession` — #22.
 *
 * Why: 15 client components used Clerk's `useAuth`/`useUser`/`SignInButton`;
 * this adapter lets them switch by changing only their import line (issue
 * #22 §8). A follow-up PR replaces it with direct `useSession` calls.
 * What: `useAuth()` → `{ isLoaded, isSignedIn, userId }`; `useUser()` →
 * `{ isLoaded, isSignedIn, user }` where `user` has the Clerk fields the app
 * reads (`id`, `firstName`, `fullName`, `imageUrl`, `primaryEmailAddress`,
 * `publicMetadata.isAdmin`). `isAdmin` is the JWT copy — a UI hint only.
 * Requires `<AuthProvider>` (SessionProvider) above it.
 * Test: `src/lib/__tests__/auth-client.test.tsx`
 */

export interface ClientUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: null;
  imageUrl: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  publicMetadata: { isAdmin: 'true' | 'false' };
}

export function useAuth(): { isLoaded: boolean; isSignedIn: boolean; userId: string | null } {
  const { data, status } = useSession();
  const userId = data?.user?.id ?? null;
  return { isLoaded: status !== 'loading', isSignedIn: userId !== null, userId };
}

export function useUser(): { isLoaded: boolean; isSignedIn: boolean; user: ClientUser | null } {
  const { data, status } = useSession();
  const sessionUser = data?.user;
  if (!sessionUser?.id) {
    return { isLoaded: status !== 'loading', isSignedIn: false, user: null };
  }
  const fullName = sessionUser.name ?? null;
  const [firstName, ...rest] = fullName ? fullName.split(' ') : [];
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: sessionUser.id,
      firstName: firstName ?? null,
      lastName: rest.length > 0 ? rest.join(' ') : null,
      fullName,
      username: null,
      imageUrl: sessionUser.image ?? null,
      primaryEmailAddress: sessionUser.email ? { emailAddress: sessionUser.email } : null,
      publicMetadata: { isAdmin: sessionUser.isAdmin === true ? 'true' : 'false' },
    },
  };
}

/**
 * Replaces Clerk's `SignInButton`: adds an onClick to its single child (a
 * button) that starts Google sign-in and returns to the current page.
 */
export function SignInButton({
  children,
}: {
  children: ReactElement<{ onClick?: (e: MouseEvent) => void }>;
  mode?: string;
}) {
  if (!isValidElement(children)) return children;
  return cloneElement(children, {
    onClick: () => {
      void signIn('google', { callbackUrl: window.location.href });
    },
  });
}
