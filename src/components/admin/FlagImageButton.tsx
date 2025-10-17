'use client';

import { Flag, FlagOff } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { flagRecipeImageForRegeneration, unflagRecipeImage } from '@/app/actions/admin-recipes';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface FlagImageButtonProps {
  recipeId: string;
  recipeName: string;
  isFlagged?: boolean;
  onFlagChange?: (flagged: boolean) => void;
}

/**
 * Admin-only button for flagging recipe images for AI regeneration
 * Client-side component for better caching of public recipe pages
 */
export function FlagImageButton({
  recipeId,
  recipeName,
  isFlagged = false,
  onFlagChange,
}: FlagImageButtonProps) {
  const [flagged, setFlagged] = useState(isFlagged);
  const [loading, setLoading] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showUnflagDialog, setShowUnflagDialog] = useState(false);

  const handleFlag = async () => {
    try {
      setLoading(true);
      const result = await flagRecipeImageForRegeneration(recipeId);

      if (result.success) {
        setFlagged(true);
        onFlagChange?.(true);
        toast.success('Recipe image flagged for regeneration');
      } else {
        toast.error(result.error || 'Failed to flag image');
      }
    } catch (error) {
      console.error('Error flagging image:', error);
      toast.error('Failed to flag image');
    } finally {
      setLoading(false);
      setShowFlagDialog(false);
    }
  };

  const handleUnflag = async () => {
    try {
      setLoading(true);
      const result = await unflagRecipeImage(recipeId);

      if (result.success) {
        setFlagged(false);
        onFlagChange?.(false);
        toast.success('Recipe image flag removed');
      } else {
        toast.error(result.error || 'Failed to remove flag');
      }
    } catch (error) {
      console.error('Error unflagging image:', error);
      toast.error('Failed to remove flag');
    } finally {
      setLoading(false);
      setShowUnflagDialog(false);
    }
  };

  if (flagged) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowUnflagDialog(true)}
          disabled={loading}
          className="flex items-center gap-2 border-orange-500 text-orange-600 hover:bg-orange-50"
        >
          <FlagOff className="h-4 w-4" />
          Remove Flag
        </Button>

        <AlertDialog open={showUnflagDialog} onOpenChange={setShowUnflagDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Image Flag?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the regeneration flag from "{recipeName}". The current image will
                be kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleUnflag} disabled={loading}>
                {loading ? 'Removing...' : 'Remove Flag'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowFlagDialog(true)}
        disabled={loading}
        className="flex items-center gap-2"
      >
        <Flag className="h-4 w-4" />
        Flag for Regeneration
      </Button>

      <AlertDialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flag Image for Regeneration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the image for "{recipeName}" to be regenerated with AI. The current
              image will be replaced when regeneration occurs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFlag} disabled={loading}>
              {loading ? 'Flagging...' : 'Flag Image'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
