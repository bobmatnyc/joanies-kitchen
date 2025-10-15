'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { type Recipe } from '@/lib/db/schema';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
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
import {
  adminToggleRecipePublic,
  adminToggleSystemRecipe,
  adminDeleteRecipe,
} from '@/app/actions/admin';
import { toast } from 'sonner';
import Link from 'next/link';

interface RecipeRowProps {
  recipe: Recipe;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}

export function RecipeRow({
  recipe,
  isSelected,
  onToggleSelect,
}: RecipeRowProps) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(recipe.isPublic ?? false);
  const [isSystem, setIsSystem] = useState(recipe.isSystemRecipe ?? false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleTogglePublic = async () => {
    setIsUpdating(true);
    const newValue = !isPublic;

    try {
      const result = await adminToggleRecipePublic(recipe.id, newValue);

      if (result.success) {
        setIsPublic(newValue);
        toast.success(`Recipe ${newValue ? 'published' : 'unpublished'} successfully`);
        router.refresh(); // Refresh server component data
      } else {
        toast.error(result.error || 'Failed to update recipe');
      }
    } catch (error) {
      toast.error('Failed to update recipe visibility');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleSystem = async () => {
    setIsUpdating(true);
    const newValue = !isSystem;

    try {
      const result = await adminToggleSystemRecipe(recipe.id, newValue);

      if (result.success) {
        setIsSystem(newValue);
        setIsPublic(true); // System recipes are always public
        toast.success(
          `Recipe ${newValue ? 'marked as system' : 'unmarked as system'} recipe`
        );
        router.refresh(); // Refresh server component data
      } else {
        toast.error(result.error || 'Failed to update recipe');
      }
    } catch (error) {
      toast.error('Failed to update recipe status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const result = await adminDeleteRecipe(recipe.id);

      if (result.success) {
        toast.success('Recipe deleted successfully');
        router.refresh(); // Refresh server component data
      } else {
        toast.error(result.error || 'Failed to delete recipe');
      }
    } catch (error) {
      toast.error('Failed to delete recipe');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(recipe.id)}
          />
        </td>

        <td className="px-6 py-4">
          <div className="flex flex-col">
            <Link
              href={`/recipes/${recipe.id}`}
              className="text-sm font-medium text-gray-900 hover:text-blue-600"
            >
              {recipe.name}
            </Link>
            {recipe.description && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {recipe.description}
              </p>
            )}
            <div className="flex gap-2 mt-1">
              {recipe.isAiGenerated && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  AI
                </span>
              )}
              {recipe.difficulty && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                  {recipe.difficulty}
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900 font-mono">
            {recipe.userId.substring(0, 8)}...
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-center">
          <Switch
            checked={isPublic}
            onCheckedChange={handleTogglePublic}
            disabled={isUpdating || isSystem} // Can't unpublish system recipes
          />
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-center">
          <Switch
            checked={isSystem}
            onCheckedChange={handleToggleSystem}
            disabled={isUpdating}
          />
        </td>

        <td className="px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-900">
            {new Date(recipe.createdAt).toLocaleDateString()}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(recipe.createdAt).toLocaleTimeString()}
          </div>
        </td>

        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/recipes/${recipe.id}`}>View</Link>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </div>
        </td>
      </tr>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{recipe.name}"? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
