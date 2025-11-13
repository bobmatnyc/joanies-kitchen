'use client';

import { ChefHat, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserInventory } from '@/app/actions/inventory';
import { FridgeInput } from '@/components/inventory';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@clerk/nextjs';

/**
 * Fridge Page - Zero-Waste Recipe Discovery
 *
 * Two modes:
 * 1. Use My Inventory (authenticated users): Find recipes from tracked inventory
 * 2. Manual Entry: Type ingredients manually
 *
 * User Flow (Inventory Mode):
 * 1. User clicks "Find Recipes from My Fridge"
 * 2. Navigates to /fridge/results?source=inventory
 * 3. Results page calls matchRecipesToInventory()
 *
 * User Flow (Manual Mode):
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
  const { isSignedIn } = useAuth();

  const [inventoryCount, setInventoryCount] = useState<number | null>(null);
  const [loadingInventory, setLoadingInventory] = useState(false);

  // Fetch inventory count if user is signed in
  useEffect(() => {
    if (!isSignedIn) return;

    async function fetchInventoryCount() {
      setLoadingInventory(true);
      try {
        const result = await getUserInventory();
        if (result.success && 'data' in result && result.data) {
          // Filter out used/wasted items
          const activeItems = result.data.filter(
            (item: any) => item.status !== 'used' && item.status !== 'wasted'
          );
          setInventoryCount(activeItems.length);
        }
      } catch (error) {
        console.error('Failed to fetch inventory:', error);
      } finally {
        setLoadingInventory(false);
      }
    }

    fetchInventoryCount();
  }, [isSignedIn]);

  /**
   * Handle recipe search navigation (manual mode)
   * Redirects to results page with ingredients as query params
   */
  const handleSearch = async (ingredients: string[]) => {
    if (ingredients.length === 0) return;

    // Build query string from ingredients
    const query = ingredients.join(',');

    // Navigate to results page with ingredients
    router.push(`/fridge/results?ingredients=${encodeURIComponent(query)}`);
  };

  /**
   * Handle inventory-based search
   * Navigates to results with source=inventory flag
   */
  const handleInventorySearch = () => {
    router.push('/fridge/results?source=inventory');
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
            Find recipes using ingredients you already have.
            <span className="block mt-2 text-sm sm:text-base text-jk-clay">
              Zero waste. Maximum flavor.
            </span>
          </p>
        </div>

        {/* Use My Inventory Section (Authenticated Users Only) */}
        {isSignedIn && (
          <div className="mb-6 sm:mb-8">
            <Card className="border-2 border-jk-sage/40 bg-jk-sage/5">
              <CardContent className="p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Package className="w-6 h-6 text-jk-clay flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-lg font-heading text-jk-olive">Use My Inventory</h3>
                      <p className="text-sm text-jk-charcoal/70 mt-1">
                        {loadingInventory ? (
                          'Loading your inventory...'
                        ) : inventoryCount === null || inventoryCount === 0 ? (
                          <>
                            No items in inventory.{' '}
                            <Link href="/inventory" className="text-jk-clay hover:underline">
                              Add items
                            </Link>{' '}
                            to get started.
                          </>
                        ) : (
                          <>
                            You have{' '}
                            <span className="font-semibold text-jk-clay">{inventoryCount}</span>{' '}
                            {inventoryCount === 1 ? 'item' : 'items'} in your fridge.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {inventoryCount !== null && inventoryCount > 0 && (
                    <Button
                      onClick={handleInventorySearch}
                      disabled={loadingInventory}
                      className="bg-jk-clay hover:bg-jk-clay/90 text-white gap-2 whitespace-nowrap"
                    >
                      <ChefHat className="w-4 h-4" />
                      Find Recipes from My Fridge
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Manual Input Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-jk-sage/20 p-6 sm:p-8 lg:p-10">
          <div className="mb-4 text-center">
            <h2 className="text-xl font-heading text-jk-olive">
              {isSignedIn ? 'Or Enter Ingredients Manually' : 'Enter Ingredients'}
            </h2>
          </div>
          <FridgeInput
            onSearch={handleSearch}
            placeholder="Start typing ingredient names..."
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
              <h3 className="text-lg sm:text-xl font-heading text-jk-clay">Enter Ingredients</h3>
              <p className="text-sm sm:text-base text-jk-charcoal/70 font-body">
                Type what you have in your fridge, pantry, or cupboard. We'll autocomplete for you.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-jk-sage/20 rounded-full flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-heading text-jk-olive">2</span>
              </div>
              <h3 className="text-lg sm:text-xl font-heading text-jk-clay">Find Matches</h3>
              <p className="text-sm sm:text-base text-jk-charcoal/70 font-body">
                Our smart search finds recipes that use your ingredients with minimal waste.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto bg-jk-sage/20 rounded-full flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-heading text-jk-olive">3</span>
              </div>
              <h3 className="text-lg sm:text-xl font-heading text-jk-clay">Start Cooking</h3>
              <p className="text-sm sm:text-base text-jk-charcoal/70 font-body">
                Choose a recipe, see what's missing, and get cooking with what you've got!
              </p>
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="mt-12 sm:mt-16 bg-jk-sage/10 rounded-xl p-6 sm:p-8 border border-jk-sage/20">
          <h3 className="text-xl sm:text-2xl font-heading text-jk-olive mb-4">Pro Tips</h3>
          <ul className="space-y-2 text-sm sm:text-base text-jk-charcoal/70 font-body">
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Start with proteins:</strong> Chicken, beef, tofu,
                eggs
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Add vegetables:</strong> Whatever needs using up
                first
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Don't forget pantry staples:</strong> Rice, pasta,
                canned goods
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-tomato mt-1">•</span>
              <span>
                <strong className="text-jk-clay">Less is more:</strong> Start with 3-5 key
                ingredients for best results
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
