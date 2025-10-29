import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  Leaf,
  Refrigerator,
  Search,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "How It Works | Joanie's Kitchen",
  description:
    "Learn how Joanie's Kitchen helps you reduce food waste by transforming fridge ingredients into delicious zero-waste recipes.",
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-jk-sage/10">
      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <Sparkles className="h-16 w-16 text-jk-olive mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">How It Works</h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-3xl mx-auto leading-relaxed">
            Transform your fridge into a zero-waste kitchen in three simple steps. No waste, no
            guilt, just delicious resourceful cooking.
          </p>
        </div>

        {/* Three-Step Process */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Step 1 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-jk-sage/20 hover:border-jk-olive/40 transition-all">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-jk-olive to-jk-sage rounded-full mb-6 mx-auto">
              <span className="text-3xl font-bold text-white">1</span>
            </div>
            <div className="flex justify-center mb-4">
              <Refrigerator className="h-12 w-12 text-jk-olive" />
            </div>
            <h2 className="text-2xl font-heading text-jk-olive mb-4 text-center">
              Tell Us What You Have
            </h2>
            <p className="text-jk-charcoal/70 font-body leading-relaxed text-center">
              Open your fridge and enter the ingredients you have on hand. Include those aging
              vegetables, leftover proteins, or wilting herbs you're not sure what to do with.
            </p>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-jk-sage/20 hover:border-jk-olive/40 transition-all">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-jk-olive to-jk-sage rounded-full mb-6 mx-auto">
              <span className="text-3xl font-bold text-white">2</span>
            </div>
            <div className="flex justify-center mb-4">
              <Search className="h-12 w-12 text-jk-olive" />
            </div>
            <h2 className="text-2xl font-heading text-jk-olive mb-4 text-center">
              Get Smart Matches
            </h2>
            <p className="text-jk-charcoal/70 font-body leading-relaxed text-center">
              Our system searches through thousands of recipes to find the best matches for your
              ingredients. We prioritize recipes where you already have most of what you need.
            </p>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-jk-sage/20 hover:border-jk-olive/40 transition-all">
            <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-jk-olive to-jk-sage rounded-full mb-6 mx-auto">
              <span className="text-3xl font-bold text-white">3</span>
            </div>
            <div className="flex justify-center mb-4">
              <ChefHat className="h-12 w-12 text-jk-olive" />
            </div>
            <h2 className="text-2xl font-heading text-jk-olive mb-4 text-center">
              Cook & Save Waste
            </h2>
            <p className="text-jk-charcoal/70 font-body leading-relaxed text-center">
              Choose a recipe and start cooking! Each recipe includes smart substitutions for
              missing ingredients, so you can make the most of what you have without extra shopping
              trips.
            </p>
          </div>
        </div>

        {/* Real Example Section */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-3xl p-8 md:p-12 mb-16 border-2 border-jk-olive/20">
          <h2 className="text-3xl font-heading text-jk-olive mb-8 text-center">See It In Action</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Left: Input Example */}
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="text-xl font-heading text-jk-olive mb-4 flex items-center gap-2">
                <Refrigerator className="h-6 w-6" />
                What You Enter
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-jk-charcoal/80">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Wilting spinach</span>
                </div>
                <div className="flex items-center gap-2 text-jk-charcoal/80">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Leftover chicken breast</span>
                </div>
                <div className="flex items-center gap-2 text-jk-charcoal/80">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Garlic</span>
                </div>
                <div className="flex items-center gap-2 text-jk-charcoal/80">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Parmesan cheese</span>
                </div>
                <div className="flex items-center gap-2 text-jk-charcoal/80">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span>Pasta</span>
                </div>
              </div>
            </div>

            {/* Right: Result Example */}
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="text-xl font-heading text-jk-olive mb-4 flex items-center gap-2">
                <ChefHat className="h-6 w-6" />
                What You Get
              </h3>
              <div className="space-y-4">
                <div className="border-l-4 border-jk-olive pl-4">
                  <div className="font-semibold text-jk-charcoal mb-1">
                    Creamy Spinach Chicken Pasta
                  </div>
                  <div className="text-sm text-jk-charcoal/60">
                    ✓ Uses 5/6 of your ingredients (83% match)
                  </div>
                </div>
                <div className="border-l-4 border-jk-sage pl-4">
                  <div className="font-semibold text-jk-charcoal mb-1">
                    Garlic Chicken with Wilted Greens
                  </div>
                  <div className="text-sm text-jk-charcoal/60">
                    ✓ Uses 4/5 of your ingredients (80% match)
                  </div>
                </div>
                <div className="border-l-4 border-jk-clay pl-4">
                  <div className="font-semibold text-jk-charcoal mb-1">
                    Chicken & Spinach Frittata
                  </div>
                  <div className="text-sm text-jk-charcoal/60">
                    ✓ Uses 3/5 of your ingredients (60% match)
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/fridge"
              className="inline-flex items-center gap-2 bg-jk-olive hover:bg-jk-olive/90 text-white px-8 py-4 rounded-full font-heading text-lg transition-all shadow-lg hover:shadow-xl"
            >
              Try It Now
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Key Features */}
        <div className="mb-16">
          <h2 className="text-3xl font-heading text-jk-olive mb-8 text-center">
            What Makes It Special
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Feature 1 */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-jk-sage/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Leaf className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-heading text-jk-olive mb-2">Zero-Waste Focus</h3>
                  <p className="text-jk-charcoal/70 font-body leading-relaxed">
                    Every recipe is curated with resourcefulness in mind. We help you use every
                    ingredient, reduce waste, and save money.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-jk-sage/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-heading text-jk-olive mb-2">Smart Substitutions</h3>
                  <p className="text-jk-charcoal/70 font-body leading-relaxed">
                    Missing an ingredient? Get instant suggestions for substitutes you likely
                    already have in your pantry.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-jk-sage/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <Search className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-heading text-jk-olive mb-2">Flexible Matching</h3>
                  <p className="text-jk-charcoal/70 font-body leading-relaxed">
                    Don't have all the ingredients? No problem. We'll still show you recipes you can
                    make with what you have.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="bg-white rounded-xl p-6 shadow-md border border-jk-sage/20">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <ShoppingBag className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-heading text-jk-olive mb-2">Reduce Shopping Trips</h3>
                  <p className="text-jk-charcoal/70 font-body leading-relaxed">
                    Cook with what you have instead of buying specialty ingredients you'll only use
                    once.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Philosophy Connection */}
        <div className="bg-gradient-to-br from-jk-clay/10 to-jk-sage/10 rounded-3xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-heading text-jk-olive mb-4">Rooted in Resourcefulness</h2>
          <p className="text-lg text-jk-charcoal/80 font-body max-w-3xl mx-auto leading-relaxed mb-6">
            This approach comes from decades of cooking wisdom: work with what you have, waste
            nothing, and let resourcefulness guide your creativity in the kitchen.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/philosophy"
              className="inline-flex items-center justify-center gap-2 bg-white hover:bg-jk-cream text-jk-olive px-6 py-3 rounded-full font-heading transition-all border-2 border-jk-olive/20"
            >
              Read Our Philosophy
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/fridge"
              className="inline-flex items-center justify-center gap-2 bg-jk-olive hover:bg-jk-olive/90 text-white px-6 py-3 rounded-full font-heading transition-all shadow-lg"
            >
              Start Cooking
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
