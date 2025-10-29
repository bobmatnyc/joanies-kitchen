/**
 * Rescue: Aging Vegetables Page
 * Week 4 Task 5.2: Rescue ingredient category page
 *
 * Techniques for using soft carrots, wrinkly peppers, overripe tomatoes
 */

import { AlertCircle, Carrot, Leaf } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Rescue Aging Vegetables | Joanie's Kitchen",
  description:
    "Don't throw out soft carrots, wrinkly peppers, or overripe tomatoes. Learn rescue techniques, storage tips, and when vegetables are truly past saving.",
};

export default function AgingVegetablesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-orange-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <Carrot className="h-16 w-16 text-orange-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Rescue Aging Vegetables
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            Soft carrots, wrinkly peppers, and overripe tomatoes aren't trash — they're dinner.
            Here's how to rescue them before they cross the line.
          </p>
        </div>

        {/* When to Use vs. Compost */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Still Good */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-300">
            <div className="flex items-center gap-3 mb-4">
              <Leaf className="h-8 w-8 text-green-600" />
              <h2 className="text-xl font-heading text-jk-olive">Still Good to Cook</h2>
            </div>
            <ul className="space-y-2 text-base text-jk-charcoal/70">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Soft/bendy carrots</strong> - Lost crispness but not moldy
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Wrinkly peppers</strong> - Skin shriveled but firm flesh
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Very ripe tomatoes</strong> - Super soft but no mold
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Sprouting potatoes/onions</strong> - Cut off sprouts, use rest
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Soft zucchini/squash</strong> - Slightly mushy but no slime
                </span>
              </li>
            </ul>
          </div>

          {/* Time to Compost */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-2xl border-2 border-red-300">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <h2 className="text-xl font-heading text-jk-olive">Time to Compost</h2>
            </div>
            <ul className="space-y-2 text-base text-jk-charcoal/70">
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Mold or fuzzy spots</strong> - Even small patches
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Slimy texture</strong> - Decomposition has started
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Foul smell</strong> - Sour, rotten, or off odors
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Completely mushy</strong> - Collapses when touched
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Dark/black soft spots</strong> - Internal rot
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Rescue Techniques */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            4 Quick Ways to Rescue Aging Vegetables
          </h2>

          <div className="space-y-6">
            {/* Technique 1 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Roast at High Heat
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                High-heat roasting (425°F) concentrates flavors and caramelizes natural sugars,
                turning soft vegetables into sweet, crispy bites.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Soft carrots, wrinkly peppers, aging squash, slightly
                mushy zucchini
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Chop into 1-inch pieces, toss with olive oil, salt, pepper.
                Roast 25-35 minutes, stirring halfway.
              </p>
            </div>

            {/* Technique 2 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  2
                </span>
                Make Fresh Tomato Sauce or Salsa
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Overripe tomatoes are perfect for sauce — they're already soft and sweet. Simmer
                with garlic, basil, and olive oil for 20 minutes.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Very soft tomatoes, split tomatoes, bruised tomatoes
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Roughly chop, cook with olive oil and garlic until broken
                down. Season with salt, pepper, herbs. Freezes well.
              </p>
            </div>

            {/* Technique 3 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  3
                </span>
                Add to Soup or Stew
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Soft vegetables break down beautifully in soups and stews, adding body, nutrition,
                and flavor without needing perfect texture.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Soft carrots, celery, onions, peppers, potatoes, any
                aging vegetable
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Chop roughly, add to broth with aromatics. Simmer until
                tender. Blend for smooth soup or leave chunky.
              </p>
            </div>

            {/* Technique 4 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  4
                </span>
                Quick-Pickle
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Wrinkly peppers, soft carrots, and aging cucumbers get a second life in vinegar
                brine. Quick-pickles are ready in 1 hour and perfect for aging vegetables. (Note:
                Traditional pickling requires very fresh vegetables.)
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Wrinkly peppers, soft carrots, aging cucumbers, onions
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Heat equal parts vinegar and water with sugar and salt. Pour
                over sliced vegetables. Refrigerate 1+ hours. Vinegar and water ratios can vary by
                preference.
              </p>
            </div>
          </div>
        </div>

        {/* Storage Tips */}
        <div className="bg-gradient-to-r from-jk-sage/10 to-blue-100/50 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            📦 Storage Tips to Slow Aging
          </h2>
          <div className="space-y-3 text-base text-jk-charcoal/70">
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Carrots:</strong> Remove tops immediately. Wash and peel before storing.
                Store submerged horizontally in water in Tupperware in the fridge (not upright like
                flowers). Ready to use immediately.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Peppers:</strong> Keep dry in crisper drawer. Use wrinkly ones first. Don't
                wash until ready to use.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Tomatoes:</strong> Store on counter until ripe, then fridge to slow further
                ripening (or use immediately)
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Potatoes/Onions:</strong> Cool, dark, dry place. Remove sprouts promptly.
                Never store together (ethylene gas)
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Summer Squash (Zucchini, soft squash):</strong> Refrigerate in loose plastic
                bag with paper towel to absorb moisture
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Winter Squash (Pumpkin, acorn, butternut, spaghetti):</strong> Store with
                potatoes/onions (NOT refrigerated). Hard squash lasts weeks-months at room
                temperature.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Delicata Squash:</strong> Special case - looks hard but refrigerate like
                summer squash. Cook immediately, never let age.
              </span>
            </div>
          </div>
        </div>

        {/* Common Aging Vegetables */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-8 mb-12 border-2 border-amber-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">🥕 Common Aging Vegetables</h2>
          <p className="text-base text-jk-charcoal/70 mb-4 leading-relaxed">
            These vegetables often start to age before you use them, but they're easy to rescue:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-jk-charcoal/70">
            <div className="bg-white rounded-lg p-3 border border-amber-200">Carrots</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Bell Peppers</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Tomatoes</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Potatoes</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Onions</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Celery</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Zucchini</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Squash</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Cucumbers</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Broccoli</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Cauliflower</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Eggplant</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            Find Recipes for Your Aging Vegetables
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Enter your soft carrots, wrinkly peppers, or overripe tomatoes into our fridge search.
            We'll show you flexible recipes that work with what you have.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">Search Your Fridge</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
