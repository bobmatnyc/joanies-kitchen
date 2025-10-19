'use client';

import { useState } from 'react';
import { Edit3, FileEdit, Flag, MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import {
  flagImageForRegeneration,
  flagContentForCleanup,
  softDeleteRecipe,
} from '@/app/actions/admin-content';
import { useAdminEditMode } from './AdminEditMode';

interface AdminContentActionsProps {
  recipeId: string;
  recipeName: string;
}

/**
 * Admin Content Actions Menu
 *
 * Provides admin-only actions for recipe content management:
 * - Toggle Edit Mode (enables inline editing overlays)
 * - Flag image for regeneration
 * - Flag ingredients for cleanup
 * - Flag instructions for cleanup
 * - Soft delete recipe
 *
 * Only visible to admin users.
 */
export function AdminContentActions({ recipeId, recipeName }: AdminContentActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const { editMode, toggleEditMode } = useAdminEditMode();

  const handleFlagImage = async () => {
    setLoading(true);
    const result = await flagImageForRegeneration(recipeId);
    setLoading(false);
    setOpen(false);

    if (result.success) {
      toast.success(result.message || 'Image flagged for regeneration');
    } else {
      toast.error(result.error || 'Failed to flag image');
    }
  };

  const handleFlagContent = async (type: 'ingredients' | 'instructions' | 'both') => {
    setLoading(true);
    const result = await flagContentForCleanup(recipeId, type);
    setLoading(false);
    setOpen(false);

    if (result.success) {
      toast.success(result.message || `Content flagged for cleanup`);
    } else {
      toast.error(result.error || 'Failed to flag content');
    }
  };

  const handleSoftDelete = async () => {
    setLoading(true);
    const result = await softDeleteRecipe(recipeId);
    setLoading(false);
    setShowDeleteDialog(false);

    if (result.success) {
      toast.success(result.message || 'Recipe soft deleted');
      // Redirect to recipes page after deletion
      setTimeout(() => {
        window.location.href = '/recipes';
      }, 1000);
    } else {
      toast.error(result.error || 'Failed to delete recipe');
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label="Admin actions"
            className="min-h-[44px] min-w-[44px]"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="end">
          <div className="flex flex-col gap-1">
            {/* Edit Mode Toggle */}
            <Button
              variant={editMode ? "secondary" : "ghost"}
              onClick={() => {
                toggleEditMode();
                setOpen(false);
              }}
              className="justify-start"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              {editMode ? 'Exit Edit Mode' : 'Enable Edit Mode'}
            </Button>

            <div className="h-px bg-border my-1" />

            <Button
              variant="ghost"
              onClick={handleFlagImage}
              disabled={loading}
              className="justify-start"
            >
              <Flag className="w-4 h-4 mr-2" />
              Flag Image for Regeneration
            </Button>

            <Button
              variant="ghost"
              onClick={() => handleFlagContent('ingredients')}
              disabled={loading}
              className="justify-start"
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Flag Ingredients for Cleanup
            </Button>

            <Button
              variant="ghost"
              onClick={() => handleFlagContent('instructions')}
              disabled={loading}
              className="justify-start"
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Flag Instructions for Cleanup
            </Button>

            <Button
              variant="ghost"
              onClick={() => handleFlagContent('both')}
              disabled={loading}
              className="justify-start"
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Flag Both for Cleanup
            </Button>

            <div className="h-px bg-border my-1" />

            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setShowDeleteDialog(true);
              }}
              disabled={loading}
              className="justify-start text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Soft Delete Recipe
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soft Delete Recipe</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide <strong>&quot;{recipeName}&quot;</strong> from all views but keep it in the
              database. It can be restored later by admin.
              <br />
              <br />
              This action does NOT permanently delete the recipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSoftDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Deleting...' : 'Soft Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
