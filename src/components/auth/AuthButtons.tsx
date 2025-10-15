'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogIn, Shield } from 'lucide-react';
import { useUser, UserButton, SignInButton } from '@clerk/nextjs';

// Check if Clerk is properly configured
const isClerkConfigured =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'YOUR_PUBLISHABLE_KEY' &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== '';

// Component to show when Clerk is not configured (development mode)
function DevelopmentAuthButtons() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/sign-in">
        <Button variant="ghost" size="sm">
          <LogIn className="h-4 w-4 mr-2" />
          Sign In
        </Button>
      </Link>
    </div>
  );
}

// Component that uses Clerk hooks
function ClerkAuthButtons() {
  const { isSignedIn, isLoaded, user } = useUser();
  const router = useRouter();

  // Show loading state while auth status is being determined
  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-16 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  // Show UserButton if signed in
  if (isSignedIn) {
    // Check if user is an admin
    const isAdmin = user?.publicMetadata?.isAdmin === 'true';

    return (
      <div className="flex items-center gap-2">
        <UserButton
          appearance={{
            elements: {
              rootBox: 'flex items-center',
              avatarBox: 'h-8 w-8',
              userButtonPopoverCard: 'shadow-lg border',
              userButtonPopoverActions: 'space-y-1',
            },
          }}
          userProfileMode="navigation"
          userProfileUrl="/user-profile"
          afterSignOutUrl="/"
        >
          {isAdmin && (
            <UserButton.MenuItems>
              <UserButton.Action
                label="Admin Dashboard"
                labelIcon={<Shield className="h-4 w-4" />}
                onClick={() => router.push('/admin')}
              />
            </UserButton.MenuItems>
          )}
        </UserButton>
      </div>
    );
  }

  // Show Sign In button if not signed in
  return (
    <div className="flex items-center gap-2">
      <SignInButton mode="modal" forceRedirectUrl="/">
        <Button variant="ghost" size="sm">
          <LogIn className="h-4 w-4 mr-2" />
          Sign In
        </Button>
      </SignInButton>
    </div>
  );
}

export function AuthButtons() {
  // If Clerk is not configured, show development buttons
  if (!isClerkConfigured) {
    return <DevelopmentAuthButtons />;
  }

  // Use Clerk components when configured
  return <ClerkAuthButtons />;
}