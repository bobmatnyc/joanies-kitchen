/**
 * FridgeInput Usage Examples
 *
 * This file demonstrates how to use the FridgeInput component
 * in various scenarios.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FridgeInput } from './FridgeInput';
import { matchRecipesToInventory } from '@/app/actions/inventory';

/**
 * Example 1: Basic Usage with Navigation
 *
 * Simple implementation that searches for recipes and navigates to results page
 */
export function BasicFridgeInputExample() {
  const router = useRouter();

  const handleSearch = async (ingredients: string[]) => {
    // Convert ingredient names to URL-safe query parameter
    const query = ingredients.join(',');
    router.push(`/recipes/search?ingredients=${encodeURIComponent(query)}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-serif text-jk-clay mb-4">
        What&apos;s in Your Fridge?
      </h1>
      <FridgeInput onSearch={handleSearch} />
    </div>
  );
}

/**
 * Example 2: With Server Action Integration
 *
 * Uses matchRecipesToInventory server action to find matching recipes
 * and displays results inline
 */
export function ServerActionFridgeInputExample() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (ingredients: string[]) => {
    setLoading(true);
    try {
      // Note: This example shows the pattern but won't work as-is
      // because matchRecipesToInventory expects inventory items to exist
      // In production, you'd first create inventory items or use ingredient search
      const result = await matchRecipesToInventory({
        minMatchPercentage: 50,
        prioritizeExpiring: false,
        limit: 20,
      });

      if (result.success && result.data) {
        setResults(result.data);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <FridgeInput onSearch={handleSearch} />

      {loading && (
        <div className="mt-6 text-center text-jk-clay/60">
          Searching for recipes...
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-xl font-serif text-jk-clay">
            Found {results.length} recipes
          </h2>
          {/* Recipe cards would go here */}
        </div>
      )}
    </div>
  );
}

/**
 * Example 3: Custom Styling
 *
 * Shows how to customize the component appearance
 */
export function CustomStyledFridgeInputExample() {
  const handleSearch = async (ingredients: string[]) => {
    console.log('Searching for:', ingredients);
  };

  return (
    <div className="bg-jk-cream p-8 rounded-lg">
      <FridgeInput
        onSearch={handleSearch}
        placeholder="Enter ingredients you have..."
        className="max-w-xl"
      />
    </div>
  );
}

/**
 * Example 4: With Form Integration
 *
 * Shows how to integrate FridgeInput into a larger form
 */
export function FormIntegratedFridgeInputExample() {
  const [ingredients, setIngredients] = useState<string[]>([]);

  const handleSearch = async (selectedIngredients: string[]) => {
    setIngredients(selectedIngredients);
    // Additional form processing here
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Handle full form submission
    console.log('Form submitted with ingredients:', ingredients);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-ui text-jk-clay mb-2">
          Ingredients
        </label>
        <FridgeInput onSearch={handleSearch} />
      </div>

      {/* Other form fields would go here */}

      <button
        type="submit"
        className="px-4 py-2 bg-jk-tomato text-white rounded-md hover:bg-jk-tomato/90"
      >
        Submit
      </button>
    </form>
  );
}
