'use client';

import { CheckCircle, Clock, Flag, Users, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ModerationActionDialog } from './ModerationActionDialog';

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  cuisine: string | null;
  difficulty: string | null;
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  images: string | null;
  ingredients: string | null;
  instructions: string | null;
  tags: string | null;
  user_id: string;
  created_at: Date;
  moderation_status: string;
  submission_notes: string | null;
  moderation_notes?: string | null;
  moderated_by?: string | null;
  moderated_at?: Date | null;
}

interface RecipePreviewModalProps {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete?: () => void;
}

export function RecipePreviewModal({
  recipe,
  open,
  onOpenChange,
  onActionComplete,
}: RecipePreviewModalProps) {
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<'approve' | 'reject' | 'flag' | null>(null);

  if (!recipe) return null;

  // Parse JSON fields
  const images = recipe.images ? JSON.parse(recipe.images) : [];
  const ingredients = recipe.ingredients ? JSON.parse(recipe.ingredients) : [];
  const instructions = recipe.instructions ? JSON.parse(recipe.instructions) : [];
  const tags = recipe.tags ? JSON.parse(recipe.tags) : [];

  const handleAction = (action: 'approve' | 'reject' | 'flag') => {
    setCurrentAction(action);
    setActionDialogOpen(true);
  };

  const handleActionSuccess = () => {
    onActionComplete?.();
    onOpenChange(false);
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'hard':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-2xl">{recipe.name}</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
            <div className="p-6 space-y-6">
              {/* Images Gallery */}
              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {images.map((image: string, index: number) => (
                    <div
                      key={index}
                      className="relative aspect-video rounded-lg overflow-hidden bg-gray-100"
                    >
                      <Image
                        src={image}
                        alt={`${recipe.name} - Image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4">
                {recipe.prep_time && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Prep: {recipe.prep_time} min</span>
                  </div>
                )}
                {recipe.cook_time && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Cook: {recipe.cook_time} min</span>
                  </div>
                )}
                {recipe.servings && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{recipe.servings} servings</span>
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap gap-2">
                {recipe.cuisine && (
                  <Badge variant="secondary" className="capitalize">
                    {recipe.cuisine}
                  </Badge>
                )}
                {recipe.difficulty && (
                  <Badge className={getDifficultyColor(recipe.difficulty)}>
                    {recipe.difficulty}
                  </Badge>
                )}
                {tags.map((tag: string, index: number) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Description */}
              {recipe.description && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-gray-700">{recipe.description}</p>
                </div>
              )}

              <Separator />

              {/* Submission Notes */}
              {recipe.submission_notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-blue-900">Submission Notes</h3>
                  <p className="text-blue-800">{recipe.submission_notes}</p>
                </div>
              )}

              {/* Moderation Notes (if exists) */}
              {recipe.moderation_notes && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold mb-2 text-gray-900">Moderation Notes</h3>
                  <p className="text-gray-800">{recipe.moderation_notes}</p>
                </div>
              )}

              {/* Ingredients */}
              {ingredients.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Ingredients</h3>
                  <ul className="space-y-2">
                    {ingredients.map((ingredient: string, index: number) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-jk-olive mt-1">•</span>
                        <span className="text-gray-700">{ingredient}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Separator />

              {/* Instructions */}
              {instructions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Instructions</h3>
                  <ol className="space-y-3">
                    {instructions.map((instruction: string, index: number) => (
                      <li key={index} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-jk-olive text-white text-sm flex items-center justify-center font-semibold">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 pt-0.5">{instruction}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Metadata Info */}
              <div className="text-xs text-gray-500 pt-4 border-t">
                <p>Submitted: {new Date(recipe.created_at).toLocaleString()}</p>
                <p>User ID: {recipe.user_id}</p>
                <p>Status: {recipe.moderation_status}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 p-6 pt-0 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => handleAction('flag')} className="gap-2">
              <Flag className="h-4 w-4" />
              Flag for Review
            </Button>
            <Button variant="destructive" onClick={() => handleAction('reject')} className="gap-2">
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
            <Button
              variant="default"
              onClick={() => handleAction('approve')}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <ModerationActionDialog
        recipeId={recipe.id}
        recipeName={recipe.name}
        action={currentAction}
        open={actionDialogOpen}
        onOpenChange={setActionDialogOpen}
        onSuccess={handleActionSuccess}
      />
    </>
  );
}
