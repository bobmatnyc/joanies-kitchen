'use client';

import { useState } from 'react';
import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IngredientsList } from '@/components/recipe/IngredientsList';
import { IngredientEditor } from './IngredientEditor';
import { InstructionEditor } from './InstructionEditor';
import { ImageEditor } from './ImageEditor';
import { useAdminEditMode } from './AdminEditMode';

interface RecipeContentWithEditProps {
  recipe: {
    id: string;
    name: string;
    slug?: string | null;
    ingredients: string[];
    instructions: string[];
    image_url?: string | null;
    images?: string[] | null;
  };
  isAdmin: boolean;
}

/**
 * Recipe Content with Admin Edit Overlays
 *
 * Wraps recipe content sections (ingredients, instructions, images)
 * with inline edit buttons when admin edit mode is enabled.
 *
 * Features:
 * - Edit buttons appear on hover when edit mode is active
 * - Opens appropriate editor overlay on click
 * - Refreshes content after save
 * - Mobile-friendly touch targets
 */
export function RecipeContentWithEdit({ recipe, isAdmin }: RecipeContentWithEditProps) {
  const { editMode } = useAdminEditMode();
  const [ingredientsEditorOpen, setIngredientsEditorOpen] = useState(false);
  const [instructionsEditorOpen, setInstructionsEditorOpen] = useState(false);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [key, setKey] = useState(0);

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
    // Force page reload to get updated data
    window.location.reload();
  };

  const showEditButtons = isAdmin && editMode;

  return (
    <>
      {/* Ingredients Section */}
      <Card className="h-fit relative group">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl sm:text-2xl">Ingredients</CardTitle>
              <CardDescription>Everything you'll need</CardDescription>
            </div>
            {showEditButtons && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIngredientsEditorOpen(true)}
                className="min-h-[44px] min-w-[44px] opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Edit ingredients"
              >
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <IngredientsList key={key} ingredients={recipe.ingredients} />
        </CardContent>
      </Card>

      {/* Instructions Section */}
      <Card className="relative group">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl sm:text-2xl">Instructions</CardTitle>
              <CardDescription>Step-by-step directions</CardDescription>
            </div>
            {showEditButtons && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInstructionsEditorOpen(true)}
                className="min-h-[44px] min-w-[44px] opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Edit instructions"
              >
                <Edit className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4" role="list">
            {recipe.instructions.map((instruction: string, index: number) => (
              <li key={index} className="flex gap-3">
                <span className="font-semibold text-primary flex-shrink-0 min-w-[1.5rem]">
                  {index + 1}.
                </span>
                <span className="leading-relaxed">{instruction}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Ingredient Editor Overlay */}
      {isAdmin && (
        <IngredientEditor
          recipeId={recipe.id}
          recipeName={recipe.name}
          initialIngredients={recipe.ingredients}
          open={ingredientsEditorOpen}
          onOpenChange={setIngredientsEditorOpen}
          onSave={handleRefresh}
        />
      )}

      {/* Instruction Editor Overlay */}
      {isAdmin && (
        <InstructionEditor
          recipeId={recipe.id}
          recipeName={recipe.name}
          initialInstructions={recipe.instructions}
          open={instructionsEditorOpen}
          onOpenChange={setInstructionsEditorOpen}
          onSave={handleRefresh}
        />
      )}

      {/* Image Editor Overlay */}
      {isAdmin && (
        <ImageEditor
          recipeId={recipe.id}
          recipeName={recipe.name}
          currentImageUrl={recipe.image_url}
          open={imageEditorOpen}
          onOpenChange={setImageEditorOpen}
          onSave={handleRefresh}
        />
      )}
    </>
  );
}
