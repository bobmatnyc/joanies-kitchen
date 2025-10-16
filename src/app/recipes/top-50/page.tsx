import { Metadata } from 'next';
import { Trophy, Star, Award } from 'lucide-react';
import Link from 'next/link';
import { getTopRatedRecipes } from '@/app/actions/recipes';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const metadata: Metadata = {
  title: "Top 50 Recipes | Joanie's Kitchen",
  description: "The highest-rated recipes from our collection, hand-picked and AI-verified for quality",
};

export default async function Top50Page() {
  // Fetch top 50 recipes by rating (system + user ratings)
  const topRecipes = await getTopRatedRecipes({ limit: 50 });

  // Get total recipe count
  const [{ count: totalRecipes }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes);

  // Calculate stats
  const avgRating = topRecipes.length > 0
    ? topRecipes.reduce((acc, recipe) => {
        const rating = parseFloat(recipe.system_rating || '0') || parseFloat(recipe.avg_user_rating || '0') || 0;
        return acc + rating;
      }, 0) / topRecipes.length
    : 0;

  return (
    <main className="min-h-screen bg-jk-linen">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-jk-olive to-jk-clay py-20">
        <div className="container mx-auto px-4 text-center">
          <Trophy className="h-16 w-16 text-jk-linen mx-auto mb-6" />
          <h1 className="text-5xl font-heading text-jk-linen mb-4">
            Top 50 Recipes
          </h1>
          <p className="text-xl text-jk-sage max-w-2xl mx-auto font-body">
            The cream of the crop—our highest-rated recipes,
            curated by AI and loved by home cooks
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-jk-sage/20 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-heading text-jk-olive">
                {topRecipes.length}
              </div>
              <div className="text-sm text-jk-charcoal/60 font-ui">
                Top Recipes
              </div>
            </div>
            <div>
              <div className="text-3xl font-heading text-jk-olive">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </div>
              <div className="text-sm text-jk-charcoal/60 font-ui">
                Average Rating
              </div>
            </div>
            <div>
              <div className="text-3xl font-heading text-jk-olive">
                {totalRecipes.toLocaleString()}+
              </div>
              <div className="text-sm text-jk-charcoal/60 font-ui">
                Total Recipes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recipes Grid */}
      <div className="container mx-auto px-4 py-12">
        {topRecipes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {topRecipes.map((recipe, index) => (
              <div key={recipe.id} className="relative">
                {/* Rank Badge */}
                <div className="absolute -top-3 -left-3 z-10 bg-jk-tomato text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-lg">
                  {index + 1}
                </div>
                <RecipeCard recipe={recipe} />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Award className="h-16 w-16 text-jk-clay/40 mx-auto mb-4" />
            <p className="text-xl text-jk-charcoal/60 font-body">
              No top-rated recipes yet. Keep cooking!
            </p>
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-jk-olive/5 border-t border-jk-sage/20 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading text-jk-olive mb-4">
            Don't see your favorite?
          </h2>
          <p className="text-jk-charcoal/70 mb-6 max-w-xl mx-auto font-body">
            We're constantly adding new recipes. Rate the ones you try
            to help them climb the rankings!
          </p>
          <Link href="/shared">
            <Button className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium gap-2">
              <Star className="h-5 w-5" />
              Browse All Recipes
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
