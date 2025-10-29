/**
 * Rescue Wilting Greens
 * Week 4 Task 5.2: Ingredient-specific rescue page
 *
 * What to do with lettuce, spinach, kale, and other greens starting to wilt
 */

import { ArrowRight, ChevronLeft, Leaf } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Rescue Wilting Greens | Joanie's Kitchen",
  description:
    'What to do with lettuce, spinach, kale, and greens that are starting to wilt. Techniques, recipes, and storage tips.',
};

export default function WiltingGreensPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Breadcrumb */}
        <Link
          href="/rescue"
          className="inline-flex items-center gap-2 text-jk-sage hover:text-jk-olive transition-colors mb-8"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Back to Rescue Ingredients</span>
        </Link>

        {/* Page Header */}
        <div className="text-center mb-12">
          <Leaf className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">Wilting Greens</h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            Lettuce losing crispness? Spinach starting to wilt? Kale looking sad?
            <strong className="text-green-700"> Here's how to rescue them</strong>.
          </p>
        </div>

        {/* When to Use vs. Compost */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-6 rounded-xl border-2 border-green-300">
            <h2 className="text-xl font-heading text-green-800 mb-4">✓ Still Usable</h2>
            <ul className="space-y-2 text-base text-jk-charcoal/80">
              <li>• Slightly wilted but firm</li>
              <li>• No brown or slimy spots</li>
              <li>• Still has color (not yellowed)</li>
              <li>• Smells fresh, not sour</li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-red-100 to-orange-100 p-6 rounded-xl border-2 border-red-300">
            <h2 className="text-xl font-heading text-red-800 mb-4">✗ Time to Compost</h2>
            <ul className="space-y-2 text-base text-jk-charcoal/80">
              <li>• Slimy or moldy</li>
              <li>• Completely brown or black</li>
              <li>• Foul or sour smell</li>
              <li>• Mushy beyond saving</li>
            </ul>
          </div>
        </div>

        {/* Quick Rescue Techniques */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-green-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            4 Quick Ways to Rescue Wilting Greens
          </h2>

          <div className="space-y-6">
            {/* Technique 1 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Sauté with Garlic & Olive Oil
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10">
                Heat olive oil in a pan, add minced garlic, toss in greens and cook until just
                wilted (2-3 minutes). Season with salt, pepper, and lemon juice. Works for spinach,
                kale, chard, collards.
              </p>
            </div>

            {/* Technique 2 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  2
                </span>
                Add to Soups or Stews
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10">
                Chop greens and stir into soups, stews, or pasta dishes in the last 5 minutes of
                cooking. They'll wilt down and add nutrients without being the star ingredient.
              </p>
            </div>

            {/* Technique 3 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  3
                </span>
                Blend into Smoothies or Pesto
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10">
                Slightly wilted greens blend perfectly into smoothies (you won't taste them!) or can
                be made into pesto with olive oil, garlic, nuts, and parmesan.
              </p>
            </div>

            {/* Technique 4 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  4
                </span>
                Freeze for Future Use
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10">
                Wash, dry, and chop greens. Freeze in bags or ice cube trays with a bit of
                water/oil. Perfect for adding to cooked dishes later. Texture won't be crisp, but
                nutrients remain.
              </p>
            </div>
          </div>
        </div>

        {/* Storage Tips */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-8 mb-12 border-2 border-blue-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            📦 Storage Tips to Extend Life
          </h2>
          <ul className="space-y-3 text-base text-jk-charcoal/70 leading-relaxed">
            <li className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">•</span>
              <span>
                <strong>Wrap in damp paper towels:</strong> Keeps greens hydrated without getting
                slimy
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">•</span>
              <span>
                <strong>Store in airtight containers:</strong> Prevents moisture loss and keeps them
                fresh longer
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">•</span>
              <span>
                <strong>Remove damaged leaves:</strong> One bad leaf spoils the bunch — toss
                wilted/brown leaves immediately
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">•</span>
              <span>
                <strong>Don't wash until ready to use:</strong> Excess moisture speeds up decay
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">•</span>
              <span>
                <strong>Ice bath revival:</strong> Submerge wilted greens in ice water for 15
                minutes to crisp them back up
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">•</span>
              <span>
                <strong>Dress salads at the table:</strong> Undressed greens last longer in the
                fridge. Once dressed, greens degrade much faster (exception: kale can be dressed
                ahead and even turned into relish)
              </span>
            </li>
          </ul>
        </div>

        {/* Example Greens */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-green-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">Common Greens to Rescue</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              'Lettuce (romaine, butter, leaf)',
              'Spinach (baby, mature)',
              'Kale (curly, lacinato)',
              'Arugula',
              'Swiss Chard',
              'Collard Greens',
              'Bok Choy',
              'Mustard Greens',
              'Beet Greens',
            ].map((green) => (
              <div
                key={green}
                className="bg-green-50 px-4 py-3 rounded-lg border border-green-200 text-sm text-jk-charcoal/80"
              >
                {green}
              </div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-sage/10 to-green-100/50 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">Ready to Cook?</h2>
          <p className="text-base text-jk-charcoal/70 mb-6">
            Find recipes that use wilting greens and other ingredients you have on hand
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">
              What's in Your Fridge? <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
