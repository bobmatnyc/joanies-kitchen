import { IngredientBrowser } from '@/components/ingredients/IngredientBrowser';

export const metadata = {
  title: "Browse Ingredients | Joanie's Kitchen",
  description: 'Explore and filter ingredients by category, type, and dietary needs',
};

export default function BrowseIngredientsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Browse Ingredients</h1>
        <p className="text-gray-600">
          Explore 2,747 ingredients organized by category with ontology-based filtering
        </p>
      </div>

      <IngredientBrowser />
    </div>
  );
}
