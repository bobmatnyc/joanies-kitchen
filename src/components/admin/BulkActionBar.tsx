'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
import { adminBulkTogglePublic, adminBulkDeleteRecipes } from '@/app/actions/admin';
import { toast } from 'sonner';

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  onClearSelection: () => void;
  onSuccess: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  onClearSelection,
  onSuccess,
}: BulkActionBarProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleBulkPublish = async () => {
    setIsProcessing(true);
    try {
      const result = await adminBulkTogglePublic(selectedIds, true);

      if (result.success && result.data) {
        toast.success(`${result.data.updated} recipes published successfully`);
        onSuccess();
        router.refresh(); // Refresh server component data
      } else {
        toast.error(result.error || 'Failed to publish recipes');
      }
    } catch (error) {
      toast.error('Failed to publish recipes');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkUnpublish = async () => {
    setIsProcessing(true);
    try {
      const result = await adminBulkTogglePublic(selectedIds, false);

      if (result.success && result.data) {
        toast.success(`${result.data.updated} recipes unpublished successfully`);
        onSuccess();
        router.refresh(); // Refresh server component data
      } else {
        toast.error(result.error || 'Failed to unpublish recipes');
      }
    } catch (error) {
      toast.error('Failed to unpublish recipes');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    try {
      const result = await adminBulkDeleteRecipes(selectedIds);

      if (result.success && result.data) {
        toast.success(`${result.data.deleted} recipes deleted successfully`);
        onSuccess();
        router.refresh(); // Refresh server component data
      } else {
        toast.error(result.error || 'Failed to delete recipes');
      }
    } catch (error) {
      toast.error('Failed to delete recipes');
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-blue-900">
            {selectedCount} recipe{selectedCount !== 1 ? 's' : ''} selected
          </span>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkPublish}
              disabled={isProcessing}
            >
              Publish All
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkUnpublish}
              disabled={isProcessing}
            >
              Unpublish All
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isProcessing}
            >
              Delete All
            </Button>
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          disabled={isProcessing}
        >
          Clear Selection
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} Recipes?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} recipe
              {selectedCount !== 1 ? 's' : ''}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Deleting...' : 'Delete All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
