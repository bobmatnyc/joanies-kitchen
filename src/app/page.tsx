import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, BookOpen, ShoppingCart, Calendar, Sparkles } from "lucide-react";
import { getSharedRecipes } from "@/app/actions/recipes";
import { SharedRecipeCarousel } from "@/components/recipe/SharedRecipeCarousel";

export default async function Home() {
  // Fetch shared recipes for carousel (limited to 15 for performance)
  const sharedRecipesResult = await getSharedRecipes();
  const sharedRecipes = sharedRecipesResult.success && sharedRecipesResult.data
    ? sharedRecipesResult.data.slice(0, 15)
    : [];
  return (
    <div className="min-h-screen">
      {/* Hero Section - Joanie's Kitchen */}
      <section className="bg-jk-olive text-jk-linen py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="flex justify-center mb-6">
            <ChefHat className="h-20 w-20 text-jk-sage" />
          </div>
          <h1 className="font-heading text-6xl md:text-7xl font-bold mb-4 text-jk-linen">
            Joanie's Kitchen
          </h1>
          <p className="font-body text-2xl md:text-3xl text-jk-sage italic mb-3">
            From Garden to Table — with Heart and Soil
          </p>
          <p className="font-ui text-lg text-jk-linen/90 max-w-2xl mx-auto mb-10">
            Celebrate cooking with the seasons. Your personal recipe collection and AI-powered kitchen companion.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/discover">
              <Button size="lg" className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium px-8 py-6 text-lg gap-2 rounded-jk">
                <Sparkles className="h-5 w-5" />
                Discover Recipes
              </Button>
            </Link>
            <Link href="/recipes">
              <Button size="lg" className="bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium px-8 py-6 text-lg rounded-jk">
                <BookOpen className="h-5 w-5 mr-2" />
                My Recipes
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        {/* Welcome Message */}
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="font-heading text-4xl text-jk-olive mb-4">Welcome to Your Kitchen</h2>
          <p className="font-body text-lg text-jk-charcoal/80">
            Whether you're bringing fresh ingredients from your garden or exploring new seasonal flavors,
            Joanie's Kitchen helps you create wholesome, delicious meals with warmth and authenticity.
          </p>
        </div>

        {/* Features Grid with Parchment Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Link href="/discover">
            <Card className="recipe-card h-full cursor-pointer border-jk-sage">
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

          <Link href="/recipes">
            <Card className="recipe-card h-full cursor-pointer border-jk-sage">
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

          <Link href="/recipes/new">
            <Card className="recipe-card h-full cursor-pointer border-jk-sage">
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

        {/* About Joanie Section */}
        <section className="mt-16 mb-16">
          <div className="jk-divider mb-12"></div>
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Joanie's Portrait */}
              <div className="relative">
                <div className="rounded-jk overflow-hidden border-4 border-jk-sage shadow-lg">
                  <img
                    src="/joanie-portrait.png"
                    alt="Joanie cooking in her kitchen with fresh vegetables"
                    className="w-full h-auto"
                    width={600}
                    height={800}
                  />
                </div>
                {/* Decorative accents */}
                <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-jk-tomato/10 rounded-full -z-10"></div>
                <div className="absolute -top-6 -left-6 w-24 h-24 bg-jk-sage/20 rounded-full -z-10"></div>
              </div>

              {/* About Text */}
              <div className="space-y-6">
                <h2 className="font-heading text-5xl text-jk-olive mb-6">
                  Meet Joanie
                </h2>

                <div className="space-y-4 text-jk-charcoal/80 font-body text-lg leading-relaxed">
                  <p>
                    Welcome to my kitchen! I'm Joanie, and I believe the best meals
                    start in the garden — with heart and soil.
                  </p>
                  <p>
                    For years, I've been celebrating the seasons through cooking,
                    transforming fresh ingredients into dishes that nourish both
                    body and soul. Every recipe here tells a story of connection —
                    to the earth, to tradition, and to the people gathered around
                    the table.
                  </p>
                  <p>
                    Whether you're sautéing garden-fresh greens or roasting
                    sun-ripened tomatoes, cooking is about more than following
                    instructions. It's about honoring the seasons, trusting your
                    hands, and making something beautiful from simple ingredients.
                  </p>

                  <blockquote className="border-l-4 border-jk-tomato pl-6 py-2 my-6 italic text-jk-clay text-xl">
                    "The garden teaches patience. The kitchen teaches creativity.
                    Together, they teach us to live well."
                  </blockquote>

                  <p className="font-heading text-2xl text-jk-olive mt-8">
                    Join me in celebrating cooking with the seasons.
                  </p>
                </div>

                <div className="flex gap-4 mt-8">
                  <Link href="/recipes">
                    <Button size="lg" className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium rounded-jk">
                      Explore Recipes
                    </Button>
                  </Link>
                  <Link href="/about">
                    <Button size="lg" variant="outline" className="border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui font-medium rounded-jk">
                      Read My Story
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Shared Recipe Carousel */}
        {sharedRecipes.length > 0 && (
          <div className="mt-16 mb-12">
            <div className="jk-divider mb-12"></div>
            <h2 className="font-heading text-4xl font-bold mb-4 text-center text-jk-olive">
              The Community Table
            </h2>
            <p className="font-body text-center text-jk-charcoal/70 mb-8 max-w-2xl mx-auto">
              Recipes shared with love from our community. Each dish tells a story of tradition, innovation, and the joy of cooking.
            </p>
            <SharedRecipeCarousel recipes={sharedRecipes} />
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-16 text-center">
          <div className="jk-divider mb-12"></div>
          <h2 className="font-heading text-4xl font-bold mb-4 text-jk-olive">Ready to Start Cooking?</h2>
          <p className="font-body text-lg text-jk-charcoal/70 mb-8 max-w-2xl mx-auto">
            Every great meal begins with inspiration. Choose your path and let's create something wonderful.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/discover">
              <Button size="lg" className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium rounded-jk">
                <Sparkles className="h-4 w-4 mr-2" />
                Discover New Recipe
              </Button>
            </Link>
            <Link href="/recipes/new">
              <Button size="lg" className="bg-jk-clay hover:bg-jk-clay/90 text-white font-ui font-medium rounded-jk">
                <ChefHat className="h-4 w-4 mr-2" />
                Add Recipe
              </Button>
            </Link>
            <Link href="/recipes">
              <Button size="lg" className="bg-jk-olive hover:bg-jk-olive/90 text-white font-ui font-medium rounded-jk">
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Collection
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}