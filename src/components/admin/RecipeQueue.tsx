'use client';

import { CheckCircle, Clock, Eye, Flag, Users, XCircle } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ModerationActionDialog } from './ModerationActionDialog';
import { RecipePreviewModal } from './RecipePreviewModal';

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
  is_public: boolean | null;
  moderation_notes?: string | null;
  moderated_by?: string | null;
  moderated_at?: Date | null;
}

interface RecipeQueueProps {
  recipes: Recipe[];
}

export function RecipeQueue({ recipes: initialRecipes }: RecipeQueueProps) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [currentAction, setCurrentAction] = useState<'approve' | 'reject' | 'flag' | null>(null);
  const [actionRecipeId, setActionRecipeId] = useState<string | null>(null);

  const handleViewDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setPreviewOpen(true);
  };

  const handleQuickAction = (recipeId: string, action: 'approve' | 'reject' | 'flag') => {
    setActionRecipeId(recipeId);
    setCurrentAction(action);
    setActionDialogOpen(true);
  };

  const handleActionComplete = () => {
    // Refresh the page or remove the recipe from the list
    if (actionRecipeId) {
      setRecipes((prev) => prev.filter((r) => r.id !== actionRecipeId));
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-orange-100 text-orange-800">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      case 'flagged':
        return <Badge className="bg-blue-100 text-blue-800">Flagged</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (recipes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No recipes found</p>
      </div>
    );
  }

  const actionRecipe = recipes.find((r) => r.id === actionRecipeId);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => {
          const images = recipe.images ? JSON.parse(recipe.images) : [];
          const firstImage = images[0] || '/placeholder-recipe.jpg';

          return (
            <Card key={recipe.id} className="overflow-hidden">
              <CardHeader className="p-0">
                <div className="relative aspect-video bg-gray-100">
                  <Image
                    src={firstImage}
                    alt={recipe.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(recipe.moderation_status)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-2">
                <h3 className="font-semibold text-lg line-clamp-1">{recipe.name}</h3>

                {recipe.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">{recipe.description}</p>
                )}

                <div className="flex flex-wrap gap-2 items-center text-sm text-gray-500">
                  {recipe.prep_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{recipe.prep_time}m prep</span>
                    </div>
                  )}
                  {recipe.cook_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{recipe.cook_time}m cook</span>
                    </div>
                  )}
                  {recipe.servings && (
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{recipe.servings}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-1">
                  {recipe.cuisine && (
                    <Badge variant="secondary" className="text-xs">
                      {recipe.cuisine}
                    </Badge>
                  )}
                  {recipe.difficulty && (
                    <Badge className={`text-xs ${getDifficultyColor(recipe.difficulty)}`}>
                      {recipe.difficulty}
                    </Badge>
                  )}
                </div>

                {recipe.submission_notes && (
                  <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                    Note: {recipe.submission_notes.substring(0, 100)}
                    {recipe.submission_notes.length > 100 ? '...' : ''}
                  </div>
                )}

                {recipe.moderation_notes && (
                  <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                    {recipe.moderation_notes.substring(0, 100)}
                    {recipe.moderation_notes.length > 100 ? '...' : ''}
                  </div>
                )}

                <div className="text-xs text-gray-400 pt-2">
                  Submitted: {new Date(recipe.created_at).toLocaleDateString()}
                </div>
              </CardContent>

              <CardFooter className="p-4 pt-0 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(recipe)}
                  className="flex-1 gap-1"
                >
                  <Eye className="h-3 w-3" />
                  View Details
                </Button>

                {recipe.moderation_status === 'pending' && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleQuickAction(recipe.id, 'approve')}
                      className="gap-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleQuickAction(recipe.id, 'reject')}
                      className="gap-1"
                    >
                      <XCircle className="h-3 w-3" />
                      Reject
                    </Button>
                  </>
                )}

                {recipe.moderation_status === 'approved' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleQuickAction(recipe.id, 'flag')}
                    className="gap-1"
                  >
                    <Flag className="h-3 w-3" />
                    Flag
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Recipe Preview Modal */}
      <RecipePreviewModal
        recipe={selectedRecipe}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onActionComplete={() => {
          if (selectedRecipe) {
            setRecipes((prev) => prev.filter((r) => r.id !== selectedRecipe.id));
          }
        }}
      />

      {/* Quick Action Dialog */}
      {actionRecipe && (
        <ModerationActionDialog
          recipeId={actionRecipe.id}
          recipeName={actionRecipe.name}
          action={currentAction}
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          onSuccess={handleActionComplete}
        />
      )}
    </>
  );
}
