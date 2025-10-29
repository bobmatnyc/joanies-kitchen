/**
 * Zero-Waste Recipe Collection
 *
 * Week 3 Task: Create dedicated collection of high-resourcefulness recipes
 * Features recipes with resourcefulness_score >= 4 and waste-reduction tags
 *
 * Emphasizes Joanie's philosophy: cook with what you have, waste nothing
 */

import { ChefHat, Clock, Leaf, Recycle, Users } from 'lucide-react';
import Link from 'next/link';
import { getResourcefulRecipes } from '@/app/actions/recipes';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Zero-Waste Recipe Collection | Joanie's Kitchen",
  description:
    'Resourceful recipes that help you cook with what you have and waste nothing. High flexibility, seasonal ingredients, and scrap utilization.',
};

/**
 * Recipe Statistics Component
 * Shows counts for different waste-reduction characteristics
 */
function RecipeStats({ recipes }: { recipes: any[] }) {
  // Count recipes by characteristics
  const stats = {
    flexible: recipes.filter((r) => r.waste_reduction_tags?.includes('flexible')).length,
    onePot: recipes.filter((r) => r.waste_reduction_tags?.includes('one_pot')).length,
    seasonal: recipes.filter((r) => r.waste_reduction_tags?.includes('seasonal')).length,
    scrapUtilization: recipes.filter((r) => r.waste_reduction_tags?.includes('scrap_utilization'))
      .length,
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
        <div className="text-3xl font-bold text-jk-olive mb-2">{stats.flexible}</div>
        <div className="text-sm text-jk-charcoal/70">Flexible Recipes</div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
        <div className="text-3xl font-bold text-jk-olive mb-2">{stats.onePot}</div>
        <div className="text-sm text-jk-charcoal/70">One-Pot Meals</div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
        <div className="text-3xl font-bold text-jk-olive mb-2">{stats.seasonal}</div>
        <div className="text-sm text-jk-charcoal/70">Seasonal Focus</div>
      </div>
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200">
        <div className="text-3xl font-bold text-jk-olive mb-2">{stats.scrapUtilization}</div>
        <div className="text-sm text-jk-charcoal/70">Use Scraps</div>
      </div>
    </div>
  );
}

/**
 * Main Zero-Waste Page Component
 */
export default async function ZeroWastePage() {
  // Fetch high-resourcefulness recipes (score >= 4)
  const recipes = await getResourcefulRecipes({ limit: 100, minScore: 4 });

  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-green-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Leaf className="h-12 w-12 text-jk-sage" />
            <Recycle className="h-12 w-12 text-jk-sage" />
          </div>
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Zero-Waste Recipe Collection
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-3xl mx-auto leading-relaxed">
            Resourceful recipes that embody Joanie's philosophy:{' '}
            <strong>cook with what you have, waste nothing</strong>. Every recipe here scores high
            for flexibility, seasonal ingredients, and creative scrap utilization.
          </p>
        </div>

        {/* Joanie's Philosophy Callout */}
        <div className="bg-gradient-to-r from-jk-sage/10 to-green-100/50 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <div className="max-w-3xl mx-auto">
            <blockquote className="text-xl md:text-2xl font-body italic text-jk-charcoal mb-4">
              "I'd like to see technology help with food waste. That would be the highlight of my
              life."
            </blockquote>
            <p className="text-base text-jk-charcoal/70 leading-relaxed">
              <strong>— Joanie</strong>
            </p>
            <p className="text-base text-jk-charcoal/70 mt-4 leading-relaxed">
              Joanie doesn't cook from recipes — she cooks from her fridge. These recipes honor her
              approach: flexible ingredients, forgiving techniques, and maximum resourcefulness.
            </p>
          </div>
        </div>

        {/* Recipe Statistics */}
        <RecipeStats recipes={recipes} />

        {/* What Makes These Recipes Special */}
        <div className="mb-12">
          <h2 className="text-2xl md:text-3xl font-heading text-jk-olive mb-6 text-center">
            What Makes These Recipes Special
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* High Flexibility */}
            <div className="bg-white p-6 rounded-xl border-2 border-jk-sage/20 hover:border-jk-sage/40 transition-colors">
              <ChefHat className="h-10 w-10 text-jk-sage mb-4" />
              <h3 className="text-xl font-heading text-jk-olive mb-3">High Flexibility</h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed">
                Accept substitutions easily. Missing an ingredient? These recipes work with what you
                have. No need to shop for specialty items.
              </p>
            </div>

            {/* Waste Reduction */}
            <div className="bg-white p-6 rounded-xl border-2 border-jk-sage/20 hover:border-jk-sage/40 transition-colors">
              <Recycle className="h-10 w-10 text-jk-sage mb-4" />
              <h3 className="text-xl font-heading text-jk-olive mb-3">Waste Reduction</h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed">
                Use aging ingredients, wilting greens, leftover proteins, vegetable scraps. Turn
                "nothing" into something delicious.
              </p>
            </div>

            {/* Resourceful Techniques */}
            <div className="bg-white p-6 rounded-xl border-2 border-jk-sage/20 hover:border-jk-sage/40 transition-colors">
              <Clock className="h-10 w-10 text-jk-sage mb-4" />
              <h3 className="text-xl font-heading text-jk-olive mb-3">Resourceful Techniques</h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed">
                One-pot meals, forgiving methods, minimal cleanup. Cook efficiently without
                compromising flavor or nutrition.
              </p>
            </div>
          </div>
        </div>

        {/* Resourcefulness Scoring Explainer */}
        <div className="bg-white rounded-xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">How We Score Resourcefulness</h2>
          <p className="text-base text-jk-charcoal/70 mb-4 leading-relaxed">
            Every recipe in this collection has a{' '}
            <strong>resourcefulness score of 4 or 5 stars</strong> (out of 5). We calculate this
            based on:
          </p>
          <ul className="space-y-2 text-base text-jk-charcoal/70">
            <li className="flex items-start gap-2">
              <span className="text-jk-sage mt-1">✓</span>
              <span>
                <strong>Common ingredients:</strong> Uses pantry staples you likely have on hand
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-sage mt-1">✓</span>
              <span>
                <strong>Substitution flexibility:</strong> Accepts alternatives without breaking the
                dish
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-sage mt-1">✓</span>
              <span>
                <strong>Forgiving technique:</strong> No precision required — cook with confidence
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-sage mt-1">✓</span>
              <span>
                <strong>Scrap utilization:</strong> Uses vegetable peels, stems, bones, wilting
                greens
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-jk-sage mt-1">✓</span>
              <span>
                <strong>Minimal cleanup:</strong> One-pot meals, sheet pan dinners, efficient
                cooking
              </span>
            </li>
          </ul>
        </div>

        {/* Recipe Grid */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-heading text-jk-olive">
              {recipes.length} Resourceful Recipes
            </h2>
            <div className="text-sm text-jk-charcoal/60">Sorted by resourcefulness score</div>
          </div>

          {recipes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Leaf className="h-16 w-16 text-jk-sage/30 mx-auto mb-4" />
              <p className="text-xl text-jk-charcoal/60 mb-4">No resourceful recipes found</p>
              <p className="text-base text-jk-charcoal/50 mb-6">
                We're currently analyzing our recipe collection for waste-reduction characteristics.
              </p>
              <Button asChild>
                <Link href="/recipes">Browse All Recipes</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Call-to-Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <Users className="h-12 w-12 text-jk-sage mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-heading text-jk-olive mb-4">
            Have Ingredients? Find Recipes
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Enter what's in your fridge and we'll show you recipes you can make right now — with
            substitutions for what's missing.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">What's in Your Fridge?</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
