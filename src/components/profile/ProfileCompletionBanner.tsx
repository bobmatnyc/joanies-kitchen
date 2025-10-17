'use client';

import { useUser } from '@clerk/nextjs';
import { UserCircle, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * Profile Completion Banner
 *
 * Displays a dismissible banner encouraging users to complete their profile.
 * Shows only when:
 * - User is signed in
 * - User doesn't have a profile yet
 * - User hasn't dismissed the banner (stored in localStorage)
 */
export function ProfileCompletionBanner() {
  const { isSignedIn, isLoaded } = useUser();
  const [isDismissed, setIsDismissed] = useState(true); // Start as dismissed
  const [hasProfile, setHasProfile] = useState(true); // Start as having profile

  useEffect(() => {
    // Only check after auth is loaded
    if (!isLoaded || !isSignedIn) {
      return;
    }

    // Check localStorage for dismissal
    const dismissed = localStorage.getItem('profile-completion-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Check if user has a profile
    async function checkProfile() {
      try {
        const response = await fetch('/api/profile/check');
        const data = await response.json();

        setHasProfile(data.hasProfile);
        setIsDismissed(data.hasProfile); // Auto-dismiss if profile exists
      } catch (error) {
        console.error('Error checking profile:', error);
        setHasProfile(true); // Assume profile exists on error
      }
    }

    checkProfile();
  }, [isLoaded, isSignedIn]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('profile-completion-banner-dismissed', 'true');
  };

  // Don't show if: not loaded, not signed in, dismissed, or has profile
  if (!isLoaded || !isSignedIn || isDismissed || hasProfile) {
    return null;
  }

  return (
    <div className="bg-jk-tomato/10 border-b border-jk-tomato/20">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <UserCircle className="h-5 w-5 text-jk-tomato shrink-0" />
            <p className="text-sm font-ui text-jk-olive">
              <span className="font-semibold">Complete your profile</span> to unlock collections,
              favorites, and share your culinary journey!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link href="/profile/edit">
              <Button
                size="sm"
                className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium"
              >
                Create Profile
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-8 w-8 text-jk-olive hover:text-jk-tomato hover:bg-jk-tomato/10"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
