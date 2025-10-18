import { BookOpen, Calendar, ChefHat, ChevronRight, PlusCircle, Sparkles, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getBackgroundImages } from '@/app/actions/background-images';
import { getSharedRecipes, getTopRatedRecipes } from '@/app/actions/recipes';
import { HeroBackgroundSlideshow } from '@/components/hero/HeroBackgroundSlideshow';
import { MobileContainer, MobileSpacer } from '@/components/mobile';
import { RecipeCard } from '@/components/recipe/RecipeCard';
import { SharedRecipeCarousel } from '@/components/recipe/SharedRecipeCarousel';
import { VectorSearchBar } from '@/components/search/VectorSearchBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ISR: Revalidate homepage every 5 minutes
// Homepage shows dynamic data (shared recipes, top recipes, background images) but can be cached
export const revalidate = 300; // 5 minutes

export default async function Home() {
  // Parallel data fetching for improved performance
  // All three fetches are independent - no data dependencies
  const [sharedRecipesResult, topRecipesResult, backgroundImagesResult] = await Promise.allSettled([
    getSharedRecipes(),
    getTopRatedRecipes({ limit: 8 }),
    getBackgroundImages(),
  ]);

  // Extract data with fallbacks for failed promises
  const sharedRecipes =
    sharedRecipesResult.status === 'fulfilled' &&
    sharedRecipesResult.value.success &&
    sharedRecipesResult.value.data
      ? sharedRecipesResult.value.data.slice(0, 15)
      : [];

  const topRecipes = topRecipesResult.status === 'fulfilled' ? topRecipesResult.value : [];

  const backgroundImages =
    backgroundImagesResult.status === 'fulfilled' &&
    backgroundImagesResult.value.success &&
    backgroundImagesResult.value.data
      ? backgroundImagesResult.value.data
      : [];

  // Log errors (optional - helps with debugging)
  if (sharedRecipesResult.status === 'rejected') {
    console.error('[Homepage] Failed to fetch shared recipes:', sharedRecipesResult.reason);
  }
  if (topRecipesResult.status === 'rejected') {
    console.error('[Homepage] Failed to fetch top-rated recipes:', topRecipesResult.reason);
  }
  if (backgroundImagesResult.status === 'rejected') {
    console.error('[Homepage] Failed to fetch background images:', backgroundImagesResult.reason);
  }
  return (
    <div className="min-h-screen">
      {/* Hero Section - Joanie's Kitchen */}
      <section className="relative overflow-hidden bg-jk-olive text-jk-linen py-12 md:py-20">
        {/* Background Images Slideshow - Auto-discovered from /public/backgrounds/ */}
        <HeroBackgroundSlideshow
          images={backgroundImages}
          displayDuration={6000}
          fadeDuration={2000}
        />

        <MobileContainer maxWidth="xl" className="relative z-10 text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/ai-tomato-logo.png"
              alt="Joanie's Kitchen - AI Tomato Logo"
              width={120}
              height={120}
              priority
              className="h-28 w-28 object-contain"
            />
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-4 text-jk-linen">
            Joanie's Kitchen
          </h1>
          <p className="font-body text-xl sm:text-2xl md:text-3xl text-jk-sage italic mb-3">
            From Garden to Table — with Heart and Soil
          </p>
          <p className="font-ui text-base md:text-lg text-jk-linen/90 max-w-2xl mx-auto mb-8 md:mb-10 px-4">
            Celebrate cooking with the seasons. Your personal recipe collection and AI-powered
            kitchen companion.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium px-6 md:px-8 py-5 md:py-6 text-base md:text-lg gap-2 rounded-jk touch-target"
              asChild
            >
              <Link href="/discover">
                <Sparkles className="h-5 w-5" />
                Discover Recipes
              </Link>
            </Button>
            <Button
              size="lg"
              className="w-full sm:w-auto bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium px-6 md:px-8 py-5 md:py-6 text-base md:text-lg rounded-jk touch-target"
              asChild
            >
              <Link href="/recipes">
                <BookOpen className="h-5 w-5 mr-2" />
                My Recipes
              </Link>
            </Button>
          </div>
        </MobileContainer>
      </section>

      {/* Vector Search Section */}
      <section className="bg-gradient-to-b from-jk-sage/10 to-white py-8 md:py-12">
        <MobileContainer maxWidth="2xl">
          <VectorSearchBar />
        </MobileContainer>
      </section>

      {/* CTA Buttons Section */}
      <section className="bg-white py-6 md:py-8 border-b border-jk-sage/20">
        <MobileContainer maxWidth="xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Discover Recipes */}
            <Link href="/discover" className="block">
              <Card className="recipe-card h-full cursor-pointer border-2 border-jk-sage hover:border-jk-tomato hover:shadow-lg transition-all group">
                <CardContent className="flex flex-col items-center justify-center text-center p-8 md:p-10">
                  <div className="w-16 h-16 bg-jk-tomato/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-jk-tomato/20 transition-colors">
                    <Sparkles className="h-8 w-8 text-jk-tomato" />
                  </div>
                  <h3 className="font-heading text-xl md:text-2xl text-jk-olive mb-2 group-hover:text-jk-tomato transition-colors">
                    Discover Recipes
                  </h3>
                  <p className="text-sm text-jk-charcoal/70 font-ui">
                    Explore curated recipes from famous chefs and the community
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Plan Meals */}
            <Link href="/meals" className="block">
              <Card className="recipe-card h-full cursor-pointer border-2 border-jk-sage hover:border-jk-clay hover:shadow-lg transition-all group">
                <CardContent className="flex flex-col items-center justify-center text-center p-8 md:p-10">
                  <div className="w-16 h-16 bg-jk-clay/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-jk-clay/20 transition-colors">
                    <Calendar className="h-8 w-8 text-jk-clay" />
                  </div>
                  <h3 className="font-heading text-xl md:text-2xl text-jk-olive mb-2 group-hover:text-jk-clay transition-colors">
                    Plan Meals
                  </h3>
                  <p className="text-sm text-jk-charcoal/70 font-ui">
                    Create complete meals and generate shopping lists
                  </p>
                </CardContent>
              </Card>
            </Link>

            {/* Add Your Recipe */}
            <Link href="/recipes/new" className="block">
              <Card className="recipe-card h-full cursor-pointer border-2 border-jk-sage hover:border-jk-olive hover:shadow-lg transition-all group">
                <CardContent className="flex flex-col items-center justify-center text-center p-8 md:p-10">
                  <div className="w-16 h-16 bg-jk-olive/10 rounded-full flex items-center justify-center mb-4 group-hover:bg-jk-olive/20 transition-colors">
                    <PlusCircle className="h-8 w-8 text-jk-olive" />
                  </div>
                  <h3 className="font-heading text-xl md:text-2xl text-jk-olive mb-2 group-hover:text-jk-olive transition-colors">
                    Add Your Recipe
                  </h3>
                  <p className="text-sm text-jk-charcoal/70 font-ui">
                    Share your family treasures and personal creations
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </MobileContainer>
      </section>

      <MobileContainer className="py-12 md:py-16">
        {/* Welcome Message */}
        <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl text-jk-olive mb-4">
            Welcome to Your Kitchen
          </h2>
          <p className="font-body text-base md:text-lg text-jk-charcoal/80">
            Whether you're bringing fresh ingredients from your garden or exploring new seasonal
            flavors, Joanie's Kitchen helps you create wholesome, delicious meals with warmth and
            authenticity.
          </p>
        </div>

        <MobileSpacer size="sm" />

        {/* Top Recipes Preview */}
        {topRecipes.length > 0 && (
          <section className="mt-12 md:mt-16 mb-12 md:mb-16">
            <div className="jk-divider mb-8 md:mb-12"></div>
            <div className="text-center mb-8 md:mb-12">
              <Trophy className="h-10 w-10 md:h-12 md:w-12 text-jk-tomato mx-auto mb-4" />
              <h2 className="text-3xl md:text-4xl font-heading text-jk-olive mb-3 md:mb-4">
                Top-Rated Recipes
              </h2>
              <p className="text-base md:text-xl text-jk-charcoal/70 max-w-2xl mx-auto font-body px-4">
                Our most beloved recipes, tried, tested, and highly rated
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
              {topRecipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>

            <div className="text-center">
              <Button
                className="bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium gap-2 touch-target"
                asChild
              >
                <Link href="/recipes/top-50">
                  View All Top 50 Recipes
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* About Joanie Section */}
        <section className="mt-12 md:mt-16 mb-12 md:mb-16">
          <div className="jk-divider mb-8 md:mb-12"></div>
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Joanie's Portrait */}
              <div className="relative">
                <div className="rounded-jk overflow-hidden border-4 border-jk-sage shadow-lg">
                  <Image
                    src="/joanie-portrait.png"
                    alt="Joanie cooking in her kitchen with fresh vegetables"
                    width={600}
                    height={800}
                    priority
                    quality={85}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                    className="w-full h-auto"
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAFCAYAAABirU3bAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAM0lEQVR4nGNgYGD4z8DAwMDIwMDwn4GB4T8jIyPDfwYGhv+MjIwM/xkZGRn+MzIyMvwHAAZPAwf0XmANAAAAAElFTkSuQmCC"
                  />
                </div>
                {/* Decorative accents */}
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-jk-tomato/10 rounded-full -z-10"></div>
                <div className="absolute -top-6 -left-6 w-24 h-24 bg-jk-sage/20 rounded-full -z-10"></div>
              </div>

              {/* About Text */}
              <div className="space-y-4 md:space-y-6">
                <h2 className="font-heading text-4xl md:text-5xl text-jk-olive mb-4 md:mb-6">
                  About Joanie
                </h2>

                <div className="space-y-3 md:space-y-4 text-jk-charcoal/80 font-body text-base md:text-lg leading-relaxed">
                  <p>
                    Joanie grew up in upstate New York helping her dad in his children's clothing
                    shop — and she's been mixing creativity with hard work ever since. After a
                    career in finance in London and New York, she followed her heart back to the
                    kitchen and the garden.
                  </p>
                  <p>
                    A trained chef, lifelong gardener, and volunteer firefighter in
                    Hastings-on-Hudson, Joanie now cooks from her terraced home overlooking the
                    Hudson River, where she grows everything from shiso to figs — and turns "nothing
                    in the fridge" into something unforgettable.
                  </p>

                  <p className="text-jk-clay font-medium text-lg mt-6">
                    Follow her garden at{' '}
                    <a
                      href="https://www.instagram.com/terracesonward/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-jk-tomato hover:text-jk-tomato/80 underline"
                    >
                      @terracesonward
                    </a>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mt-6 md:mt-8">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium rounded-jk touch-target"
                    asChild
                  >
                    <Link href="/about">Read My Story</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui font-medium rounded-jk touch-target"
                    asChild
                  >
                    <Link href="/recipes">Explore Recipes</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Shared Recipe Carousel */}
        {sharedRecipes.length > 0 && (
          <div className="mt-12 md:mt-16 mb-8 md:mb-12">
            <div className="jk-divider mb-8 md:mb-12"></div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-center text-jk-olive">
              The Community Table
            </h2>
            <p className="font-body text-center text-base md:text-lg text-jk-charcoal/70 mb-6 md:mb-8 max-w-2xl mx-auto px-4">
              Recipes shared with love from our community. Each dish tells a story of tradition,
              innovation, and the joy of cooking.
            </p>
            <SharedRecipeCarousel recipes={sharedRecipes} />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-12 md:mt-16 text-center">
          <div className="jk-divider mb-8 md:mb-12"></div>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-jk-olive">
            Ready to Start Cooking?
          </h2>
          <p className="font-body text-base md:text-lg text-jk-charcoal/70 mb-6 md:mb-8 max-w-2xl mx-auto px-4">
            Every great meal begins with inspiration. Choose your path and let's create something
            wonderful.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium rounded-jk touch-target"
              asChild
            >
              <Link href="/discover">
                <Sparkles className="h-4 w-4 mr-2" />
                Discover New Recipe
              </Link>
            </Button>
            <Button
              size="lg"
              className="w-full sm:w-auto bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium rounded-jk touch-target"
              asChild
            >
              <Link href="/recipes/new">
                <ChefHat className="h-4 w-4 mr-2" />
                Add Recipe
              </Link>
            </Button>
            <Button
              size="lg"
              className="w-full sm:w-auto bg-jk-olive hover:bg-jk-olive/90 text-white font-ui font-medium rounded-jk touch-target"
              asChild
            >
              <Link href="/recipes">
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Collection
              </Link>
            </Button>
          </div>
        </div>
      </MobileContainer>
    </div>
  );
}
