import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, BookOpen, ShoppingCart, Calendar, Sparkles, Trophy, ChevronRight } from "lucide-react";
import { getSharedRecipes, getTopRatedRecipes } from "@/app/actions/recipes";
import { SharedRecipeCarousel } from "@/components/recipe/SharedRecipeCarousel";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { MobileContainer, MobileSpacer } from "@/components/mobile";

export default async function Home() {
  // Fetch recipes with error handling for production
  let sharedRecipes: any[] = [];
  let topRecipes: any[] = [];

  try {
    const sharedRecipesResult = await getSharedRecipes();
    sharedRecipes = sharedRecipesResult.success && sharedRecipesResult.data
      ? sharedRecipesResult.data.slice(0, 15)
      : [];
  } catch (error) {
    console.error('[Homepage] Failed to fetch shared recipes:', error);
  }

  try {
    topRecipes = await getTopRatedRecipes({ limit: 8 });
  } catch (error) {
    console.error('[Homepage] Failed to fetch top-rated recipes:', error);
  }
  return (
    <div className="min-h-screen">
      {/* Hero Section - Joanie's Kitchen */}
      <section className="relative overflow-hidden bg-jk-olive text-jk-linen py-12 md:py-20">
        {/* Animated Background Images - Crossfade */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Textured illustration - left side, crossfading */}
          <div className="absolute -left-20 top-0 w-1/2 h-full animate-hero-crossfade-1 animate-float-slow">
            <Image
              src="https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/hero/background-textured.png"
              alt=""
              fill
              className="object-cover object-left animate-rotate-slow"
              priority
            />
          </div>

          {/* Watercolor illustration - right side, crossfading */}
          <div className="absolute -right-20 bottom-0 w-1/2 h-full animate-hero-crossfade-2 animate-float-slower">
            <Image
              src="https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/hero/background-watercolor.png"
              alt=""
              fill
              className="object-cover object-right animate-rotate-slower"
              priority
            />
          </div>
        </div>

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
            Celebrate cooking with the seasons. Your personal recipe collection and AI-powered kitchen companion.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4">
            <Button size="lg" className="w-full sm:w-auto bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium px-6 md:px-8 py-5 md:py-6 text-base md:text-lg gap-2 rounded-jk touch-target" asChild>
              <Link href="/discover">
                <Sparkles className="h-5 w-5" />
                Discover Recipes
              </Link>
            </Button>
            <Button size="lg" className="w-full sm:w-auto bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium px-6 md:px-8 py-5 md:py-6 text-base md:text-lg rounded-jk touch-target" asChild>
              <Link href="/recipes">
                <BookOpen className="h-5 w-5 mr-2" />
                My Recipes
              </Link>
            </Button>
          </div>
        </MobileContainer>
      </section>

      <MobileContainer className="py-12 md:py-16">
        {/* Welcome Message */}
        <div className="text-center mb-12 md:mb-16 max-w-3xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl text-jk-olive mb-4">Welcome to Your Kitchen</h2>
          <p className="font-body text-base md:text-lg text-jk-charcoal/80">
            Whether you're bringing fresh ingredients from your garden or exploring new seasonal flavors,
            Joanie's Kitchen helps you create wholesome, delicious meals with warmth and authenticity.
          </p>
        </div>

        <MobileSpacer size="sm" />

        {/* Features Grid with Parchment Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
          <Link href="/discover" className="block h-full">
            <Card className="recipe-card h-full cursor-pointer border-jk-sage hover:shadow-lg transition-shadow">
              <CardHeader>
                <Sparkles className="h-8 w-8 text-jk-tomato mb-2" />
                <CardTitle className="font-heading text-jk-olive">Seasonal Discovery</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="font-body text-jk-charcoal/70">
                  Discover recipes that celebrate what's fresh and in season. Let our AI guide you to wholesome, flavorful meals.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/recipes" className="block h-full">
            <Card className="recipe-card h-full cursor-pointer border-jk-sage hover:shadow-lg transition-shadow">
              <CardHeader>
                <BookOpen className="h-8 w-8 text-jk-clay mb-2" />
                <CardTitle className="font-heading text-jk-olive">Your Recipe Garden</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="font-body text-jk-charcoal/70">
                  Nurture your collection of cherished recipes. Browse, organize, and tend to your culinary favorites.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/recipes/new" className="block h-full">
            <Card className="recipe-card h-full cursor-pointer border-jk-sage hover:shadow-lg transition-shadow">
              <CardHeader>
                <ChefHat className="h-8 w-8 text-jk-olive mb-2" />
                <CardTitle className="font-heading text-jk-olive">Plant a Recipe</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="font-body text-jk-charcoal/70">
                  Add your family treasures and personal creations. Each recipe is a seed for delicious memories.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>

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
              {topRecipes.map((recipe, index) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  showRank={index + 1}
                />
              ))}
            </div>

            <div className="text-center">
              <Button className="bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium gap-2 touch-target" asChild>
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
                    Joanie grew up in upstate New York helping her dad in his children's
                    clothing shop — and she's been mixing creativity with hard work ever
                    since. After a career in finance in London and New York, she followed
                    her heart back to the kitchen and the garden.
                  </p>
                  <p>
                    A trained chef, lifelong gardener, and volunteer firefighter in
                    Hastings-on-Hudson, Joanie now cooks from her terraced home
                    overlooking the Hudson River, where she grows everything from shiso
                    to figs — and turns "nothing in the fridge" into something
                    unforgettable.
                  </p>

                  <p className="text-jk-clay font-medium text-lg mt-6">
                    Follow her garden at{" "}
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
                  <Button size="lg" className="w-full sm:w-auto bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium rounded-jk touch-target" asChild>
                    <Link href="/about">
                      Read My Story
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui font-medium rounded-jk touch-target" asChild>
                    <Link href="/recipes">
                      Explore Recipes
                    </Link>
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
              Recipes shared with love from our community. Each dish tells a story of tradition, innovation, and the joy of cooking.
            </p>
            <SharedRecipeCarousel recipes={sharedRecipes} />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-12 md:mt-16 text-center">
          <div className="jk-divider mb-8 md:mb-12"></div>
          <h2 className="font-heading text-3xl md:text-4xl font-bold mb-3 md:mb-4 text-jk-olive">Ready to Start Cooking?</h2>
          <p className="font-body text-base md:text-lg text-jk-charcoal/70 mb-6 md:mb-8 max-w-2xl mx-auto px-4">
            Every great meal begins with inspiration. Choose your path and let's create something wonderful.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 md:gap-4">
            <Button size="lg" className="w-full sm:w-auto bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium rounded-jk touch-target" asChild>
              <Link href="/discover">
                <Sparkles className="h-4 w-4 mr-2" />
                Discover New Recipe
              </Link>
            </Button>
            <Button size="lg" className="w-full sm:w-auto bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium rounded-jk touch-target" asChild>
              <Link href="/recipes/new">
                <ChefHat className="h-4 w-4 mr-2" />
                Add Recipe
              </Link>
            </Button>
            <Button size="lg" className="w-full sm:w-auto bg-jk-olive hover:bg-jk-olive/90 text-white font-ui font-medium rounded-jk touch-target" asChild>
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