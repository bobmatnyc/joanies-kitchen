'use client';

import { useRouter } from 'next/navigation';
import { FridgeInput } from '@/components/inventory';

/**
 * Fridge Page - Zero-Waste Recipe Discovery
 *
 * Enter ingredients from your fridge/pantry and find recipes that use them.
 * Supports autocomplete, ingredient selection, and navigation to results page.
 *
 * User Flow:
 * 1. User enters ingredients via autocomplete input
 * 2. Selected ingredients displayed as badge chips
 * 3. User clicks "Find Recipes" button
 * 4. Navigates to /fridge/results?ingredients=chicken,rice,carrots
 *
 * Mobile-First:
 * - Large touch targets (44x44px minimum)
 * - Full-width layout on mobile
 * - Responsive hero section
 */
export default function FridgePage() {
  const router = useRouter();

  /**
   * Handle recipe search navigation
   * Redirects to results page with ingredients as query params
   */
  const handleSearch = async (ingredients: string[]) => {
    if (ingredients.length === 0) return;

    // Build query string from ingredients
    const query = ingredients.join(',');

    // Navigate to results page with ingredients
    router.push(`/fridge/results?ingredients=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-jk-sage/10">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Page Header */}
        <div className="text-center space-y-4 mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-heading text-jk-olive">
            What's in Your Fridge?
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-jk-charcoal/70 font-body max-w-2xl mx-auto leading-relaxed">
            Enter the ingredients you have on hand, and we'll find delicious recipes that help you use them up.
            <span className="block mt-2 text-sm sm:text-base text-jk-clay">
              Zero waste. Maximum flavor.
            </span>
          </p>
        </div>

        {/* Fridge Input Component */}
        <div className="bg-white rounded-2xl shadow-lg border border-jk-sage/20 p-6 sm:p-8 lg:p-10">
          <FridgeInput
            onSearch={handleSearch}
            placeholder="What's in your fridge?"
            maxIngredients={20}
            className="w-full"
          />
        </div>

        {/* How It Works Section */}
        <div className="mt-12 sm:mt-16 space-y-6">
          <h2 className="text-2xl sm:text-3xl font-heading text-jk-olive text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 1 */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-jk-sage/20 rounded-full flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-heading text-jk-olive">1</span>
              </div>
              <h3 className="text-lg sm:text-xl font-heading text-jk-clay">
                Enter Ingredients
              </h3>
              <p className="text-sm sm:text-base text-jk-charcoal/70 font-body">
                Type what you have in your fridge, pantry, or cupboard. We'll autocomplete for you.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-jk-sage/20 rounded-full flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-heading text-jk-olive">2</span>
              </div>
              <h3 className="text-lg sm:text-xl font-heading text-jk-clay">
                Find Matches
              </h3>
              <p className="text-sm sm:text-base text-jk-charcoal/70 font-body">
                Our smart search finds recipes that use your ingredients with minimal waste.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-jk-sage/20 rounded-full flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-heading text-jk-olive">3</span>
              </div>
              <h3 className="text-lg sm:text-xl font-heading text-jk-clay">
                Start Cooking
              </h3>
              <p className="text-sm sm:text-base text-jk-charcoal/70 font-body">
                Choose a recipe, see what's missing, and get cooking with what you've got!
              </p>
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-12 sm:mt-16 bg-jk-sage/10 rounded-xl p-6 sm:p-8 border border-jk-sage/20">
          <h3 className="text-xl sm:text-2xl font-heading text-jk-olive mb-4">
            Pro Tips
          </h3>
          <ul className="space-y-2 text-sm sm:text-base text-jk-charcoal/70 font-body">
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Start with proteins:</strong> Chicken, beef, tofu, eggs
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Add vegetables:</strong> Whatever needs using up first
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Don't forget pantry staples:</strong> Rice, pasta, canned goods
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Less is more:</strong> Start with 3-5 key ingredients for best results
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
