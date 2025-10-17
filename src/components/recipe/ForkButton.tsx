'use client';

import { useAuth } from '@clerk/nextjs';
import { GitFork } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { forkRecipe } from '@/app/actions/social';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ForkButtonProps {
  recipeId: string;
  recipeName: string;
  initialForkCount: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
}

export function ForkButton({
  recipeId,
  recipeName,
  initialForkCount,
  size = 'md',
  showCount = true,
  variant = 'ghost',
}: ForkButtonProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [forkCount, setForkCount] = useState(initialForkCount);

  const handleFork = async () => {
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    startTransition(async () => {
      const result = await forkRecipe(recipeId);

      if (result.success && result.data) {
        toast.success('Recipe forked successfully!', {
          description: `"${recipeName}" has been added to your recipes.`,
          action: {
            label: 'View',
            onClick: () => router.push(`/recipes/${result.data?.id}`),
          },
        });
        setForkCount((prev) => prev + 1);
      } else {
        toast.error('Failed to fork recipe', {
          description: result.error || 'Please try again later.',
        });
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
        isPending && 'opacity-50 cursor-wait'
      )}
      onClick={handleFork}
      disabled={isPending}
      aria-label="Fork this recipe"
    >
      <GitFork className={cn(iconSize)} />
      {showCount && <span className={cn('font-medium', textSize)}>{forkCount}</span>}
    </Button>
  );
}
