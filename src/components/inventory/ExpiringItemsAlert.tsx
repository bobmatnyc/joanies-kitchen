'use client';

import { AlertTriangle, ChefHat } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getUserInventory } from '@/app/actions/inventory';
import { Button } from '@/components/ui/button';

/**
 * ExpiringItemsAlert Component
 *
 * Banner that shows when items are expiring within 3 days
 * Provides quick navigation to find recipes using expiring ingredients
 */
export function ExpiringItemsAlert() {
  const router = useRouter();
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExpiringItems() {
      try {
        const result = await getUserInventory({ expiringWithinDays: 3 });
        if (result.success && 'data' in result && result.data) {
          setExpiringCount(result.data.length);
        }
      } catch (error) {
        console.error('Failed to fetch expiring items:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchExpiringItems();
  }, []);

  // Don't show if loading or no expiring items
  if (loading || expiringCount === 0) {
    return null;
  }

  const handleFindRecipes = () => {
    router.push('/fridge/results?source=inventory&prioritize=expiring');
  };

  return (
    <div className="mb-6 sm:mb-8 bg-orange-50 border-2 border-orange-200 rounded-xl p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-heading text-orange-900">
              {expiringCount} {expiringCount === 1 ? 'item' : 'items'} expiring soon
            </h3>
            <p className="text-sm text-orange-800 mt-1">
              Use {expiringCount === 1 ? 'it' : 'them'} in a recipe before{' '}
              {expiringCount === 1 ? 'it goes' : 'they go'} to waste.
            </p>
          </div>
        </div>
        <Button
          onClick={handleFindRecipes}
          className="bg-orange-600 hover:bg-orange-700 text-white gap-2 whitespace-nowrap"
        >
          <ChefHat className="w-4 h-4" />
          Find Recipes
        </Button>
      </div>
    </div>
  );
}
