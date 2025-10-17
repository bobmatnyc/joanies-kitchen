'use client';

import { useAuth } from '@clerk/nextjs';
import { ThumbsUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toggleRecipeLike } from '@/app/actions/social';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  recipeId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
}

export function LikeButton({
  recipeId,
  initialLiked,
  initialCount,
  size = 'md',
  showCount = true,
  variant = 'ghost',
}: LikeButtonProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Optimistic state
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialCount);

  const handleLike = async () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    // Optimistic update
    const newLikedState = !isLiked;
    const newCount = newLikedState ? likesCount + 1 : likesCount - 1;

    setIsLiked(newLikedState);
    setLikesCount(newCount);

    // Server update
    startTransition(async () => {
      const result = await toggleRecipeLike(recipeId);

      if (result.success) {
        // Update with actual server data
        setIsLiked(result.liked || false);
        setLikesCount(result.likesCount || 0);
      } else {
        // Revert on error
        setIsLiked(initialLiked);
        setLikesCount(initialCount);
        console.error('Failed to toggle like:', result.error);
      }
    });
  };

  const buttonSize = size === 'sm' ? 'h-8 px-2' : size === 'lg' ? 'h-12 px-4' : 'h-10 px-3';
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';

  return (
    <Button
      variant={variant}
      size="sm"
      className={cn(
        'gap-2 transition-all duration-200',
        buttonSize,
        isLiked && 'text-jk-tomato hover:text-jk-tomato/80',
        isPending && 'opacity-50 cursor-wait'
      )}
      onClick={handleLike}
      disabled={isPending}
      aria-label={isLiked ? 'Unlike recipe' : 'Like recipe'}
    >
      <ThumbsUp
        className={cn(iconSize, 'transition-all duration-200', isLiked && 'fill-current')}
      />
      {showCount && <span className={cn('font-medium', textSize)}>{likesCount}</span>}
    </Button>
  );
}
