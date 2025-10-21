/**
 * Rescue: Excess Herbs Page
 * Week 4 Task 5.2: Rescue ingredient category page
 *
 * Techniques for using wilting cilantro, parsley, basil, etc.
 */

import { Sprout, Leaf, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Rescue Excess Herbs | Joanie\'s Kitchen',
  description: 'Don\'t let fresh herbs go to waste. Learn techniques for using wilting cilantro, parsley, basil, and more before they turn slimy.',
};

export default function ExcessHerbsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-green-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Page Header */}
        <div className="text-center mb-12">
          <Sprout className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Rescue Excess Herbs
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            Fresh herbs are expensive and wilt fast. Here's how to use every last leaf of cilantro, parsley,
            basil, and more before they turn to mush.
          </p>
        </div>

        {/* When to Use vs. Compost */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Still Good */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-300">
            <div className="flex items-center gap-3 mb-4">
              <Leaf className="h-8 w-8 text-green-600" />
              <h2 className="text-xl font-heading text-jk-olive">Still Good to Use</h2>
            </div>
            <ul className="space-y-2 text-base text-jk-charcoal/70">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span><strong>Slightly wilted</strong> - Lost some perkiness but still green</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span><strong>Brown edges/tips</strong> - Just trim off discolored parts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span><strong>Dried out stems</strong> - Focus on the leaves, discard stems</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span><strong>Faded color</strong> - Flavor may be reduced but still usable</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span><strong>Day before "bad"</strong> - Use immediately in cooked dishes</span>
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
                <span><strong>Slimy or mushy</strong> - Decomposition has started</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span><strong>Black or dark brown</strong> - Fully rotted leaves</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span><strong>Moldy or fuzzy</strong> - Bacterial/fungal growth</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span><strong>Foul smell</strong> - Sour or rotten odor</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span><strong>Completely dried out</strong> - Brittle, no moisture left</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Rescue Techniques */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            4 Quick Ways to Rescue Excess Herbs
          </h2>

          <div className="space-y-6">
            {/* Technique 1 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">1</span>
                Make Herb Pesto or Sauce
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Blend herbs with olive oil, nuts (pine nuts, walnuts, almonds), garlic, and parmesan.
                Works with almost any herb — basil, cilantro, parsley, arugula, even carrot tops.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Basil, cilantro, parsley, arugula, mint, any soft herb
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Blend 2 cups herbs + ½ cup olive oil + ⅓ cup nuts + 2 garlic cloves + ½ cup cheese + salt. Freezes beautifully.
              </p>
            </div>

            {/* Technique 2 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">2</span>
                Freeze in Ice Cube Trays with Oil or Butter
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Chop herbs finely, pack into ice cube trays, cover with olive oil or melted butter, and freeze.
                Pop out cubes directly into soups, sautés, or pasta for instant flavor.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Parsley, cilantro, dill, thyme, rosemary, oregano
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Chop herbs. Fill ice cube tray ⅔ full. Top with oil/butter. Freeze. Store cubes in freezer bag for 6+ months.
              </p>
            </div>

            {/* Technique 3 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">3</span>
                Add to Soups, Stews, or Stocks
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Throw whole stems (yes, stems!) into simmering soups, stews, or stocks.
                Herb stems have tons of flavor. Strain them out before serving or leave in for rustic dishes.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Parsley, cilantro, thyme, rosemary, dill, bay leaves
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Add herb stems/sprigs to simmering liquid. Cook 15-30 minutes. Strain or leave in. Flavor infuses beautifully.
              </p>
            </div>

            {/* Technique 4 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-green-100 text-green-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">4</span>
                Make Herb Butter or Compound Butter
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Mix softened butter with finely chopped herbs, garlic, lemon zest, and salt.
                Roll into a log, wrap in plastic, and freeze. Slice off pats to use on bread, vegetables, or steak.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Parsley, chives, dill, thyme, rosemary, tarragon
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Mix 1 stick softened butter + ¼ cup minced herbs + garlic/lemon zest + salt. Roll in parchment. Freeze up to 3 months.
              </p>
            </div>
          </div>
        </div>

        {/* Storage Tips */}
        <div className="bg-gradient-to-r from-jk-sage/10 to-blue-100/50 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            🌿 Storage Tips to Keep Herbs Fresh Longer
          </h2>
          <div className="space-y-3 text-base text-jk-charcoal/70">
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span><strong>Tender herbs (basil, cilantro, parsley):</strong> Trim stems, place in glass of water like flowers. Cover loosely with plastic bag. Refrigerate.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span><strong>Hardy herbs (thyme, rosemary, oregano):</strong> Wrap in damp paper towel, store in plastic bag in fridge.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span><strong>Basil exception:</strong> Keep basil at room temperature (like tomatoes). Cold fridge turns it black.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span><strong>Don't wash until using:</strong> Moisture speeds decay. Wash right before use.</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span><strong>Buy it the way you want to buy it:</strong> If you plan to freeze or dry herbs, buying in bulk makes sense. But don't buy fresh in bulk unless you'll use it fresh in bulk.</span>
            </div>
          </div>
        </div>

        {/* Common Fresh Herbs */}
        <div className="bg-gradient-to-br from-lime-50 to-green-50 rounded-2xl p-8 mb-12 border-2 border-lime-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            🌱 Common Fresh Herbs
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-4 leading-relaxed">
            These herbs wilt quickly and are often wasted. Use these rescue techniques before they turn slimy:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-jk-charcoal/70">
            <div className="bg-white rounded-lg p-3 border border-lime-200">Basil</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Cilantro</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Parsley</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Dill</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Mint</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Chives</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Thyme</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Rosemary</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Oregano</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Sage</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Tarragon</div>
            <div className="bg-white rounded-lg p-3 border border-lime-200">Arugula</div>
          </div>
        </div>

        {/* Herb-Specific Tips */}
        <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-8 mb-12 border-2 border-teal-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            💡 Herb-Specific Rescue Ideas
          </h2>
          <div className="space-y-4 text-base text-jk-charcoal/70">
            <div>
              <h3 className="font-heading text-jk-clay mb-1">Basil</h3>
              <p className="text-sm">Pesto (classic), caprese salad, blend into tomato sauce, infuse into olive oil</p>
            </div>
            <div>
              <h3 className="font-heading text-jk-clay mb-1">Cilantro</h3>
              <p className="text-sm">Cilantro-lime rice, chimichurri, salsa verde, toss into tacos/burritos, blend into guacamole</p>
            </div>
            <div>
              <h3 className="font-heading text-jk-clay mb-1">Parsley</h3>
              <p className="text-sm">Tabbouleh, gremolata (parsley + lemon + garlic), chimichurri, herb butter, stock base</p>
            </div>
            <div>
              <h3 className="font-heading text-jk-clay mb-1">Mint</h3>
              <p className="text-sm">Mint tea (fresh or dried), mint chutney, tabbouleh, mojitos/cocktails, fruit salads</p>
            </div>
            <div>
              <h3 className="font-heading text-jk-clay mb-1">Dill</h3>
              <p className="text-sm">Yogurt-dill sauce (for fish/lamb), pickle brine, egg salad, potato salad, cream cheese spread</p>
            </div>
            <div>
              <h3 className="font-heading text-jk-clay mb-1">Rosemary/Thyme (hardy herbs)</h3>
              <p className="text-sm">Infuse into honey, roast with potatoes, add to bread dough, simmer in stocks</p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            Find Recipes for Your Excess Herbs
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Enter your wilting cilantro, leftover parsley, or excess basil into our fridge search.
            We'll show you flexible recipes that use fresh herbs.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">
              Search Your Fridge
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
