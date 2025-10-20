/**
 * Rescue Ingredients - Main Landing Page
 * Week 4 Task 5.2: Create "Rescue Ingredients" section
 *
 * Browse recipes by ingredient-to-rescue
 * Helps users find recipes that use aging/wilting ingredients before they go bad
 */

import Link from 'next/link';
import { Leaf, Carrot, Drumstick, Flower, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Rescue Ingredients | Joanie\'s Kitchen',
  description: 'What to do with ingredients about to go bad. Find recipes for wilting greens, aging vegetables, leftover proteins, and excess herbs.',
};

const ingredientCategories = [
  {
    slug: 'wilting-greens',
    name: 'Wilting Greens',
    icon: Leaf,
    description: 'Lettuce, spinach, kale, chard losing their crispness',
    examples: 'Lettuce, spinach, kale, arugula, chard, collards',
    color: 'from-green-100 to-emerald-100',
    borderColor: 'border-green-300',
    iconColor: 'text-green-600',
  },
  {
    slug: 'aging-vegetables',
    name: 'Aging Vegetables',
    icon: Carrot,
    description: 'Soft carrots, wrinkly peppers, overripe tomatoes',
    examples: 'Carrots, tomatoes, peppers, zucchini, eggplant, mushrooms',
    color: 'from-orange-100 to-amber-100',
    borderColor: 'border-orange-300',
    iconColor: 'text-orange-600',
  },
  {
    slug: 'leftover-proteins',
    name: 'Leftover Proteins',
    icon: Drumstick,
    description: 'Cooked chicken, beef, tofu that needs using up',
    examples: 'Rotisserie chicken, cooked beef, leftover tofu, beans',
    color: 'from-red-100 to-rose-100',
    borderColor: 'border-red-300',
    iconColor: 'text-red-600',
  },
  {
    slug: 'excess-herbs',
    name: 'Excess Herbs',
    icon: Flower,
    description: 'Fresh herbs starting to brown or wilt',
    examples: 'Cilantro, parsley, basil, dill, mint, thyme',
    color: 'from-lime-100 to-green-100',
    borderColor: 'border-lime-300',
    iconColor: 'text-lime-600',
  },
];

export default function RescuePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-green-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Page Header */}
        <div className="text-center mb-12">
          <AlertCircle className="h-14 w-14 text-jk-tomato mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Rescue Ingredients
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-3xl mx-auto leading-relaxed">
            What to do with ingredients about to go bad. Find techniques and recipes that help you
            <strong className="text-jk-tomato"> use them before you lose them</strong>.
          </p>
        </div>

        {/* FIFO Principle Callout */}
        <div className="bg-gradient-to-r from-jk-sage/10 to-green-100/50 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-heading text-jk-olive mb-3">
              📦 FIFO Principle
            </h2>
            <p className="text-lg text-jk-charcoal/80 font-body leading-relaxed mb-3">
              <strong>First In, First Out</strong> — Joanie's golden rule for zero waste.
            </p>
            <p className="text-base text-jk-charcoal/70 leading-relaxed">
              Check your fridge regularly. The oldest ingredients should be used first. This page helps you
              find recipes that work with what's aging, wilting, or about to expire.
            </p>
          </div>
        </div>

        {/* Browse by Category */}
        <div className="mb-12">
          <h2 className="text-3xl font-heading text-jk-olive mb-8 text-center">
            Browse by Ingredient Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ingredientCategories.map((category) => {
              const IconComponent = category.icon;
              return (
                <Link
                  key={category.slug}
                  href={`/rescue/${category.slug}`}
                  className="group"
                >
                  <div className={`bg-gradient-to-br ${category.color} p-8 rounded-2xl border-2 ${category.borderColor} hover:shadow-lg transition-all duration-200 hover:scale-[1.02]`}>
                    <div className="flex items-start gap-4">
                      <div className={`${category.iconColor} flex-shrink-0`}>
                        <IconComponent className="h-12 w-12" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-2xl font-heading text-jk-olive mb-2 group-hover:text-jk-clay transition-colors">
                          {category.name}
                        </h3>
                        <p className="text-base text-jk-charcoal/70 mb-3 leading-relaxed">
                          {category.description}
                        </p>
                        <p className="text-sm text-jk-charcoal/60 italic">
                          Examples: {category.examples}
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Tips Section */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-6 text-center">
            Quick Rescue Tips
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">🥬 Wilting Greens</h3>
              <ul className="space-y-2 text-base text-jk-charcoal/70">
                <li>• Sauté with garlic and olive oil</li>
                <li>• Add to soups or stews</li>
                <li>• Blend into smoothies or pesto</li>
                <li>• Freeze for future use</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">🥕 Aging Vegetables</h3>
              <ul className="space-y-2 text-base text-jk-charcoal/70">
                <li>• Roast at high heat for caramelization</li>
                <li>• Make into soup or sauce</li>
                <li>• Pickle or ferment</li>
                <li>• Freeze chopped for stocks</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">🍗 Leftover Proteins</h3>
              <ul className="space-y-2 text-base text-jk-charcoal/70">
                <li>• Shred for tacos, sandwiches, salads</li>
                <li>• Add to fried rice or pasta</li>
                <li>• Make soup or broth from bones</li>
                <li>• Freeze in portions for later</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">🌿 Excess Herbs</h3>
              <ul className="space-y-2 text-base text-jk-charcoal/70">
                <li>• Make pesto or herb butter</li>
                <li>• Dry for future use</li>
                <li>• Freeze in olive oil ice cubes</li>
                <li>• Add stems to stocks</li>
              </ul>
            </div>
          </div>
        </div>

        {/* When to Compost */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-8 border-2 border-amber-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4 text-center">
            ♻️ When to Compost vs. Use
          </h2>
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-heading text-green-700 mb-3">✓ Still Usable</h3>
                <ul className="space-y-2 text-base text-jk-charcoal/70">
                  <li>• Slightly wilted greens (sauté or blend)</li>
                  <li>• Soft carrots (roast or soup)</li>
                  <li>• Overripe tomatoes (sauce or salsa)</li>
                  <li>• Brown-edged herbs (trim and use)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-heading text-red-700 mb-3">✗ Time to Compost</h3>
                <ul className="space-y-2 text-jk-charcoal/70">
                  <li>• Slimy, moldy, or foul-smelling</li>
                  <li>• Completely brown/black</li>
                  <li>• Mushy beyond recognition</li>
                  <li>• Safety concerns (when in doubt, throw out)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
