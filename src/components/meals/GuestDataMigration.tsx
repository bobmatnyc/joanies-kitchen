'use client';

import { useAuth } from '@clerk/nextjs';
import { CheckCircle, Loader2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { addRecipeToMeal, createMeal } from '@/app/actions/meals';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  clearGuestData,
  exportGuestData,
  getGuestDataCount,
  hasGuestData,
} from '@/lib/utils/guest-meals';

/**
 * Component that handles migration of guest meal data to authenticated account
 * Shows a dialog when user signs in and has guest data in localStorage
 */
export function GuestDataMigration() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);

  useEffect(() => {
    // Only run when auth is loaded
    if (!isLoaded) return;

    // Check if we should show migration dialog
    const shouldMigrate = sessionStorage.getItem('has_guest_data') === 'true';

    if (userId && shouldMigrate && hasGuestData()) {
      setShowMigrationDialog(true);
      sessionStorage.removeItem('has_guest_data'); // Clear flag
    }
  }, [userId, isLoaded]);

  const handleMigrate = async () => {
    setIsMigrating(true);

    try {
      const guestData = exportGuestData();
      const { meals, mealRecipes, shoppingLists } = guestData;

      let migratedCount = 0;
      const mealIdMap = new Map<string, string>(); // guest ID -> DB ID

      // Migrate meals
      for (const guestMeal of meals) {
        const result = await createMeal({
          name: guestMeal.name,
          description: guestMeal.description || '',
          meal_type: guestMeal.meal_type,
          serves: guestMeal.serves,
          occasion: guestMeal.occasion || null,
          tags: guestMeal.tags || undefined,
        });

        if (result.success && result.data) {
          mealIdMap.set(guestMeal.id, result.data.id);
          migratedCount++;

          // Add recipes to the meal
          const recipesForMeal = mealRecipes.filter((mr) => mr.meal_id === guestMeal.id);
          for (const mealRecipe of recipesForMeal) {
            await addRecipeToMeal({
              meal_id: result.data.id,
              recipe_id: mealRecipe.recipe_id,
              course_category: mealRecipe.course_category,
              display_order: mealRecipe.display_order,
              serving_multiplier: mealRecipe.serving_multiplier,
            });
          }
        }
      }

      // Clear guest data from localStorage
      clearGuestData();
      setMigrationComplete(true);

      toast.success(
        `Successfully migrated ${migratedCount} ${migratedCount === 1 ? 'meal' : 'meals'}!`
      );

      // Redirect after a moment
      setTimeout(() => {
        setShowMigrationDialog(false);
        router.push('/meals');
        router.refresh();
      }, 1500);
    } catch (error) {
      console.error('Migration failed:', error);
      toast.error('Failed to migrate some data. Please try again.');
      setIsMigrating(false);
    }
  };

  const handleSkip = () => {
    // Ask for confirmation
    if (
      window.confirm(
        "Are you sure? Your guest meals will remain in your browser but won't be saved to your account."
      )
    ) {
      setShowMigrationDialog(false);
    }
  };

  const handleDiscard = () => {
    // Ask for confirmation
    if (window.confirm('Are you sure you want to discard all guest data? This cannot be undone.')) {
      clearGuestData();
      toast.success('Guest data cleared');
      setShowMigrationDialog(false);
      router.push('/meals');
    }
  };

  const { meals, shoppingLists: lists } = getGuestDataCount();

  if (!showMigrationDialog) return null;

  return (
    <Dialog open={showMigrationDialog} onOpenChange={setShowMigrationDialog}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-jk-olive">
            {migrationComplete ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                Migration Complete!
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Save Your Guest Data
              </>
            )}
          </DialogTitle>
          <DialogDescription className="font-body text-jk-charcoal/70">
            {migrationComplete
              ? 'Your guest meals have been saved to your account.'
              : 'Welcome! You have unsaved meal planning data in your browser. Would you like to save it to your account?'}
          </DialogDescription>
        </DialogHeader>

        {!migrationComplete && (
          <div className="space-y-4 py-4">
            <div className="bg-jk-sage/10 border border-jk-sage/30 rounded-jk p-4 space-y-2">
              <h4 className="font-ui font-semibold text-jk-olive">Found in your browser:</h4>
              <ul className="space-y-1 text-sm font-body text-jk-charcoal/80">
                {meals > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-jk-tomato" />
                    {meals} {meals === 1 ? 'meal' : 'meals'}
                  </li>
                )}
                {lists > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-jk-clay" />
                    {lists} shopping {lists === 1 ? 'list' : 'lists'}
                  </li>
                )}
              </ul>
            </div>

            <p className="text-sm text-jk-charcoal/70 font-body">
              Migrating will copy all your guest meals to your account and remove them from your
              browser.
            </p>
          </div>
        )}

        {migrationComplete && (
          <div className="py-8 text-center">
            <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
            <p className="text-jk-charcoal/70 font-body">Redirecting to your meals...</p>
          </div>
        )}

        {!migrationComplete && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2 flex-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={isMigrating}
                className="flex-1 border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
              >
                Keep in Browser
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscard}
                disabled={isMigrating}
                className="border-red-300 text-red-700 hover:bg-red-50 font-ui"
              >
                Discard
              </Button>
            </div>
            <Button
              type="button"
              onClick={handleMigrate}
              disabled={isMigrating}
              className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui"
            >
              {isMigrating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Save to Account
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
