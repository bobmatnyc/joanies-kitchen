/**
 * Learn: FIFO Management
 * Week 4 Task 5.3: Educational content on First In, First Out principles
 *
 * Inventory management, rotation strategies, daily habits, storage organization
 */

import { RotateCcw, RefrigeratorIcon, Calendar, Clock, Eye, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'FIFO Management Guide | Joanie\'s Kitchen',
  description: 'Master First In, First Out principles to reduce food waste. Learn practical FIFO strategies for your fridge, freezer, and pantry.',
};

export default function FIFOManagementPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-purple-50/20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Page Header */}
        <div className="text-center mb-12">
          <RotateCcw className="h-16 w-16 text-purple-600 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            FIFO Management Guide
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-2xl mx-auto leading-relaxed">
            First In, First Out: The simple inventory principle that prevents food waste.
            Learn to use what came first before it expires—starting today.
          </p>
        </div>

        {/* What is FIFO */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 mb-12 border-2 border-purple-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            🔄 What is FIFO?
          </h2>
          <p className="text-base text-jk-charcoal/70 leading-relaxed mb-6">
            FIFO (First In, First Out) is an inventory management principle borrowed from restaurants and warehouses:
            <strong> the oldest items get used first.</strong> It's non-negotiable in professional kitchens because
            it prevents waste, maximizes freshness, and saves money.
          </p>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-purple-200">
              <h3 className="font-heading text-jk-clay mb-2">The Core Principle</h3>
              <p className="text-sm text-jk-charcoal/70">
                When you bring groceries home, <strong>move older items to the front</strong>. New items go to the back.
                When cooking, <strong>reach for what's been there longest first</strong>. That's it. Simple in theory,
                powerful in practice.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-purple-200">
              <h3 className="font-heading text-jk-clay mb-2">Why It Works</h3>
              <p className="text-sm text-jk-charcoal/70 mb-3">
                Most food waste happens because we forget what we have. FIFO creates a visual system where
                aging items are always front and center—impossible to ignore.
              </p>
              <ul className="text-sm text-jk-charcoal/70 space-y-1">
                <li>• <strong>No more surprise discoveries:</strong> "When did I buy this yogurt?"</li>
                <li>• <strong>Natural meal planning:</strong> Your fridge tells you what to cook</li>
                <li>• <strong>Less guilt:</strong> Food gets used, not wasted</li>
                <li>• <strong>More savings:</strong> Every item you use = money not thrown away</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Setting Up Your FIFO System */}
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-8 mb-12 border-2 border-blue-200">
          <div className="flex items-start gap-4 mb-6">
            <RefrigeratorIcon className="h-12 w-12 text-blue-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Setting Up Your FIFO System
              </h2>
              <p className="text-base text-jk-charcoal/70 italic mb-4">
                "A well-organized fridge makes FIFO effortless. Here's how to set it up once and maintain it forever."
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Fridge Organization */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">🧊 Fridge Organization</h3>
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Top Shelf: "Use First" Zone</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Dedicate your top shelf (or a specific section) to items that need using soon. Opened containers,
                    aging produce, leftovers approaching day 3-4. Check this shelf FIRST when meal planning.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Middle Shelves: Date Everything</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Use masking tape or a marker on containers. Write "Opened 10/20" or "Use by 10/27".
                    This removes guesswork and makes rotation obvious.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Crisper Drawers: Weekly Check</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Out of sight = out of mind. Set a weekly reminder to check crisper contents. Move wilting items
                    to the "Use First" zone immediately.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Door Shelves: Condiments Only</p>
                  <p className="text-sm text-jk-charcoal/70">
                    The door is the warmest part. Store only condiments and long-lasting items here.
                    Don't store milk, eggs, or perishables in the door.
                  </p>
                </div>
              </div>
            </div>

            {/* Pantry Management */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">📦 Pantry Management</h3>
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Front-to-Back Rotation</p>
                  <p className="text-sm text-jk-charcoal/70">
                    When adding new cans, boxes, or bags, push older items to the front. New items go behind.
                    This ensures oldest items get used first without checking dates every time.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Clear Containers = Visible Inventory</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Store dry goods (flour, rice, pasta, beans) in clear containers. Label with purchase date.
                    You'll see at a glance what you have and how long it's been there.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Group by Category</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Canned goods together, baking supplies together, snacks together. Makes it easier to rotate
                    items and prevents duplicate purchases.
                  </p>
                </div>
              </div>
            </div>

            {/* Freezer Strategies */}
            <div>
              <h3 className="text-lg font-heading text-jk-clay mb-3">❄️ Freezer Strategies</h3>
              <div className="space-y-3">
                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Date and Label EVERYTHING</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Use masking tape or freezer labels. Write what it is AND when you froze it.
                    "Chicken stock - 10/15/25". Future you will thank present you.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">First In = Eye Level</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Organize freezer so oldest items are at eye level or in front. New additions go to the back
                    or bottom. Prevents "freezer archeology" moments.
                  </p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200">
                  <p className="font-heading text-jk-charcoal mb-2">Quarterly Freezer Audit</p>
                  <p className="text-sm text-jk-charcoal/70">
                    Every 3 months, take inventory. Items older than 6 months should be used soon or discarded.
                    Frozen food is safe indefinitely, but quality degrades over time.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily FIFO Practices */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <div className="flex items-start gap-4 mb-6">
            <Clock className="h-12 w-12 text-green-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Daily FIFO Practices
              </h2>
              <p className="text-base text-jk-charcoal/70">
                FIFO works best as a daily habit, not a weekend project. Here are the routines that make it stick.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Morning Fridge Check */}
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-5 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-yellow-100 text-yellow-700 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold flex-shrink-0">30s</span>
                <h3 className="font-heading text-jk-clay text-lg">Morning Fridge Check</h3>
              </div>
              <p className="text-sm text-jk-charcoal/70 mb-3">
                Open fridge. Scan "Use First" shelf. Notice anything wilting, softening, or approaching expiration?
                Move it to the very front. Adjust today's meal plan if needed.
              </p>
              <p className="text-xs text-jk-charcoal/60 italic">
                <strong>Habit trigger:</strong> Do this while making morning coffee or checking your calendar.
              </p>
            </div>

            {/* Meal Planning from Inventory */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-5 rounded-xl border border-green-200">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-green-100 text-green-700 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold flex-shrink-0">2m</span>
                <h3 className="font-heading text-jk-clay text-lg">Start Meal Planning with "What Needs Using?"</h3>
              </div>
              <p className="text-sm text-jk-charcoal/70 mb-3">
                Before deciding what to cook, ask: "What do I have that might go bad soon?" Build your meal
                around those ingredients. This one shift prevents most food waste.
              </p>
              <p className="text-xs text-jk-charcoal/60 italic">
                <strong>Example:</strong> Spinach wilting → tonight's pasta gets spinach. Leftover chicken from Monday →
                Wednesday's soup base.
              </p>
            </div>

            {/* Rotation After Shopping */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-5 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-blue-100 text-blue-700 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold flex-shrink-0">5m</span>
                <h3 className="font-heading text-jk-clay text-lg">Rotation When Adding New Groceries</h3>
              </div>
              <p className="text-sm text-jk-charcoal/70 mb-3">
                When putting groceries away, don't just shove new items in front. Pull older items forward.
                New milk goes behind old milk. New yogurt behind old yogurt. Takes 5 extra minutes, saves hours of regret.
              </p>
              <p className="text-xs text-jk-charcoal/60 italic">
                <strong>Pro tip:</strong> Before shopping, take a photo of your fridge. Prevents buying duplicates
                and helps you remember what needs rotating.
              </p>
            </div>

            {/* Weekly Deep Check */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-5 rounded-xl border border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <span className="bg-purple-100 text-purple-700 rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold flex-shrink-0">5m</span>
                <h3 className="font-heading text-jk-clay text-lg">Weekly FIFO Deep Check</h3>
              </div>
              <p className="text-sm text-jk-charcoal/70 mb-3">
                Once a week (Sunday works well), check all fridge zones: crisper drawers, back of shelves,
                door compartments. Update dates, consolidate open containers, wipe down shelves while rotating.
              </p>
              <p className="text-xs text-jk-charcoal/60 italic">
                <strong>Bonus:</strong> This prevents mystery spills from becoming permanent fridge residents.
              </p>
            </div>
          </div>
        </div>

        {/* Common FIFO Mistakes */}
        <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-8 mb-12 border-2 border-red-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            ⚠️ Common FIFO Mistakes (and How to Fix Them)
          </h2>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-red-200">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-2xl flex-shrink-0">✗</span>
                <div>
                  <h3 className="font-heading text-jk-clay mb-2">Pushing New Items to Front</h3>
                  <p className="text-sm text-jk-charcoal/70 mb-2">
                    <strong>The mistake:</strong> You buy fresh milk, put it in front because it's easier. Old milk
                    gets buried, expires unused.
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>The fix:</strong> Always pull older items forward when adding new. Make this non-negotiable.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-red-200">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-2xl flex-shrink-0">✗</span>
                <div>
                  <h3 className="font-heading text-jk-clay mb-2">Ignoring Hidden Back Corners</h3>
                  <p className="text-sm text-jk-charcoal/70 mb-2">
                    <strong>The mistake:</strong> Only looking at front of shelves. Back corners become "out of sight,
                    out of mind" zones.
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>The fix:</strong> Weekly deep check includes rotating items from back to front. Consider
                    using turntables for deep shelves.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-red-200">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-2xl flex-shrink-0">✗</span>
                <div>
                  <h3 className="font-heading text-jk-clay mb-2">Not Checking Dates Regularly</h3>
                  <p className="text-sm text-jk-charcoal/70 mb-2">
                    <strong>The mistake:</strong> Assuming you remember when you opened that yogurt. Spoiler: you don't.
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>The fix:</strong> Date everything when you open it. Set weekly reminder to check dates.
                    Use phone calendar: "Every Sunday: Check fridge dates."
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-red-200">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-2xl flex-shrink-0">✗</span>
                <div>
                  <h3 className="font-heading text-jk-clay mb-2">Forgetting Frozen Items</h3>
                  <p className="text-sm text-jk-charcoal/70 mb-2">
                    <strong>The mistake:</strong> "It's frozen, so it lasts forever." Quality degrades after 3-6 months.
                    You end up with freezer-burned mystery bags.
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>The fix:</strong> Date everything going into freezer. Quarterly audit (every 3 months).
                    Items older than 6 months go on "use this month" list.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-red-200">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-2xl flex-shrink-0">✗</span>
                <div>
                  <h3 className="font-heading text-jk-clay mb-2">Treating Pantry Differently Than Fridge</h3>
                  <p className="text-sm text-jk-charcoal/70 mb-2">
                    <strong>The mistake:</strong> FIFO for fridge, chaos for pantry. Pantry items have expiration
                    dates too—they're just farther out.
                  </p>
                  <p className="text-sm text-green-700">
                    <strong>The fix:</strong> Apply same FIFO principles to pantry. Check dates every 3 months.
                    Rotate cans/boxes when restocking.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Storage by Category */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-8 mb-12 border-2 border-indigo-200">
          <div className="flex items-start gap-4 mb-6">
            <Eye className="h-12 w-12 text-indigo-600 flex-shrink-0" />
            <div>
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Storage & Timing by Category
              </h2>
              <p className="text-base text-jk-charcoal/70">
                Different foods have different lifespans. Here's how to recognize when items need using soon.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">🥬 Produce: Watch for Wilting</h3>
              <div className="text-sm text-jk-charcoal/70 space-y-2">
                <p>
                  <strong>First signs:</strong> Leafy greens losing crispness, herbs drooping, berries softening,
                  bananas developing brown spots
                </p>
                <p>
                  <strong>Rescue moves:</strong> Sauté wilting greens, freeze browning bananas, roast softening
                  vegetables, blend herbs into pesto or freeze in oil
                </p>
                <p className="text-xs text-jk-charcoal/60 italic">
                  Pro tip: Wilted lettuce can be "shocked" back to life in ice water for 10 minutes
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">🥛 Dairy: Strict Date Management</h3>
              <div className="text-sm text-jk-charcoal/70 space-y-2">
                <p>
                  <strong>Timing:</strong> Milk (7-10 days after opening), yogurt (7-14 days), cheese (varies by type),
                  sour cream (10-14 days)
                </p>
                <p>
                  <strong>Rescue moves:</strong> Milk approaching expiration → make pancakes, baked goods, or freeze
                  in ice cube trays. Extra yogurt → smoothies, marinades, baking
                </p>
                <p className="text-xs text-jk-charcoal/60 italic">
                  Note: "Best by" dates on dairy are conservative. Smell test is reliable if stored properly.
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">🍗 Proteins: Cooked vs. Raw</h3>
              <div className="text-sm text-jk-charcoal/70 space-y-2">
                <p>
                  <strong>Raw:</strong> Chicken/fish (1-2 days), ground meat (1-2 days), steaks/chops (3-5 days)
                </p>
                <p>
                  <strong>Cooked:</strong> All proteins (3-4 days max). This is non-negotiable for food safety.
                </p>
                <p>
                  <strong>Rescue moves:</strong> Raw approaching limit → cook immediately, then extend shelf life.
                  Cooked on day 3 → tonight's dinner or freeze now.
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">🍲 Leftovers: The 3-4 Day Rule</h3>
              <div className="text-sm text-jk-charcoal/70 space-y-2">
                <p>
                  <strong>Safe zone:</strong> Most leftovers are good for 3-4 days in the fridge. After that,
                  quality and safety decline rapidly.
                </p>
                <p>
                  <strong>Strategy:</strong> Date containers when storing. Move to "Use First" shelf on day 2.
                  Freeze on day 3 if you won't eat soon.
                </p>
                <p className="text-xs text-jk-charcoal/60 italic">
                  Transform leftovers: Last night's roast chicken → today's chicken salad or soup
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-indigo-200">
              <h3 className="font-heading text-jk-clay mb-2">🍞 Bread & Baked Goods: Counter or Freezer</h3>
              <div className="text-sm text-jk-charcoal/70 space-y-2">
                <p>
                  <strong>Counter:</strong> Fresh bread (2-3 days), then gets stale
                </p>
                <p>
                  <strong>Freezer:</strong> Bread freezes beautifully. Slice before freezing, toast from frozen.
                </p>
                <p>
                  <strong>Rescue moves:</strong> Stale bread → breadcrumbs (food processor), croutons (cube and toast),
                  French toast, bread pudding
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Tips */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl p-8 mb-12 border-2 border-green-200">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            📱 Tech Tips for Modern FIFO
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6">
            Technology can support your FIFO system—but don't let it become a burden. Keep it simple.
          </p>

          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay mb-2">📸 Phone Camera: Your Best Tool</h3>
              <p className="text-sm text-jk-charcoal/70">
                <strong>Before grocery shopping:</strong> Open fridge, take photo. Prevents duplicate purchases
                and reminds you what needs using. Delete photo after shopping.
                <br/><br/>
                <strong>After grocery shopping:</strong> Take another photo. Compare before/after to verify you
                rotated items properly. Sounds obsessive, but it builds the habit fast.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay mb-2">🔔 Calendar Reminders</h3>
              <p className="text-sm text-jk-charcoal/70">
                Set recurring reminders:
                <br/>• Daily 8am: "Quick fridge check"
                <br/>• Weekly Sunday 10am: "Deep FIFO rotation"
                <br/>• Quarterly (1st of Jan/Apr/Jul/Oct): "Freezer audit"
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay mb-2">🍽️ Integration with Joanie's Fridge Feature</h3>
              <p className="text-sm text-jk-charcoal/70">
                Use our <Link href="/fridge" className="text-jk-tomato hover:underline font-semibold">What's in Your Fridge?</Link> tool
                to search recipes by ingredients. When you identify items that need using (via FIFO), search for recipes
                using those ingredients. Turns expiring items into tonight's dinner.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-green-200">
              <h3 className="font-heading text-jk-clay mb-2">📝 Inventory Apps (Optional)</h3>
              <p className="text-sm text-jk-charcoal/70 mb-2">
                Apps like "NoWaste" or "FreshBox" can track expiration dates. They're helpful for some people,
                overkill for others. Try for a month and decide.
              </p>
              <p className="text-xs text-jk-charcoal/60 italic">
                Joanie's take: "If the app becomes a chore, you'll stop using it. Visual systems (masking tape, clear
                zones) work better for most home cooks."
              </p>
            </div>
          </div>
        </div>

        {/* Key Principles */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <h2 className="text-2xl font-heading text-jk-olive mb-6">
            🎯 FIFO Success Principles
          </h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <ChevronRight className="h-6 w-6 text-jk-tomato flex-shrink-0 mt-1" />
              <div>
                <p className="font-heading text-jk-clay mb-1 text-lg">
                  "Every meal starts with: What do I have that might go bad?"
                </p>
                <p className="text-sm text-jk-charcoal/70">
                  This question shift is transformative. Instead of planning meals then shopping, check inventory
                  first. Build meals around what needs using.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <ChevronRight className="h-6 w-6 text-jk-tomato flex-shrink-0 mt-1" />
              <div>
                <p className="font-heading text-jk-clay mb-1 text-lg">
                  Rotation is a habit, not a chore
                </p>
                <p className="text-sm text-jk-charcoal/70">
                  The first few weeks feel tedious. After that, it becomes automatic—like checking your mirrors when
                  driving. Stick with it for 21 days.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <ChevronRight className="h-6 w-6 text-jk-tomato flex-shrink-0 mt-1" />
              <div>
                <p className="font-heading text-jk-clay mb-1 text-lg">
                  5 minutes daily beats 30 minutes weekly
                </p>
                <p className="text-sm text-jk-charcoal/70">
                  Quick daily checks prevent problems from accumulating. A 30-second morning scan catches issues
                  before they become waste.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <ChevronRight className="h-6 w-6 text-jk-tomato flex-shrink-0 mt-1" />
              <div>
                <p className="font-heading text-jk-clay mb-1 text-lg">
                  Visual systems work better than memory
                </p>
                <p className="text-sm text-jk-charcoal/70">
                  Don't rely on remembering when you opened that container. Date it. Move aging items to the front.
                  Make the system do the remembering for you.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <ChevronRight className="h-6 w-6 text-jk-tomato flex-shrink-0 mt-1" />
              <div>
                <p className="font-heading text-jk-clay mb-1 text-lg">
                  Flexibility over perfection
                </p>
                <p className="text-sm text-jk-charcoal/70">
                  Some weeks you'll rotate perfectly. Some weeks you'll forget and find wilted lettuce. That's okay.
                  Progress, not perfection. Each item you save is a win.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FIFO Success Story */}
        <div className="bg-gradient-to-br from-jk-sage/10 to-jk-olive/5 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            💚 Real FIFO Success Story
          </h2>
          <div className="bg-white p-6 rounded-xl border border-jk-sage/30">
            <p className="text-base text-jk-charcoal/80 italic mb-4 leading-relaxed">
              "Before FIFO, I found wilted lettuce, expired yogurt, or moldy cheese in the back of my fridge
              every single week. I felt guilty every time I threw food away—money wasted, food wasted, time wasted.
            </p>
            <p className="text-base text-jk-charcoal/80 italic mb-4 leading-relaxed">
              After implementing FIFO—specifically the 'Use First' shelf and dating everything—my waste dropped to
              near zero. Now when I see lettuce starting to wilt, I make a big salad for lunch. When berries are
              getting soft, they go into morning smoothies. When chicken is on day 3, it becomes dinner or gets frozen.
            </p>
            <p className="text-base text-jk-charcoal/80 italic leading-relaxed">
              The system isn't about being perfect. It's about making aging food visible and impossible to ignore.
              My fridge tells me what to cook. I listen."
            </p>
            <p className="text-sm text-jk-clay mt-4 text-right">— Home cook, 8 months of FIFO practice</p>
          </div>
        </div>

        {/* Call to Action */}
        <div className="bg-gradient-to-br from-jk-olive/5 to-jk-sage/10 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-heading text-jk-olive mb-4">
            Ready to Put FIFO into Practice?
          </h2>
          <p className="text-base text-jk-charcoal/70 mb-6 max-w-2xl mx-auto leading-relaxed">
            Check your fridge right now. What needs using soon? Let's find recipes that turn those ingredients
            into tonight's dinner.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" asChild className="bg-jk-tomato hover:bg-jk-tomato/90">
              <Link href="/fridge">
                Search Recipes by Ingredients
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="border-jk-olive text-jk-olive hover:bg-jk-olive/5">
              <Link href="/learn">
                More Learning Resources
              </Link>
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
