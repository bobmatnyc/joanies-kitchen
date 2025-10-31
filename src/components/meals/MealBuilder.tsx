'use client';

import { useAuth } from '@clerk/nextjs';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { addRecipeToMeal, createMeal } from '@/app/actions/meals';
import { getRecipes } from '@/app/actions/recipes';
import { Button } from '@/components/ui/button';
import type { Recipe } from '@/lib/db/schema';
import { isValidCourseCategory, isValidMealType } from '@/lib/meals/type-guards';
import {
  addRecipeToGuestMeal,
  createGuestMeal,
  type GuestMealRecipe,
} from '@/lib/utils/guest-meals';
import { AiRecipeSuggestions } from './AiRecipeSuggestions';
import { MealFormFields } from './MealFormFields';
import { RecipeSearchDialog } from './RecipeSearchDialog';
import { type MealRecipeWithDetails, SelectedRecipesList } from './SelectedRecipesList';
import { SignInToSaveDialog } from './SignInToSaveDialog';

export function MealBuilder() {
  const router = useRouter();
  const { userId } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState(true);
  const [open, setOpen] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState<string>('dinner');
  const [serves, setServes] = useState<number>(4);
  const [occasion, setOccasion] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  // Selected recipes
  const [selectedRecipes, setSelectedRecipes] = useState<MealRecipeWithDetails[]>([]);

  // Load recipes
  useEffect(() => {
    async function loadRecipes() {
      const result = await getRecipes();
      if (result.success && result.data) {
        setRecipes(result.data);
      }
      setIsLoadingRecipes(false);
    }
    loadRecipes();
  }, []);

  // Automatically aggregate tags from selected recipes
  useEffect(() => {
    if (selectedRecipes.length === 0) {
      return; // Keep existing tags when no recipes selected
    }

    // Collect all tags from selected recipes
    const aggregatedTags = new Set<string>();

    selectedRecipes.forEach((mealRecipe) => {
      const recipe = mealRecipe.recipe;
      if (recipe.tags) {
        try {
          const recipeTags = JSON.parse(recipe.tags) as string[];
          recipeTags.forEach((tag) => {
            // Normalize tag (trim and deduplicate case-insensitive)
            const normalizedTag = tag.trim();
            if (normalizedTag) {
              aggregatedTags.add(normalizedTag);
            }
          });
        } catch (error) {
          console.error(`Failed to parse tags for recipe ${recipe.id}:`, error);
        }
      }
    });

    // Convert Set to array and update tags state
    const newTags = Array.from(aggregatedTags).sort();
    setTags(newTags);
  }, [selectedRecipes]);

  const addRecipe = useCallback((recipe: Recipe, courseCategory: string = 'main') => {
    // Validate course category
    if (!isValidCourseCategory(courseCategory)) {
      toast.error(`Invalid course category: ${courseCategory}`);
      return;
    }

    setSelectedRecipes((prev) => {
      // Check if recipe already added
      if (prev.some((mr) => mr.recipe_id === recipe.id)) {
        toast.error('Recipe already added to this meal');
        return prev;
      }

      const newMealRecipe: MealRecipeWithDetails = {
        meal_id: '', // Will be set when meal is created
        recipe_id: recipe.id,
        course_category: courseCategory,
        display_order: prev.length,
        serving_multiplier: '1.00',
        recipe,
      };

      setOpen(false);
      toast.success(`Added ${recipe.name} to meal`);
      return [...prev, newMealRecipe];
    });
  }, []);

  const removeRecipe = useCallback((recipeId: string) => {
    setSelectedRecipes((prev) => prev.filter((mr) => mr.recipe_id !== recipeId));
    toast.success('Recipe removed');
  }, []);

  const updateRecipeMultiplier = useCallback((recipeId: string, multiplier: string) => {
    setSelectedRecipes((prev) =>
      prev.map((mr) => (mr.recipe_id === recipeId ? { ...mr, serving_multiplier: multiplier } : mr))
    );
  }, []);

  const updateRecipeCourse = useCallback((recipeId: string, courseCategory: string) => {
    // Validate course category
    if (!isValidCourseCategory(courseCategory)) {
      toast.error(`Invalid course category: ${courseCategory}`);
      return;
    }

    setSelectedRecipes((prev) =>
      prev.map((mr) =>
        mr.recipe_id === recipeId ? { ...mr, course_category: courseCategory } : mr
      )
    );
  }, []);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!name.trim()) {
        toast.error('Please enter a meal name');
        return;
      }

      if (!description.trim()) {
        toast.error('Please enter a meal description');
        return;
      }

      if (selectedRecipes.length === 0) {
        toast.error('Please add at least one recipe');
        return;
      }

      // Validate meal type
      if (!isValidMealType(mealType)) {
        toast.error(`Invalid meal type: ${mealType}`);
        return;
      }

      // Guest mode: store locally and show sign-in dialog
      if (!userId) {
        try {
          const guestMeal = createGuestMeal({
            name: name.trim(),
            description: description.trim() || null,
            meal_type: mealType,
            serves,
            occasion: occasion.trim() || null,
            tags: tags.length > 0 ? JSON.stringify(tags) : null,
            is_template: false,
            is_public: false,
            image_url: null,
            total_prep_time: null,
            total_cook_time: null,
            estimated_total_cost: null,
            estimated_cost_per_serving: null,
            price_estimation_date: null,
            price_estimation_confidence: null,
          });

          // Add recipes to guest meal
          for (const mealRecipe of selectedRecipes) {
            const guestMealRecipe: Omit<GuestMealRecipe, 'id' | 'created_at'> = {
              meal_id: guestMeal.id,
              recipe_id: mealRecipe.recipe_id,
              course_category: mealRecipe.course_category || 'main',
              display_order: mealRecipe.display_order || 0,
              serving_multiplier: mealRecipe.serving_multiplier || '1.00',
              preparation_notes: null,
            };
            addRecipeToGuestMeal(guestMealRecipe);
          }

          toast.success('Meal saved in browser!');
          setShowSignInDialog(true);

          // Wait a moment then redirect
          setTimeout(() => {
            router.push(`/meals/${guestMeal.id}`);
          }, 500);
        } catch (error) {
          console.error('Error creating guest meal:', error);
          toast.error('Failed to create meal');
        }
        return;
      }

      // Authenticated mode: save to database
      setIsLoading(true);

      try {
        // Create the meal
        const mealResult = await createMeal({
          name: name.trim(),
          description: description.trim(),
          meal_type: mealType,
          serves,
          occasion: occasion.trim() || null,
          tags: tags.length > 0 ? JSON.stringify(tags) : undefined,
        });

        if (!mealResult.success || !mealResult.data) {
          throw new Error(mealResult.error || 'Failed to create meal');
        }

        const mealId = mealResult.data.id;

        // Add all recipes to the meal
        for (const mealRecipe of selectedRecipes) {
          const result = await addRecipeToMeal({
            meal_id: mealId,
            recipe_id: mealRecipe.recipe_id,
            course_category: mealRecipe.course_category,
            display_order: mealRecipe.display_order,
            serving_multiplier: mealRecipe.serving_multiplier,
          });

          if (!result.success) {
            console.error('Failed to add recipe:', result.error);
          }
        }

        toast.success('Meal created successfully!');
        // Use slug for navigation if available
        const mealPath = mealResult.data.slug || mealId;
        router.push(`/meals/${mealPath}`);
      } catch (error) {
        console.error('Error creating meal:', error);
        toast.error('Failed to create meal');
        setIsLoading(false);
      }
    },
    [name, description, mealType, serves, occasion, tags, selectedRecipes, router, userId]
  );

  return (
    <>
      <SignInToSaveDialog
        open={showSignInDialog}
        onOpenChange={setShowSignInDialog}
        returnUrl="/meals"
      />
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Meal Details Section */}
        <MealFormFields
          name={name}
          description={description}
          mealType={mealType}
          serves={serves}
          occasion={occasion}
          tags={tags}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onMealTypeChange={setMealType}
          onServesChange={setServes}
          onOccasionChange={setOccasion}
          onTagsChange={setTags}
        />

        {/* AI Recipe Suggestions Section */}
        <AiRecipeSuggestions description={description} tags={tags} onAddRecipe={addRecipe} />

        {/* Recipe Selection Section */}
        <SelectedRecipesList
          selectedRecipes={selectedRecipes}
          onRemove={removeRecipe}
          onUpdateMultiplier={updateRecipeMultiplier}
          onUpdateCourse={updateRecipeCourse}
          searchDialogTrigger={
            <RecipeSearchDialog
              recipes={recipes}
              isLoadingRecipes={isLoadingRecipes}
              open={open}
              onOpenChange={setOpen}
              onAddRecipe={addRecipe}
            />
          }
        />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            className="min-h-[44px] touch-manipulation font-ui"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isLoading || selectedRecipes.length === 0 || !name.trim() || !description.trim()
            }
            className="min-h-[44px] touch-manipulation bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Meal...
              </>
            ) : (
              'Create Meal'
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
