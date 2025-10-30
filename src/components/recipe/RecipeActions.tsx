'use client';

import { AddToCollectionButton } from '@/components/collections/AddToCollectionButton';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { FlagButton } from './FlagButton';

interface RecipeActionsProps {
  recipeId: string;
  recipeName: string;
  isOwner?: boolean;
  isSignedIn?: boolean;
  className?: string;
}

/**
 * RecipeActions - Groups all recipe action buttons in one component
 *
 * This component provides a consistent way to display recipe actions
 * across different parts of the application (recipe page, recipe cards, etc.)
 *
 * @param recipeId - The ID of the recipe
 * @param recipeName - The name of the recipe (for confirmation messages)
 * @param isOwner - Whether the current user owns this recipe
 * @param isSignedIn - Whether the user is signed in
 * @param className - Optional CSS class names
 */
export function RecipeActions({
  recipeId,
  recipeName,
  isOwner = false,
  isSignedIn = false,
  className = '',
}: RecipeActionsProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Favorite - only for signed-in users */}
      {isSignedIn && <FavoriteButton recipeId={recipeId} />}

      {/* Add to Collection - only for signed-in users */}
      {isSignedIn && <AddToCollectionButton recipeId={recipeId} />}

      {/* Report - available to all users except owner */}
      {!isOwner && <FlagButton recipeId={recipeId} recipeName={recipeName} />}
    </div>
  );
}
