'use client';

import { Flag, FlagOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { flagRecipeImageForRegeneration, unflagRecipeImage } from '@/app/actions/admin-recipes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RecipeImageFlagProps {
  recipeId: string;
  isFlagged: boolean | null;
  isAdmin: boolean;
}

export function RecipeImageFlag({ recipeId, isFlagged, isAdmin }: RecipeImageFlagProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Don't render if not admin
  if (!isAdmin) {
    return null;
  }

  const handleFlag = () => {
    if (isFlagged) {
      // If already flagged, unflag directly without confirmation
      startTransition(async () => {
        const result = await unflagRecipeImage(recipeId);
        if (result.success) {
          router.refresh();
        }
      });
    } else {
      // Show confirmation dialog for flagging
      setIsDialogOpen(true);
    }
  };

  const confirmFlag = () => {
    startTransition(async () => {
      const result = await flagRecipeImageForRegeneration(recipeId);
      if (result.success) {
        setIsDialogOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <>
      <Button
        variant={isFlagged ? 'destructive' : 'outline'}
        size="sm"
        onClick={handleFlag}
        disabled={isPending}
        className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white backdrop-blur-sm shadow-sm"
        title={isFlagged ? 'Unflag image' : 'Flag this image for AI regeneration'}
      >
        {isFlagged ? (
          <>
            <FlagOff className="w-4 h-4 mr-1" />
            Unflag
          </>
        ) : (
          <>
            <Flag className="w-4 h-4 mr-1" />
            Flag Image
          </>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Image for Regeneration?</DialogTitle>
            <DialogDescription>
              This will mark the recipe image for AI regeneration. The image will be added to the
              flagged images queue in the admin dashboard where you can regenerate it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmFlag} disabled={isPending}>
              {isPending ? 'Flagging...' : 'Flag Image'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isFlagged && (
        <div className="absolute top-12 right-2 z-10 bg-orange-500 text-white text-xs px-2 py-1 rounded shadow-sm">
          Flagged for regeneration
        </div>
      )}
    </>
  );
}
