'use client';

import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isFavorited, toggleFavorite } from '@/app/actions/favorites';
import { Button } from '@/components/ui/button';

interface FavoriteButtonProps {
  recipeId: string;
  initialIsFavorited?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

export function FavoriteButton({
  recipeId,
  initialIsFavorited = false,
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialIsFavorited);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check favorite status on mount
  useEffect(() => {
    const checkStatus = async () => {
      const status = await isFavorited(recipeId);
      setFavorited(status);
      setIsChecking(false);
    };

    checkStatus();
  }, [recipeId]);

  const handleToggle = async () => {
    setIsLoading(true);

    try {
      const result = await toggleFavorite(recipeId);

      if (result.success) {
        const isFavoritedNow = 'isFavorited' in result ? result.isFavorited : !favorited;
        setFavorited(isFavoritedNow ?? !favorited);
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
      disabled={isLoading}
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
