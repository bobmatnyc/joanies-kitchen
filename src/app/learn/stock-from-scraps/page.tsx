/**
 * Learn: Stock from Scraps
 * Week 4 Task 5.6: Educational content on making stock from kitchen scraps
 *
 * What scraps to save, basic stock recipes, storage techniques, usage ideas
 */

import { Soup, Flame, Snowflake, Package, Clock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Stock from Scraps Guide | Joanie\'s Kitchen',
  description: 'Transform vegetable peels, chicken bones, and herb stems into rich, flavorful stock. Stop buying broth—make it from scraps.',
};

export default function StockFromScrapsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-amber-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Page Header */}
        <div className="text-center mb-12">
          <Soup className="h-16 w-16 text-amber-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Stock from Scraps
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            Stop buying broth. Start saving scraps. Rich, flavorful stock is one of the best ways to
            turn "waste" into something deeply nourishing—and nearly free.
          </p>
        </div>

        {/* Why Make Stock */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-8 mb-12 border-2 border-amber-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            💰 Why Make Your Own Stock?
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-2xl flex-shrink-0">✓</span>
              <div>
                <p className="font-heading text-jk-clay mb-1">Costs Almost Nothing</p>
                <p className="text-sm text-jk-charcoal/70">
                  Made from scraps you'd throw away. A gallon of homemade stock costs ~$0.50 vs. $4-8 store-bought.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-2xl flex-shrink-0">✓</span>
              <div>
                <p className="font-heading text-jk-clay mb-1">Tastes Better</p>
                <p className="text-sm text-jk-charcoal/70">
                  Deeper flavor, no additives, no sodium overload. You control what goes in.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-2xl flex-shrink-0">✓</span>
              <div>
                <p className="font-heading text-jk-clay mb-1">Reduces Waste</p>
                <p className="text-sm text-jk-charcoal/70">
                  Onion skins, carrot peels, chicken bones—all become liquid gold instead of landfill.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-2xl flex-shrink-0">✓</span>
              <div>
                <p className="font-heading text-jk-clay mb-1">Always Available</p>
                <p className="text-sm text-jk-charcoal/70">
                  Freeze scraps as you go. Make stock when the bag is full. Store for months.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Freezer Bag Method */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 mb-12 border-2 border-blue-200">
          <div className="flex items-start gap-4 mb-6">
            <Package className="h-12 w-12 text-blue-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                The Freezer Bag Method
              </h2>
              <p className="text-base text-jk-charcoal/70 italic mb-4">
                "Keep a bag in your freezer. Add scraps as you cook. Make stock when it's full."
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
              <div>
                <p className="text-base text-jk-charcoal/70">
                  <strong>Label a gallon freezer bag:</strong> "Veggie Scraps" or "Chicken Scraps"
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
              <div>
                <p className="text-base text-jk-charcoal/70">
                  <strong>Add scraps as you cook:</strong> Onion ends, carrot tops, chicken bones, herb stems
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
              <div>
                <p className="text-base text-jk-charcoal/70">
                  <strong>When the bag is full:</strong> Dump contents into a pot, cover with water, simmer
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
              <div>
                <p className="text-base text-jk-charcoal/70">
                  <strong>Strain and store:</strong> Freeze in jars or ice cube trays for easy use
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* What Scraps to Save */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            🥕 What Scraps to Save
          </h2>

          <div className="space-y-6">
            {/* Good for Stock */}
            <div>
              <h3 className="font-heading text-green-700 mb-4 text-lg">✓ Excellent for Stock</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <p className="font-heading text-jk-clay mb-2">Vegetables</p>
                  <ul className="text-sm text-jk-charcoal/70 space-y-1">
                    <li>• Onion skins & ends (add color)</li>
                    <li>• Carrot peels & tops</li>
                    <li>• Celery ends & leaves</li>
                    <li>• Mushroom stems</li>
                    <li>• Garlic skins & ends</li>
                    <li>• Leek tops (green parts)</li>
                    <li>• Tomato cores</li>
                  </ul>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <p className="font-heading text-jk-clay mb-2">Herbs & Aromatics</p>
                  <ul className="text-sm text-jk-charcoal/70 space-y-1">
                    <li>• Parsley stems (more flavor than leaves!)</li>
                    <li>• Cilantro stems</li>
                    <li>• Thyme/rosemary sprigs</li>
                    <li>• Bay leaves</li>
                    <li>• Ginger peels</li>
                    <li>• Lemongrass ends</li>
                  </ul>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <p className="font-heading text-jk-clay mb-2">Proteins</p>
                  <ul className="text-sm text-jk-charcoal/70 space-y-1">
                    <li>• Chicken bones & carcass</li>
                    <li>• Turkey bones</li>
                    <li>• Beef/pork bones</li>
                    <li>• Shrimp shells</li>
                    <li>• Fish bones (mild fish only)</li>
                  </ul>
                </div>
                <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                  <p className="font-heading text-jk-clay mb-2">Cheese</p>
                  <ul className="text-sm text-jk-charcoal/70 space-y-1">
                    <li>• Parmesan rinds</li>
                    <li>• Pecorino rinds</li>
                    <li>• Asiago rinds</li>
                    <li>• (Adds umami depth to soups)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Avoid These */}
            <div>
              <h3 className="font-heading text-red-700 mb-4 text-lg">✗ Avoid These</h3>
              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <ul className="text-sm text-jk-charcoal/70 space-y-1">
                  <li>• <strong>Cruciferous vegetables:</strong> Broccoli, cauliflower, cabbage, Brussels sprouts (too strong/bitter)</li>
                  <li>• <strong>Starchy vegetables:</strong> Potatoes (make stock cloudy)</li>
                  <li>• <strong>Beets:</strong> Will turn stock pink</li>
                  <li>• <strong>Asparagus:</strong> Too overpowering</li>
                  <li>• <strong>Peppers (bell/hot):</strong> Can dominate flavor</li>
                  <li>• <strong>Artichokes:</strong> Too bitter</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Basic Stock Recipes */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 mb-12 border-2 border-green-200">
          <div className="flex items-start gap-4 mb-6">
            <Flame className="h-12 w-12 text-green-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Basic Stock Recipes
              </h2>
            </div>
          </div>

          <div className="space-y-6">
            {/* Vegetable Stock */}
            <div className="bg-white p-6 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay text-xl mb-4">🥬 Vegetable Stock</h3>
              <div className="space-y-3 text-sm text-jk-charcoal/70">
                <div>
                  <p className="font-bold mb-1">Ingredients:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• 1 gallon bag of veggie scraps (frozen is fine)</li>
                    <li>• 12 cups cold water</li>
                    <li>• 2 bay leaves</li>
                    <li>• 1 tsp peppercorns</li>
                    <li>• Optional: parmesan rind for umami</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold mb-1">Method:</p>
                  <ol className="space-y-1 ml-4 list-decimal">
                    <li>Add all ingredients to large pot. Bring to boil.</li>
                    <li>Reduce heat, simmer uncovered 45-60 minutes.</li>
                    <li>Strain through fine-mesh sieve. Discard solids.</li>
                    <li>Cool and store. Don't add salt yet—add when using.</li>
                  </ol>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-jk-charcoal/60 italic">
                    <strong>Time:</strong> 45-60 minutes | <strong>Yield:</strong> ~8 cups
                  </p>
                </div>
              </div>
            </div>

            {/* Chicken Stock */}
            <div className="bg-white p-6 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay text-xl mb-4">🍗 Chicken Stock</h3>
              <div className="space-y-3 text-sm text-jk-charcoal/70">
                <div>
                  <p className="font-bold mb-1">Ingredients:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• 1 rotisserie chicken carcass (or 2-3 lbs chicken bones)</li>
                    <li>• 1 gallon bag veggie scraps (onion, carrot, celery ideal)</li>
                    <li>• 12 cups cold water</li>
                    <li>• 2 bay leaves</li>
                    <li>• Fresh herbs (thyme, parsley)</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold mb-1">Method:</p>
                  <ol className="space-y-1 ml-4 list-decimal">
                    <li>Add all ingredients to large pot. Bring to boil.</li>
                    <li>Reduce heat, simmer uncovered 2-4 hours. Skim foam occasionally.</li>
                    <li>Strain through fine-mesh sieve. Discard solids.</li>
                    <li>Cool in fridge. Skim fat layer if desired. Store or freeze.</li>
                  </ol>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-jk-charcoal/60 italic">
                    <strong>Time:</strong> 2-4 hours | <strong>Yield:</strong> ~8 cups | <strong>Rich, gelatinous when cold</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Bone Broth (Extra Rich) */}
            <div className="bg-white p-6 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay text-xl mb-4">🦴 Bone Broth (Extra Rich)</h3>
              <div className="space-y-3 text-sm text-jk-charcoal/70">
                <div>
                  <p className="font-bold mb-1">Ingredients:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• 3-4 lbs beef or pork bones (ask butcher for soup bones)</li>
                    <li>• 2 tbsp apple cider vinegar (extracts minerals from bones)</li>
                    <li>• Veggie scraps (onion, carrot, celery)</li>
                    <li>• 12 cups cold water</li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold mb-1">Method:</p>
                  <ol className="space-y-1 ml-4 list-decimal">
                    <li>Roast bones at 400°F for 30 min (deeper flavor).</li>
                    <li>Add to pot with vinegar, veggie scraps, water. Bring to boil.</li>
                    <li>Reduce heat, simmer 12-24 hours. Longer = richer.</li>
                    <li>Strain, cool, skim fat. Should gel when refrigerated.</li>
                  </ol>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-jk-charcoal/60 italic">
                    <strong>Time:</strong> 12-24 hours | <strong>Yield:</strong> ~10 cups | <strong>Extremely gelatinous, nutrient-dense</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage & Freezing */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-8 mb-12 border-2 border-indigo-200">
          <div className="flex items-start gap-4 mb-6">
            <Snowflake className="h-12 w-12 text-indigo-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Storage & Freezing Techniques
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">🧊 Ice Cube Method</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Best for:</strong> Quick flavor additions (sautéing, deglazing, small portions)
              </p>
              <p className="text-sm text-jk-charcoal/60">
                Pour stock into ice cube trays. Freeze solid. Pop out cubes into freezer bag. Label with date.
                Each cube = ~2 tablespoons.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">🏺 Mason Jar Method</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Best for:</strong> Soups, risotto, cooking grains (2-4 cup portions)
              </p>
              <p className="text-sm text-jk-charcoal/60">
                Pour into wide-mouth mason jars, leaving 1 inch headspace for expansion. Cool completely before freezing.
                Label with type and date. Thaw overnight in fridge.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">📦 Freezer Bag Method</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                <strong>Best for:</strong> Space-saving storage (flat stacks)
              </p>
              <p className="text-sm text-jk-charcoal/60">
                Pour stock into gallon freezer bags. Lay flat on baking sheet, freeze solid. Stack bags vertically
                like files. Saves freezer space. Break off pieces as needed.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">❄️ Storage Timeline</h3>
              <ul className="text-sm text-jk-charcoal/70 space-y-1">
                <li>• <strong>Refrigerator:</strong> 4-5 days (bring to boil before using if older)</li>
                <li>• <strong>Freezer:</strong> 4-6 months (still safe after, but flavor degrades)</li>
                <li>• <strong>Scraps in freezer:</strong> 3-6 months (add continuously until ready to make stock)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* How to Use Stock */}
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl p-8 mb-12 border-2 border-yellow-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            🍲 How to Use Your Stock
          </h2>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold text-lg flex-shrink-0">→</span>
              <div>
                <p className="font-heading text-jk-clay">Soups & Stews</p>
                <p className="text-sm text-jk-charcoal/70">The obvious use. Stock is the base for any soup worth eating.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold text-lg flex-shrink-0">→</span>
              <div>
                <p className="font-heading text-jk-clay">Risotto & Grains</p>
                <p className="text-sm text-jk-charcoal/70">Cook rice, quinoa, couscous in stock instead of water. Instant upgrade.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold text-lg flex-shrink-0">→</span>
              <div>
                <p className="font-heading text-jk-clay">Sauces & Gravies</p>
                <p className="text-sm text-jk-charcoal/70">Deglaze pans, make pan sauces, thicken gravies. Rich stock = rich sauce.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold text-lg flex-shrink-0">→</span>
              <div>
                <p className="font-heading text-jk-clay">Braising Liquid</p>
                <p className="text-sm text-jk-charcoal/70">Braise meats, vegetables in stock for deep flavor infusion.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold text-lg flex-shrink-0">→</span>
              <div>
                <p className="font-heading text-jk-clay">Mashed Potatoes</p>
                <p className="text-sm text-jk-charcoal/70">Use stock instead of milk. Professional chef secret.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-yellow-600 font-bold text-lg flex-shrink-0">→</span>
              <div>
                <p className="font-heading text-jk-clay">Sautéing</p>
                <p className="text-sm text-jk-charcoal/70">Use stock cubes instead of oil for lower-fat cooking.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            Ready to Start Saving Scraps?
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Find recipes that use your homemade stock—from comforting soups to rich risottos.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">
              Find Stock-Based Recipes
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
