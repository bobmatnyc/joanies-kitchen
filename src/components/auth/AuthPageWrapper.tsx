'use client';

import { SignIn, SignUp, UserProfile } from '@clerk/nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';

// Check if Clerk keys are configured
const isClerkConfigured =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'YOUR_PUBLISHABLE_KEY' &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== '';

interface AuthPageWrapperProps {
  children: ReactNode;
  type: 'sign-in' | 'sign-up';
}

export function AuthPageWrapper({ children, type }: AuthPageWrapperProps) {
  if (!isClerkConfigured) {
    // Show a message when Clerk is not configured
    return (
      <div className="flex min-h-screen items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Authentication Not Configured</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              Clerk authentication is not configured for this application.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              To enable authentication, please add your Clerk keys to the environment variables.
            </p>
            <div className="mt-8">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the auth component when Clerk is configured
  return <>{children}</>;
}

// Client component wrapper for SignIn
export function SignInWrapper() {
  if (!isClerkConfigured) {
    return null; // AuthPageWrapper will handle this
  }

  return (
    <SignIn
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'shadow-none',
        },
      }}
      path="/sign-in"
      routing="path"
      signUpUrl="/sign-up"
      forceRedirectUrl="/"
    />
  );
}

// Client component wrapper for SignUp
export function SignUpWrapper() {
  if (!isClerkConfigured) {
    return null; // AuthPageWrapper will handle this
  }

  return (
    <SignUp
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'shadow-none',
        },
      }}
      path="/sign-up"
      routing="path"
      signInUrl="/sign-in"
      forceRedirectUrl="/"
    />
  );
}

// Client component wrapper for UserProfile
export function UserProfilePageWrapper() {
  if (!isClerkConfigured) {
    // Show a message when Clerk is not configured
    return (
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          User profile management is not available in development mode.
        </p>
        <div className="mt-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <UserProfile
      appearance={{
        elements: {
          rootBox: 'mx-auto',
          card: 'shadow-none border rounded-lg',
        },
      }}
      path="/user-profile"
      routing="path"
    />
  );
}
