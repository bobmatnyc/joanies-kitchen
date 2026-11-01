'use client';

import { Heart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
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

interface FavoriteButtonProps {
  recipeId: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function FavoriteButton({
  recipeId,
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
  // #269: toggle flips the server's value, so a click on a heart of unknown state
  // could remove a real favorite. The button stays disabled until the next page.
  const loadFailed = own?.status === 'error';

  const handleToggle = async () => {
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
      <Button variant={variant} size={size} disabled>
        <Heart className="w-5 h-5" />
        {showLabel && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggle}
      disabled={isLoading || loadFailed}
      title={loadFailed ? LOAD_FAILED_MESSAGE : undefined}
      className={favorited ? 'text-red-500 hover:text-red-600' : ''}
    >
      <Heart
        className={`w-5 h-5 transition-all ${
          favorited ? 'fill-current' : ''
        } ${isLoading ? 'animate-pulse' : ''}`}
      />
      {showLabel && <span className="ml-2">{favorited ? 'Favorited' : 'Favorite'}</span>}
    </Button>
  );
}
