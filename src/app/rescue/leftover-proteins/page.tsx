/**
 * Rescue: Leftover Proteins Page
 * Week 4 Task 5.2: Rescue ingredient category page
 *
 * Techniques for using leftover cooked chicken, beef, tofu, etc.
 */

import { AlertCircle, Drumstick, Leaf } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: "Rescue Leftover Proteins | Joanie's Kitchen",
  description:
    'Turn leftover cooked chicken, beef, tofu, and fish into fresh meals. Learn rescue techniques, storage tips, and safe reheating practices.',
};

export default function LeftoverProteinsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-amber-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="text-center mb-12">
          <Drumstick className="h-16 w-16 text-amber-700 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Rescue Leftover Proteins
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            Yesterday's roast chicken becomes today's fried rice. Leftover steak transforms into
            tacos. Here's how to safely rescue and reinvent cooked proteins.
          </p>
        </div>

        {/* When to Use vs. Discard */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Still Good */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-2xl border-2 border-green-300">
            <div className="flex items-center gap-3 mb-4">
              <Leaf className="h-8 w-8 text-green-600" />
              <h2 className="text-xl font-heading text-jk-olive">Still Safe to Eat</h2>
            </div>
            <ul className="space-y-2 text-base text-jk-charcoal/70">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Refrigerated within 2 hours</strong> - Properly stored after cooking
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Used within 3-4 days</strong> - Most cooked proteins (chicken, beef, pork,
                  fish)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>No off smell</strong> - Should smell like cooked food, not sour or rotten
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Normal texture/color</strong> - Not slimy or discolored
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-1">✓</span>
                <span>
                  <strong>Properly frozen</strong> - Can last 2-6 months in freezer
                </span>
              </li>
            </ul>
          </div>

          {/* Time to Discard */}
          <div className="bg-gradient-to-br from-red-50 to-rose-50 p-6 rounded-2xl border-2 border-red-300">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <h2 className="text-xl font-heading text-jk-olive">Time to Discard</h2>
            </div>
            <ul className="space-y-2 text-base text-jk-charcoal/70">
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Left at room temp 2+ hours</strong> - Bacterial growth risk
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Over 4 days old</strong> - Even if refrigerated
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Sour or off smell</strong> - Any unusual odor is a red flag
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Slimy or sticky texture</strong> - Bacterial film
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 mt-1">✗</span>
                <span>
                  <strong>Gray or green discoloration</strong> - Spoilage indicators
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Rescue Techniques */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            4 Quick Ways to Rescue Leftover Proteins
          </h2>

          <div className="space-y-6">
            {/* Technique 1 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-amber-100 text-amber-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  1
                </span>
                Fried Rice or Grain Bowls
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Chop leftover protein into bite-sized pieces and stir-fry with day-old rice,
                vegetables, soy sauce, and scrambled egg. The high heat refreshes the protein and
                creates a cohesive meal.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Chicken, pork, beef, shrimp, tofu — any cooked protein
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Heat wok/large pan over high heat. Add oil, rice, chopped
                protein, veg. Stir-fry 3-5 minutes. Season with soy sauce, sesame oil.
              </p>
            </div>

            {/* Technique 2 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-amber-100 text-amber-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  2
                </span>
                Tacos, Quesadillas, or Wraps
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Shred or dice leftover protein and warm in a pan with taco seasoning, cumin, or your
                favorite spices. Serve in tortillas with fresh toppings like salsa, avocado,
                lettuce, cheese.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Pulled pork, shredded chicken, ground beef, fish, even
                leftover roast
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Shred protein with forks. Heat in pan with spices and splash
                of broth. Warm tortillas, fill, add toppings.
              </p>
            </div>

            {/* Technique 3 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-amber-100 text-amber-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  3
                </span>
                Soup, Stew, or Curry
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Add diced leftover protein to simmering soup, stew, or curry in the last 5-10
                minutes of cooking. This gently reheats the protein while infusing it with flavor
                from the broth or sauce.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Chicken, beef, pork, tofu — works in any liquid-based
                dish
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Prepare soup/stew base. Add diced protein in final 5-10
                minutes. Avoid overcooking (protein is already cooked).
              </p>
            </div>

            {/* Technique 4 */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-2 flex items-center gap-2">
                <span className="bg-amber-100 text-amber-700 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                  4
                </span>
                Salads or Grain Bowls (Cold)
              </h3>
              <p className="text-base text-jk-charcoal/70 leading-relaxed ml-10 mb-2">
                Slice leftover protein thin and serve cold over mixed greens, grains, or pasta.
                Great for lunch the next day — no reheating needed. Add dressing, nuts, cheese, and
                fresh vegetables.
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 italic">
                <strong>Perfect for:</strong> Grilled chicken, steak, salmon, tofu — especially if
                they were well-seasoned
              </p>
              <p className="text-sm text-jk-charcoal/60 ml-10 mt-2">
                <strong>How:</strong> Slice protein thin. Build salad with greens, grains, veggies.
                Top with protein and vinaigrette or tahini dressing.
              </p>
            </div>
          </div>
        </div>

        {/* Storage & Safety Tips */}
        <div className="bg-gradient-to-r from-jk-sage/10 to-blue-100/50 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">🧊 Storage & Safety Tips</h2>
          <div className="space-y-3 text-base text-jk-charcoal/70">
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Refrigerate within 2 hours:</strong> Don't leave cooked protein at room temp
                longer than 2 hours (1 hour if above 90°F)
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Store in shallow containers:</strong> Helps protein cool quickly and evenly
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Use within 3-4 days:</strong> Cooked chicken, beef, pork, fish last 3-4 days
                refrigerated
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Freeze for longer storage:</strong> Most cooked proteins freeze well for 2-6
                months. Label with date.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Reheat to 165°F:</strong> When reheating, make sure protein reaches 165°F
                internal temperature
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-jk-sage text-xl flex-shrink-0">•</span>
              <span>
                <strong>Only reheat once:</strong> Don't repeatedly reheat the same protein —
                increases bacteria risk
              </span>
            </div>
          </div>
        </div>

        {/* Common Leftover Proteins */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-8 mb-12 border-2 border-amber-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">🍗 Common Leftover Proteins</h2>
          <p className="text-base text-jk-charcoal/70 mb-4 leading-relaxed">
            These are the proteins you're most likely to have left over — all perfect for rescue
            techniques:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-jk-charcoal/70">
            <div className="bg-white rounded-lg p-3 border border-amber-200">Roast Chicken</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Grilled Chicken</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              Rotisserie Chicken
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Steak</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Ground Beef</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Pork Chops</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Pulled Pork</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">
              Baked/Grilled Fish
            </div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Salmon</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Shrimp</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Tofu</div>
            <div className="bg-white rounded-lg p-3 border border-amber-200">Turkey</div>
          </div>
        </div>

        {/* Freezer Tips Callout */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-8 mb-12 border-2 border-blue-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">❄️ Freezing Leftover Proteins</h2>
          <p className="text-base text-jk-charcoal/70 mb-4 leading-relaxed">
            If you can't use leftover protein within 3-4 days, freeze it. Most cooked proteins
            freeze beautifully.
          </p>
          <div className="space-y-3 text-base text-jk-charcoal/70">
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">1.</span>
              <span>
                <strong>Cool completely first</strong> — Don't freeze hot food (raises freezer temp)
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">2.</span>
              <span>
                <strong>Portion into meal-sized amounts</strong> — Easier to thaw only what you need
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">3.</span>
              <span>
                <strong>Use airtight containers or freezer bags</strong> — Prevents freezer burn
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">4.</span>
              <span>
                <strong>Label with date and contents</strong> — "Chicken, 10/20/25"
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-blue-600 text-xl flex-shrink-0">5.</span>
              <span>
                <strong>Use within 2-6 months</strong> — Chicken/turkey: 4 months, Beef/pork: 6
                months, Fish: 2-3 months
              </span>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            Find Recipes for Your Leftover Proteins
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Enter your leftover chicken, beef, or tofu into our fridge search. We'll show you
            flexible recipes that work with cooked proteins.
          </p>
          <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
            <Link href="/fridge">Search Your Fridge</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
