import { ChefHat } from 'lucide-react';
import { redirect } from 'next/navigation';
import { RecipeUploadWizard } from '@/components/recipe/RecipeUploadWizard';
import { auth } from '@/lib/auth';

export const metadata = {
  title: "Share Your Recipe | Joanie's Kitchen",
  description: "Share your culinary creations with the Joanie's Kitchen community",
};

export default async function UploadRecipePage() {
  // Check authentication
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect=/recipes/upload');
  }

  return (
    <div className="container max-w-6xl py-8 md:py-12">
      {/* Page Header */}
      <div className="mb-8 md:mb-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <ChefHat className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">Share Your Recipe</h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Share your culinary creations with the Joanie's Kitchen community. Your recipes help
          inspire others and promote resourceful, waste-reducing cooking.
        </p>
      </div>

      {/* Upload Wizard */}
      <RecipeUploadWizard />

      {/* Community Guidelines */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Community Guidelines</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm text-muted-foreground">
          <div>
            <h3 className="font-medium text-foreground mb-2">What we love to see:</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Original recipes with clear instructions</li>
              <li>Recipes that reduce food waste</li>
              <li>Budget-friendly and accessible ingredients</li>
              <li>Seasonal and locally-sourced ingredients</li>
              <li>Personal stories and cooking tips</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-foreground mb-2">Recipe requirements:</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Clear, descriptive recipe name</li>
              <li>Detailed ingredient list with quantities</li>
              <li>Step-by-step cooking instructions</li>
              <li>Accurate prep and cook times</li>
              <li>Photos showing the finished dish (recommended)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
