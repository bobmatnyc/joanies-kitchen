'use client';

import { Flag } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasUserFlagged } from '@/app/actions/flag-recipe';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FlagDialog } from './FlagDialog';

interface FlagButtonProps {
  recipeId: string;
  recipeName: string;
  variant?: 'ghost' | 'outline';
  size?: 'sm' | 'default';
}

/**
 * Safe Clerk user hook that handles the case where Clerk is not available
 * This MUST be called unconditionally to satisfy React's Rules of Hooks
 */
function useSafeClerkUser() {
  try {
    const { useUser } = require('@clerk/nextjs');
    return useUser();
  } catch (_error) {
    // Clerk not available - return default values
    return { user: null, isSignedIn: false, isLoaded: true };
  }
}

export function FlagButton({
  recipeId,
  recipeName,
  variant = 'ghost',
  size = 'sm',
}: FlagButtonProps) {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useSafeClerkUser();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [alreadyFlagged, setAlreadyFlagged] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if user has already flagged this recipe
  useEffect(() => {
    const checkFlagStatus = async () => {
      if (!isLoaded) return;

      if (!isSignedIn) {
        setIsChecking(false);
        return;
      }

      const hasFlagged = await hasUserFlagged(recipeId);
      setAlreadyFlagged(hasFlagged);
      setIsChecking(false);
    };

    checkFlagStatus();
  }, [recipeId, isSignedIn, isLoaded]);

  const handleClick = () => {
    if (!isSignedIn) {
      // Redirect to sign-in page
      router.push('/sign-in?redirect=/recipes/' + recipeId);
      return;
    }

    if (alreadyFlagged) {
      return; // Button should be disabled, but just in case
    }

    setIsDialogOpen(true);
  };

  // Show loading state while checking
  if (isChecking) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant={variant} size={size === 'sm' ? 'icon' : 'default'} disabled>
              <Flag className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Loading...</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const tooltipText = !isSignedIn
    ? 'Sign in to report this recipe'
    : alreadyFlagged
      ? "You've already reported this recipe"
      : 'Report this recipe';

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={size === 'sm' ? 'icon' : 'default'}
              onClick={handleClick}
              disabled={alreadyFlagged}
              className="min-h-[44px] min-w-[44px]"
              aria-label={tooltipText}
            >
              <Flag className={`w-4 h-4 ${size === 'default' ? 'sm:mr-2' : ''}`} />
              {size === 'default' && <span className="hidden sm:inline">Report</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Flag Dialog */}
      <FlagDialog
        recipeId={recipeId}
        recipeName={recipeName}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
