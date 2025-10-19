import { Star, Trophy } from 'lucide-react';
import Link from 'next/link';
import { getTopRatedRecipes, getTotalRecipeCount } from '@/app/actions/recipes';
import { AnimatedRecipeBackground } from '@/components/recipes/AnimatedRecipeBackground';
import { Top50Tabs } from '@/components/recipes/Top50Tabs';
import { Button } from '@/components/ui/button';

/**
 * Top 50 Recipes Page - Server Component
 *
 * Displays the highest-rated recipes organized by category.
 * Features an animated background using top recipe images.
 */
export default async function Top50Page() {
  // Fetch all data server-side in parallel
  const [allRecipes, mainsRecipes, sidesRecipes, dessertsRecipes, totalRecipes] = await Promise.all([
    getTopRatedRecipes({ limit: 50, category: 'all' }),
    getTopRatedRecipes({ limit: 50, category: 'mains' }),
    getTopRatedRecipes({ limit: 50, category: 'sides' }),
    getTopRatedRecipes({ limit: 50, category: 'desserts' }),
    getTotalRecipeCount(),
  ]);

  // Extract images from top recipes for animated background
  const backgroundImages = allRecipes
    .filter((r) => {
      if (r.image_url) return true;
      if (r.images) {
        try {
          const parsed = JSON.parse(r.images as string);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch {
          return false;
        }
      }
      return false;
    })
    .slice(0, 12) // Use first 12 recipes with images
    .map((r) => {
      if (r.image_url) return r.image_url;
      try {
        const parsed = JSON.parse(r.images as string);
        return parsed[0];
      } catch {
        return '';
      }
    })
    .filter((img): img is string => Boolean(img)); // Remove empty strings

  // Calculate average rating
  const avgRating =
    allRecipes.length === 0
      ? 0
      : allRecipes.reduce((acc, recipe) => {
          const rating =
            parseFloat(recipe.system_rating || '0') ||
            parseFloat(recipe.avg_user_rating || '0') ||
            0;
          return acc + rating;
        }, 0) / allRecipes.length;

  return (
    <main className="relative min-h-screen bg-jk-linen">
      {/* Animated Background - Client Component */}
      <AnimatedRecipeBackground images={backgroundImages} />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-jk-olive to-jk-clay py-20">
        <div className="container mx-auto px-4 text-center">
          <Trophy className="h-16 w-16 text-jk-linen mx-auto mb-6" />
          <h1 className="text-5xl font-heading text-jk-linen mb-4">Top 50 Recipes</h1>
          <p className="text-xl text-jk-sage max-w-2xl mx-auto font-body">
            The cream of the crop—our highest-rated recipes, organized by category
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-jk-sage/20 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-center">
            <div>
              <div className="text-3xl font-heading text-jk-olive">{allRecipes.length}</div>
              <div className="text-sm text-jk-charcoal/60 font-ui">Top Recipes</div>
            </div>
            <div>
              <div className="text-3xl font-heading text-jk-olive">
                {avgRating > 0 ? avgRating.toFixed(1) : '—'}
              </div>
              <div className="text-sm text-jk-charcoal/60 font-ui">Average Rating</div>
            </div>
            <div>
              <div className="text-3xl font-heading text-jk-olive">
                {totalRecipes.toLocaleString()}+
              </div>
              <div className="text-sm text-jk-charcoal/60 font-ui">Total Recipes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Tabs - Client Component */}
      <div className="container mx-auto px-4 py-12">
        <Top50Tabs
          allRecipes={allRecipes}
          mainsRecipes={mainsRecipes}
          sidesRecipes={sidesRecipes}
          dessertsRecipes={dessertsRecipes}
        />
      </div>

      {/* CTA Section */}
      <div className="bg-jk-olive/5 border-t border-jk-sage/20 py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading text-jk-olive mb-4">Don't see your favorite?</h2>
          <p className="text-jk-charcoal/70 mb-6 max-w-xl mx-auto font-body">
            We're constantly adding new recipes. Rate the ones you try to help them climb the
            rankings!
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
