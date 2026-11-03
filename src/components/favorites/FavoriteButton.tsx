'use client';

import { Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { toggleFavorite } from '@/app/actions/favorites';
import {
  ensureFavoriteStateLoaded,
  getFavoriteState,
  getServerFavoriteState,
  setFavoriteState,
  subscribeFavoriteState,
} from '@/components/favorites/favorite-state';
import { Button } from '@/components/ui/button';
import { useSessionUser } from '@/lib/use-session-user';

const LOAD_FAILED_MESSAGE = "Couldn't load your favorites. Reload the page to try again.";
const NO_USER_MESSAGE = 'Sign in to save favorites. If you are signed in, reload the page.';

interface FavoriteButtonProps {
  recipeId: string;
  /** #277: recipe title, used in the accessible name. */
  recipeName?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function FavoriteButton({
  recipeId,
  recipeName,
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
}: FavoriteButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, user } = useSessionUser();
  const userId = user?.id ?? null;
  const [isLoading, setIsLoading] = useState(false);

  // #269: all buttons share one load per page; a signed-out visitor never loads.
  useEffect(() => {
    if (userId) ensureFavoriteStateLoaded(userId, pathname);
  }, [userId, pathname]);

  const shared = useSyncExternalStore(
    subscribeFavoriteState,
    getFavoriteState,
    getServerFavoriteState
  );
  // #269: state held for another user, or none yet, must not show on this button.
  const own = userId !== null && shared.userId === userId ? shared : null;
  const favorited = own?.ids.has(recipeId) ?? false;
  const isChecking = !isLoaded || (userId !== null && (!own || own.status === 'loading'));
  const loadFailed = own?.status === 'error';
  // #269: toggle flips the server's value, so a click on a heart of unknown state
  // could remove a real favorite. A failed session fetch also reads as "no user"
  // while the cookie stays valid, so no known user blocks the toggle too.
  const blockedMessage =
    userId === null ? NO_USER_MESSAGE : loadFailed ? LOAD_FAILED_MESSAGE : null;

  // #277: the icon-only heart had no accessible name or pressed state.
  const subject = recipeName?.trim() || 'recipe';
  const accessibleName = favorited
    ? `Remove ${subject} from favorites`
    : `Save ${subject} to favorites`;

  const handleToggle = async () => {
    if (blockedMessage) {
      toast.error(blockedMessage);
      return;
    }

    setIsLoading(true);

    try {
      const result = await toggleFavorite(recipeId);

      if (result.success) {
        const isFavoritedNow = 'isFavorited' in result ? result.isFavorited : !favorited;
        // #269: written to the shared state so other copies of this recipe follow.
        if (userId) setFavoriteState(userId, recipeId, isFavoritedNow ?? !favorited);
        router.refresh();
      } else {
        const errorMsg = 'error' in result ? result.error : 'Failed to toggle favorite';
        console.error('Failed to toggle favorite:', errorMsg);
        // Optionally show error toast
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <Button
        variant={variant}
        size={size}
        disabled
        aria-label={`Loading favorite status for ${subject}`}
      >
        <Heart className="w-5 h-5" aria-hidden="true" />
        {showLabel && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isLoading}
      // #269: aria-disabled, not disabled: ui/button gives disabled pointer-events-none,
      // which hides the title and lets a click through to the card link.
      aria-disabled={blockedMessage !== null}
      aria-label={accessibleName}
      aria-pressed={favorited}
      title={blockedMessage ?? undefined}
      className={
        favorited
          ? 'text-red-500 hover:text-red-600'
          : loadFailed
            ? 'opacity-50 cursor-not-allowed'
            : ''
      }
    >
      <Heart
        aria-hidden="true"
        className={`w-5 h-5 transition-all ${
          favorited ? 'fill-current' : ''
        } ${isLoading ? 'animate-pulse' : ''}`}
      />
      {showLabel && <span className="ml-2">{favorited ? 'Favorited' : 'Favorite'}</span>}
    </Button>
  );
}
