/**
 * Learn: Substitution Guide
 * Week 4 Task 5.5: Educational content on ingredient substitutions
 *
 * Common substitutions by category, why they work, confidence levels
 */

import { Shuffle, Droplet, Milk, Beef, Wheat } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Ingredient Substitution Guide | Joanie\'s Kitchen',
  description: 'Master ingredient substitutions to cook confidently with what you have. Learn why swaps work and when to use them.',
};

export default function SubstitutionGuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-blue-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Page Header */}
        <div className="text-center mb-12">
          <Shuffle className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Ingredient Substitution Guide
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            Cook confidently with what you have by understanding why ingredient swaps work.
            Not all substitutions are created equal—here's how to choose wisely.
          </p>
        </div>

        {/* Why Substitutions Work */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 mb-12 border-2 border-blue-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            🧪 Why Substitutions Work
          </h2>
          <p className="text-base text-jk-charcoal/70 leading-relaxed mb-6">
            Understanding the <em>function</em> of an ingredient is the key to successful substitution.
            When you know what role it plays, you can find alternatives that do the same job.
          </p>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-xl border border-blue-200">
              <h3 className="font-heading text-jk-clay mb-2">Acid = Acid</h3>
              <p className="text-sm text-jk-charcoal/70">
                Lemon juice, lime juice, vinegar, wine—all provide acidity that brightens flavors and
                balances richness. They're interchangeable for function, though flavor varies.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200">
              <h3 className="font-heading text-jk-clay mb-2">Fat = Fat</h3>
              <p className="text-sm text-jk-charcoal/70">
                Butter, olive oil, coconut oil—all provide richness, moisture, and help carry flavors.
                Swap based on flavor profile and cooking method.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200">
              <h3 className="font-heading text-jk-clay mb-2">Bulk = Bulk</h3>
              <p className="text-sm text-jk-charcoal/70">
                In baking, ingredients like flour, sugar, or eggs provide structure. Substitutions work
                when they contribute similar volume and binding properties.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-blue-200">
              <h3 className="font-heading text-jk-clay mb-2">Protein = Protein</h3>
              <p className="text-sm text-jk-charcoal/70">
                Chicken, tofu, beans, tempeh—all provide protein and substance. Adjust cooking times
                and seasonings for different textures and flavors.
              </p>
            </div>
          </div>
        </div>

        {/* Butter, Oils & Fats */}
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl p-8 mb-12 border-2 border-yellow-200">
          <div className="flex items-start gap-4 mb-6">
            <Droplet className="h-12 w-12 text-yellow-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Butter, Oils & Fats
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-yellow-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 cup Butter</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">1:1 SWAP</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 cup olive oil</strong> (savory dishes, not baking)</p>
                <p>→ <strong>1 cup coconut oil</strong> (baking, tropical flavor)</p>
                <p>→ <strong>7/8 cup vegetable/canola oil</strong> (neutral flavor for baking)</p>
                <p>→ <strong>1 cup ghee</strong> (clarified butter, nuttier flavor)</p>
              </div>
              <p className="text-xs text-jk-charcoal/60 mt-3 italic">
                Note: Butter adds flavor and moisture. Oil adds only moisture. Adjust seasonings accordingly.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-yellow-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 tablespoon Olive Oil</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">1:1 SWAP</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 tablespoon avocado oil</strong> (high heat cooking)</p>
                <p>→ <strong>1 tablespoon sesame oil</strong> (Asian dishes, strong flavor)</p>
                <p>→ <strong>1 tablespoon butter</strong> (adds richness)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Acids & Liquids */}
        <div className="bg-gradient-to-r from-lime-50 to-green-50 rounded-2xl p-8 mb-12 border-2 border-lime-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            🍋 Acids & Liquids
          </h2>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-lime-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 tablespoon Lemon Juice</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">1:1 SWAP</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 tablespoon lime juice</strong> (slightly sweeter)</p>
                <p>→ <strong>1 tablespoon white wine vinegar</strong> (sharper flavor)</p>
                <p>→ <strong>1 tablespoon apple cider vinegar</strong> (mild, fruity)</p>
                <p>→ <strong>1 tablespoon rice vinegar</strong> (milder, Asian dishes)</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-lime-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 cup Wine (cooking)</h3>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">CLOSE</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 cup chicken/vegetable stock + 1 tbsp vinegar</strong> (adds depth + acid)</p>
                <p>→ <strong>1 cup grape juice + 2 tbsp lemon juice</strong> (non-alcoholic)</p>
                <p>→ <strong>1 cup water + 1 tbsp vinegar</strong> (minimal flavor)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dairy */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 mb-12 border-2 border-blue-200">
          <div className="flex items-start gap-4 mb-6">
            <Milk className="h-12 w-12 text-blue-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Dairy Products
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-blue-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 cup Heavy Cream</h3>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">CLOSE</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 cup coconut cream</strong> (canned, full-fat—rich, slight coconut flavor)</p>
                <p>→ <strong>1 cup cashew cream</strong> (soaked cashews blended with water—neutral flavor)</p>
                <p>→ <strong>3/4 cup milk + 1/4 cup butter</strong> (thinner, but adds richness)</p>
              </div>
              <p className="text-xs text-jk-charcoal/60 mt-3 italic">
                Won't whip like heavy cream, but works in sauces and soups.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-blue-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 cup Milk</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">1:1 SWAP</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 cup oat milk</strong> (neutral, creamy)</p>
                <p>→ <strong>1 cup almond milk</strong> (slightly nutty)</p>
                <p>→ <strong>1 cup soy milk</strong> (protein-rich, neutral)</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-blue-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 cup Sour Cream / Yogurt</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">1:1 SWAP</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 cup Greek yogurt</strong> (tangier, high protein)</p>
                <p>→ <strong>1 cup cottage cheese (blended)</strong> (mild, high protein)</p>
                <p>→ <strong>1 cup cashew cream + 1 tbsp lemon juice</strong> (vegan, tangy)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Proteins */}
        <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-8 mb-12 border-2 border-orange-200">
          <div className="flex items-start gap-4 mb-6">
            <Beef className="h-12 w-12 text-orange-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Proteins
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-orange-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">Chicken Breast</h3>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">ADJUST</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>Firm tofu (pressed)</strong> (absorbs marinades well, shorter cook time)</p>
                <p>→ <strong>Tempeh</strong> (nuttier, firmer texture, steam first to mellow flavor)</p>
                <p>→ <strong>Chickpeas</strong> (roasted for texture, works in curries/stir-fries)</p>
                <p>→ <strong>Turkey breast</strong> (similar texture, slightly drier)</p>
              </div>
              <p className="text-xs text-jk-charcoal/60 mt-3 italic">
                Adjust cooking times: tofu/tempeh cook faster, chickpeas need crisping.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-orange-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">Ground Beef</h3>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">ADJUST</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>Lentils (cooked)</strong> (tacos, bolognese, chili—earthy flavor)</p>
                <p>→ <strong>Mushrooms (finely chopped)</strong> (umami-rich, meaty texture)</p>
                <p>→ <strong>Ground turkey</strong> (leaner, add fat for moisture)</p>
                <p>→ <strong>Crumbled tempeh</strong> (firm texture, needs seasoning)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Baking Substitutions */}
        <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-8 mb-12 border-2 border-pink-200">
          <div className="flex items-start gap-4 mb-6">
            <Wheat className="h-12 w-12 text-pink-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Baking Essentials
              </h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-pink-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 Egg</h3>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-bold">VARIES</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 flax egg</strong> (1 tbsp ground flax + 3 tbsp water, let sit 5 min—binding)</p>
                <p>→ <strong>1/4 cup applesauce</strong> (moisture, mild sweetness—best for muffins)</p>
                <p>→ <strong>1/4 cup mashed banana</strong> (moisture, banana flavor—quick breads)</p>
                <p>→ <strong>3 tbsp aquafaba</strong> (chickpea brine—whips for meringues)</p>
              </div>
              <p className="text-xs text-jk-charcoal/60 mt-3 italic">
                Note: Eggs provide structure, leavening, and richness. Substitutes vary by function.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-pink-200">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="font-heading text-jk-clay">1 cup All-Purpose Flour</h3>
                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">TRICKY</span>
              </div>
              <div className="space-y-2 text-sm text-jk-charcoal/70">
                <p>→ <strong>1 cup + 2 tbsp cake flour</strong> (lighter, more tender—use less)</p>
                <p>→ <strong>1 cup whole wheat flour</strong> (denser, nuttier—absorbs more liquid)</p>
                <p>→ <strong>1 cup gluten-free flour blend</strong> (needs xanthan gum for structure)</p>
              </div>
              <p className="text-xs text-jk-charcoal/60 mt-3 italic">
                Flour swaps affect texture significantly. Start with half to test.
              </p>
            </div>
          </div>
        </div>

        {/* Confidence Levels */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            🎯 Substitution Confidence Guide
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-bold flex-shrink-0">1:1 SWAP</span>
              <p className="text-sm text-jk-charcoal/70">
                <strong>Use with confidence.</strong> These substitutions work 1:1 with minimal recipe adjustment.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full font-bold flex-shrink-0">CLOSE</span>
              <p className="text-sm text-jk-charcoal/70">
                <strong>Good approximation.</strong> Flavor or texture may differ slightly, but results are reliable.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full font-bold flex-shrink-0">ADJUST</span>
              <p className="text-sm text-jk-charcoal/70">
                <strong>Recipe needs tweaking.</strong> Cooking time, seasoning, or liquid may need adjustment.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-full font-bold flex-shrink-0">TRICKY</span>
              <p className="text-sm text-jk-charcoal/70">
                <strong>Experiment carefully.</strong> These swaps affect the dish significantly. Start with small batches.
              </p>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            Ready to Cook with What You Have?
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Now that you know how substitutions work, find recipes that use your available ingredients.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">
              Search By Ingredients
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
