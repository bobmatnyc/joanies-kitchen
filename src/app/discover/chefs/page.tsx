import { getAllChefs } from '@/app/actions/chefs';
import { ChefGrid } from '@/components/chef/ChefGrid';
import { ChefHat } from 'lucide-react';

export const metadata = {
  title: 'Discover Chefs | Joanie\'s Kitchen',
  description: 'Browse recipes from world-renowned chefs and culinary experts'
};

export default async function DiscoverChefsPage() {
  const chefsResult = await getAllChefs();
  const chefs = chefsResult.success ? chefsResult.chefs : [];

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading text-jk-olive mb-2">
            Discover Chefs
          </h1>
          <p className="text-jk-olive/60">
            Explore recipes from culinary experts and food creators
          </p>
        </div>

        <ChefHat className="w-12 h-12 text-jk-olive/20 hidden md:block" />
      </div>

      {/* Stats */}
      {chefs.length > 0 && (
        <div className="mb-8 p-4 bg-jk-linen rounded-lg border border-jk-olive/20">
          <p className="text-sm text-jk-olive">
            Featuring <strong>{chefs.length}</strong> talented chef{chefs.length !== 1 ? 's' : ''} with{' '}
            <strong>{chefs.reduce((sum, chef) => sum + (chef.recipeCount || 0), 0)}</strong> recipes
          </p>
        </div>
      )}

      {/* Chef Grid */}
      <ChefGrid
        chefs={chefs}
        emptyMessage="No chefs yet"
        emptyDescription="Check back soon for featured chefs and their amazing recipes!"
      />
    </div>
  );
}
