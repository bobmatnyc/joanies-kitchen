/**
 * Joanie's Philosophy Page
 * Week 4 Task 5.3: Detailed explanation of Joanie's approach
 *
 * Her story, FIFO principles, garden-to-kitchen cycle, environmental connection
 */

import { Calendar, Heart, Home, Leaf } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Joanie's Philosophy | Joanie's Kitchen",
  description:
    "The story behind our zero-waste cooking platform. Learn about Joanie's approach to resourceful cooking, FIFO principles, and why technology should help with food waste.",
};

export default function PhilosophyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-green-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <Heart className="h-16 w-16 text-jk-tomato mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Joanie's Philosophy
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed italic">
            "I'd like to see technology help with food waste. That would be the highlight of my
            life."
          </p>
        </div>

        {/* The Story */}
        <div className="prose prose-lg max-w-none mb-12">
          <div className="bg-white rounded-2xl p-8 border-2 border-jk-sage/20">
            <h2 className="text-2xl font-heading text-jk-olive mb-4">
              The Story Behind This Platform
            </h2>
            <div className="space-y-4 text-base text-jk-charcoal/80 leading-relaxed">
              <p>
                <strong>Joanie</strong> doesn't cook from recipes. She cooks from her fridge. Every
                meal begins with the same question: <em>"What do I have that might go bad?"</em>
              </p>
              <p>
                This isn't about perfection or planning. It's about <strong>resourcefulness</strong>{' '}
                — seeing what you have as an opportunity, not a constraint. A wilting bunch of
                spinach becomes sautéed greens. Leftover chicken transforms into fried rice.
                Vegetable scraps simmer into rich stock.
              </p>
              <p>
                Joanie's approach comes from a lifetime of gardening, cooking, and caring about
                where food comes from and where it goes. She sees the connection between soil,
                plant, table, and compost. Nothing is wasted because everything has value.
              </p>
              <p>
                When she said, <em>"I'd like to see technology help with food waste,"</em> it wasn't
                a casual remark. It was a vision. This platform exists to embody that vision — to
                help you cook the way Joanie cooks, with flexibility, creativity, and zero waste.
              </p>
            </div>
          </div>
        </div>

        {/* Core Principles */}
        <div className="mb-12">
          <h2 className="text-3xl font-heading text-jk-olive mb-8 text-center">Core Principles</h2>
          <div className="space-y-6">
            {/* Principle 1: FIFO */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-2xl border-2 border-blue-200">
              <div className="flex items-start gap-4">
                <Calendar className="h-10 w-10 text-blue-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-heading text-jk-olive mb-3">
                    FIFO: First In, First Out
                  </h3>
                  <p className="text-base text-jk-charcoal/70 leading-relaxed mb-3">
                    The oldest ingredients get used first. It's that simple. Check your fridge
                    regularly, move older items to the front, and plan meals around what needs using
                    up.
                  </p>
                  <p className="text-base text-jk-charcoal/70 leading-relaxed">
                    <strong>In practice:</strong> That head of lettuce from Tuesday comes before the
                    one you bought Friday. The carrots starting to soften get roasted tonight. The
                    chicken from Monday's dinner becomes Wednesday's fried rice.
                  </p>
                </div>
              </div>
            </div>

            {/* Principle 2: Zero Waste */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-200">
              <div className="flex items-start gap-4">
                <Leaf className="h-10 w-10 text-green-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-heading text-jk-olive mb-3">
                    Zero Waste: Everything Finds a Home
                  </h3>
                  <p className="text-base text-jk-charcoal/70 leading-relaxed mb-3">
                    From wilting lettuce to vegetable scraps, everything has a use if you know where
                    to look. Sauté aging greens. Save veggie peels for stock. Compost what truly
                    can't be eaten.
                  </p>
                  <p className="text-base text-jk-charcoal/70 leading-relaxed">
                    <strong>In practice:</strong> Herb stems go into stock. Carrot tops become
                    pesto. Chicken bones simmer for broth. Overripe bananas get frozen for
                    smoothies. The goal isn't perfection — it's <em>progress</em>.
                  </p>
                </div>
              </div>
            </div>

            {/* Principle 3: Resourcefulness */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl border-2 border-amber-200">
              <div className="flex items-start gap-4">
                <Home className="h-10 w-10 text-amber-600 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-heading text-jk-olive mb-3">
                    Resourcefulness Over Perfection
                  </h3>
                  <p className="text-base text-jk-charcoal/70 leading-relaxed mb-3">
                    A "perfect" recipe that requires a shopping trip isn't better than an imperfect
                    one made with what you have. Substitutions aren't compromises — they're
                    creativity.
                  </p>
                  <p className="text-base text-jk-charcoal/70 leading-relaxed">
                    <strong>In practice:</strong> No butter? Use olive oil. No lemon? Try vinegar.
                    Missing an ingredient? Ask what it's contributing (acid? fat? bulk?) and swap
                    accordingly. Cooking becomes a conversation with your pantry, not obedience to a
                    recipe.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Garden to Kitchen Cycle */}
        <div className="bg-gradient-to-r from-jk-sage/10 to-green-100/50 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            🌱 Garden to Kitchen to Compost
          </h2>
          <p className="text-base text-jk-charcoal/70 leading-relaxed mb-4">
            Joanie's philosophy extends beyond the kitchen. She sees the full cycle:
          </p>
          <div className="space-y-3 text-base text-jk-charcoal/70">
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl flex-shrink-0">1.</span>
              <span>
                <strong>From the garden:</strong> Fresh vegetables, herbs, and understanding what's
                in season
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl flex-shrink-0">2.</span>
              <span>
                <strong>To the kitchen:</strong> Cook with what you have, use every part, waste
                nothing
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-600 text-xl flex-shrink-0">3.</span>
              <span>
                <strong>Back to the soil:</strong> Compost scraps, enrich the garden, start again
              </span>
            </div>
          </div>
          <p className="text-base text-jk-charcoal/70 leading-relaxed mt-4">
            This circular thinking — understanding that food comes from somewhere and returns
            somewhere — creates respect for ingredients and urgency about not wasting them.
          </p>
        </div>

        {/* Technology's Role */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">🖥️ Why Technology Matters</h2>
          <p className="text-base text-jk-charcoal/70 leading-relaxed mb-4">
            Most recipe platforms encourage <em>consumption</em>: browse beautiful photos, plan
            perfect meals, shop for specialty ingredients. That's the opposite of what Joanie does.
          </p>
          <p className="text-base text-jk-charcoal/70 leading-relaxed mb-4">
            This platform is different. It asks: <strong>"What do you have?"</strong> instead of
            "What do you want?" It suggests substitutions instead of demanding precision. It
            celebrates resourcefulness instead of perfection.
          </p>
          <p className="text-base text-jk-charcoal/70 leading-relaxed">
            Technology should help you waste less, cook with confidence, and see your fridge as full
            of possibilities — not obligations. That's what Joanie meant. That's what we're
            building.
          </p>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">Ready to Cook Like Joanie?</h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Start by telling us what's in your fridge. We'll show you recipes that work with what
            you have — with substitutions for what's missing.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">What's in Your Fridge?</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
