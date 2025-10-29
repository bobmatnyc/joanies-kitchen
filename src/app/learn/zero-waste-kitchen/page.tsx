/**
 * Learn: Zero-Waste Kitchen
 * Week 4 Task 5.3: Educational content on zero-waste cooking
 *
 * FIFO principles, scrap utilization, composting, storage tips
 */

import { Calendar, Leaf, Package, Recycle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Zero-Waste Kitchen Guide | Joanie's Kitchen",
  description:
    'Master FIFO principles, scrap utilization, composting basics, and storage tips to eliminate food waste in your kitchen.',
};

export default function ZeroWasteKitchenPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-green-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <Recycle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Zero-Waste Kitchen
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            Learn the principles and practices that help you waste less food, save money, and cook
            with confidence using what you have.
          </p>
        </div>

        {/* FIFO Section */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 mb-12 border-2 border-blue-200">
          <div className="flex items-start gap-4 mb-6">
            <Calendar className="h-12 w-12 text-blue-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                FIFO: First In, First Out
              </h2>
              <p className="text-lg text-jk-charcoal/80 italic mb-4">
                "The oldest ingredients get used first. It's that simple."
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">What is FIFO?</h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed mb-3">
                FIFO (First In, First Out) is a simple inventory principle: use older items before
                newer ones. In restaurant kitchens, it's non-negotiable. In home kitchens, it's the
                single most effective way to prevent food waste.
              </p>
              <p className="text-base text-jk-charcoal/70 leading-relaxed">
                When you bring groceries home, move older items to the front. New items go to the
                back. When cooking, reach for what's been there longest first.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">How to Implement FIFO</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    1
                  </span>
                  <div>
                    <p className="text-base text-jk-charcoal/70">
                      <strong>Date everything:</strong> Use masking tape or a marker. "Opened 10/15"
                      or "Use by 10/22"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    2
                  </span>
                  <div>
                    <p className="text-base text-jk-charcoal/70">
                      <strong>Rotate weekly:</strong> Move older items forward every time you shop
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    3
                  </span>
                  <div>
                    <p className="text-base text-jk-charcoal/70">
                      <strong>Plan meals around what's aging:</strong> Start meal planning by asking
                      "What needs using?"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    4
                  </span>
                  <div>
                    <p className="text-base text-jk-charcoal/70">
                      <strong>Check fridge daily:</strong> Quick 30-second scan prevents surprises
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrap Utilization Section */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <div className="flex items-start gap-4 mb-6">
            <Leaf className="h-12 w-12 text-green-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">Scrap Utilization Guide</h2>
              <p className="text-base text-jk-charcoal/70 leading-relaxed">
                What you call "scraps," zero-waste cooks call "ingredients." Here's how to use parts
                you'd normally throw away.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Vegetable Scraps */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay mb-2">🥕 Vegetable Scraps → Stock</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Save:</strong> Onion skins, carrot peels, celery ends, herb stems, mushroom
                stems, garlic skins
              </p>
              <p className="text-sm text-jk-charcoal/60">
                <strong>Use:</strong> Keep a freezer bag. Add scraps until full. Simmer with water
                45 min. Strain. Freeze stock.
              </p>
            </div>

            {/* Herb Stems */}
            <div className="bg-gradient-to-r from-lime-50 to-green-50 p-4 rounded-xl border border-lime-200">
              <h3 className="font-heading text-jk-clay mb-2">🌿 Herb Stems → Flavor Bombs</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Save:</strong> Cilantro, parsley, basil, dill stems (actually more flavor
                than leaves!)
              </p>
              <p className="text-sm text-jk-charcoal/60">
                <strong>Use:</strong> Throw whole into soups/stews. Blend into pesto. Add to stock.
                Infuse into vinegar.
              </p>
            </div>

            {/* Chicken Bones */}
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-xl border border-amber-200">
              <h3 className="font-heading text-jk-clay mb-2">🍗 Chicken Bones → Rich Stock</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Save:</strong> Rotisserie chicken carcass, wing bones, thigh bones
              </p>
              <p className="text-sm text-jk-charcoal/60">
                <strong>Use:</strong> Simmer with veg scraps 2-4 hours. Add to soups, risotto,
                sauces. Freezes 6 months.
              </p>
            </div>

            {/* Bread Heels */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-xl border border-orange-200">
              <h3 className="font-heading text-jk-clay mb-2">
                🍞 Bread Ends → Breadcrumbs/Croutons
              </h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Save:</strong> Stale bread, heels, dried-out baguette
              </p>
              <p className="text-sm text-jk-charcoal/60">
                <strong>Use:</strong> Blend into breadcrumbs. Cube and toast for croutons. Soak for
                bread pudding/panzanella.
              </p>
            </div>

            {/* Overripe Bananas */}
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-4 rounded-xl border border-yellow-200">
              <h3 className="font-heading text-jk-clay mb-2">
                🍌 Overripe Bananas → Banana Bread/Smoothies
              </h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Save:</strong> Brown/spotted bananas (sweetest at this stage!)
              </p>
              <p className="text-sm text-jk-charcoal/60">
                <strong>Use:</strong> Freeze for smoothies. Mash for banana bread/muffins. Blend
                into pancake batter.
              </p>
            </div>

            {/* Cheese Rinds */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
              <h3 className="font-heading text-jk-clay mb-2">🧀 Parmesan Rinds → Umami Boost</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Save:</strong> Hard cheese rinds (parmesan, pecorino, asiago)
              </p>
              <p className="text-sm text-jk-charcoal/60">
                <strong>Use:</strong> Add to simmering soups/sauces. Remove before serving. Adds
                deep savory flavor.
              </p>
            </div>
          </div>
        </div>

        {/* Composting Basics */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 mb-12 border-2 border-amber-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">🌱 Composting Basics</h2>
          <p className="text-base text-jk-charcoal/70 leading-relaxed mb-6">
            For scraps that truly can't be eaten, composting returns nutrients to soil instead of
            sending them to landfills. Even apartment dwellers can compost.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-heading text-green-700 mb-3">✓ Compost These</h3>
              <ul className="space-y-1 text-sm text-jk-charcoal/70">
                <li>• Fruit/vegetable scraps</li>
                <li>• Coffee grounds & filters</li>
                <li>• Tea bags (remove staples)</li>
                <li>• Eggshells</li>
                <li>• Bread/grains</li>
                <li>• Yard trimmings</li>
                <li>• Paper towels/napkins</li>
              </ul>
            </div>
            <div>
              <h3 className="font-heading text-red-700 mb-3">✗ Don't Compost</h3>
              <ul className="space-y-1 text-sm text-jk-charcoal/70">
                <li>• Meat/bones</li>
                <li>• Dairy products</li>
                <li>• Oils/fats</li>
                <li>• Pet waste</li>
                <li>• Diseased plants</li>
                <li>• Coated paper</li>
                <li>• Synthetic materials</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Storage Tips */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 mb-12 border-2 border-purple-200">
          <div className="flex items-start gap-4 mb-6">
            <Package className="h-12 w-12 text-purple-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Storage Tips by Ingredient
              </h2>
              <p className="text-base text-jk-charcoal/70">
                Proper storage dramatically extends shelf life. Here's where things actually belong.
              </p>
            </div>
          </div>

          <div className="space-y-3 text-base text-jk-charcoal/70">
            <div className="flex items-start gap-3">
              <span className="text-purple-600 font-bold flex-shrink-0">•</span>
              <span>
                <strong>Counter:</strong> Tomatoes, bananas, avocados (until ripe), onions, garlic,
                potatoes, winter squash
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-purple-600 font-bold flex-shrink-0">•</span>
              <span>
                <strong>Fridge (crisper):</strong> Leafy greens, herbs (in water), carrots, celery,
                peppers, broccoli
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-purple-600 font-bold flex-shrink-0">•</span>
              <span>
                <strong>Fridge (main):</strong> Berries, grapes, dairy, eggs, cooked leftovers, most
                condiments
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-purple-600 font-bold flex-shrink-0">•</span>
              <span>
                <strong>Freezer:</strong> Bread, overripe bananas, cooked proteins, stocks/soups,
                leftover herbs in oil
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-purple-600 font-bold flex-shrink-0">•</span>
              <span>
                <strong>Never together:</strong> Apples + other produce (ethylene gas), onions +
                potatoes (sprout faster)
              </span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            Ready to Practice Zero-Waste Cooking?
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Start with what's in your fridge. We'll show you resourceful recipes that minimize
            waste.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">What's in Your Fridge?</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
