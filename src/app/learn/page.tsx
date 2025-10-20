/**
 * Learn Techniques - Main Landing Page
 * Week 4 Task 5.3: Educational content on zero-waste cooking
 *
 * Hub for techniques, guides, and educational content
 */

import Link from 'next/link';
import { GraduationCap, Recycle, Shuffle, Soup, BookOpen } from 'lucide-react';

export const metadata = {
  title: 'Learn Zero-Waste Techniques | Joanie\'s Kitchen',
  description: 'Master zero-waste cooking techniques. Learn FIFO principles, substitution strategies, stock from scraps, and Joanie\'s resourceful approach.',
};

const techniques = [
  {
    slug: 'zero-waste-kitchen',
    name: 'Zero-Waste Kitchen',
    icon: Recycle,
    description: 'FIFO principles, scrap utilization, composting basics, and storage tips',
    topics: ['FIFO (First In, First Out)', 'Scrap utilization guide', 'Composting basics', 'Storage tips by ingredient'],
    color: 'from-green-100 to-emerald-100',
    borderColor: 'border-green-300',
    iconColor: 'text-green-600',
  },
  {
    slug: 'substitution-guide',
    name: 'Substitution Guide',
    icon: Shuffle,
    description: 'Common substitutions by category, why they work, confidence levels',
    topics: ['Butter, oils, fats', 'Acids (lemon, vinegar, wine)', 'Dairy alternatives', 'Protein swaps'],
    color: 'from-blue-100 to-cyan-100',
    borderColor: 'border-blue-300',
    iconColor: 'text-blue-600',
  },
  {
    slug: 'stock-from-scraps',
    name: 'Stock from Scraps',
    icon: Soup,
    description: 'Turn vegetable scraps and bones into flavorful stock',
    topics: ['What scraps to save', 'Basic stock recipes', 'Storage and freezing', 'Using stock in recipes'],
    color: 'from-amber-100 to-orange-100',
    borderColor: 'border-amber-300',
    iconColor: 'text-amber-600',
  },
];

export default function LearnPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-jk-cream via-white to-blue-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

        {/* Page Header */}
        <div className="text-center mb-12">
          <GraduationCap className="h-16 w-16 text-jk-sage mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-heading text-jk-olive mb-4">
            Learn Zero-Waste Techniques
          </h1>
          <p className="text-xl text-jk-charcoal/80 font-body max-w-3xl mx-auto leading-relaxed">
            Master the skills and strategies that help you
            <strong className="text-jk-sage"> waste less food and cook with confidence</strong>.
          </p>
        </div>

        {/* Joanie's Approach Callout */}
        <div className="bg-gradient-to-r from-jk-sage/10 to-green-100/50 rounded-2xl p-8 mb-12 border-2 border-jk-sage/30">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-heading text-jk-olive mb-3">
              👩‍🍳 Joanie's Cooking Philosophy
            </h2>
            <blockquote className="text-lg italic text-jk-charcoal/80 mb-4 leading-relaxed">
              "I don't cook from recipes. I cook from my fridge. Every meal starts with the same question:
              What do I have that might go bad?"
            </blockquote>
            <p className="text-base text-jk-charcoal/70 leading-relaxed">
              These techniques are the foundation of Joanie's resourceful approach. Learn to see your kitchen
              through her eyes: flexible, forgiving, and focused on using what you have.
            </p>
          </div>
        </div>

        {/* Technique Guides */}
        <div className="mb-12">
          <h2 className="text-3xl font-heading text-jk-olive mb-8 text-center">
            Core Techniques
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {techniques.map((technique) => {
              const IconComponent = technique.icon;
              return (
                <Link
                  key={technique.slug}
                  href={`/learn/${technique.slug}`}
                  className="group"
                >
                  <div className={`bg-gradient-to-br ${technique.color} p-6 rounded-2xl border-2 ${technique.borderColor} hover:shadow-lg transition-all duration-200 hover:scale-[1.02] h-full`}>
                    <div className={`${technique.iconColor} mb-4`}>
                      <IconComponent className="h-12 w-12" />
                    </div>
                    <h3 className="text-xl font-heading text-jk-olive mb-3 group-hover:text-jk-clay transition-colors">
                      {technique.name}
                    </h3>
                    <p className="text-base text-jk-charcoal/70 mb-4 leading-relaxed">
                      {technique.description}
                    </p>
                    <div className="space-y-2">
                      {technique.topics.map((topic) => (
                        <div key={topic} className="flex items-start gap-2">
                          <span className="text-jk-sage text-sm mt-0.5">•</span>
                          <span className="text-sm text-jk-charcoal/60">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Philosophy Page Link */}
        <div className="bg-white rounded-2xl p-8 mb-12 border-2 border-jk-sage/20">
          <div className="flex items-start gap-6">
            <BookOpen className="h-12 w-12 text-jk-clay flex-shrink-0" />
            <div className="flex-1">
              <h2 className="text-2xl font-heading text-jk-olive mb-3">
                Joanie's Full Story
              </h2>
              <p className="text-base text-jk-charcoal/70 mb-4 leading-relaxed">
                Learn more about Joanie's philosophy on cooking, gardening, and food waste.
                Her approach to resourcefulness goes beyond the kitchen — it's a way of life.
              </p>
              <Link
                href="/philosophy"
                className="inline-flex items-center gap-2 text-jk-sage hover:text-jk-olive transition-colors font-medium"
              >
                Read Joanie's Philosophy
                <span className="text-lg">→</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Tips Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Tip 1 */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border-2 border-purple-200">
            <h3 className="text-lg font-heading text-jk-olive mb-3">
              💡 Start with FIFO
            </h3>
            <p className="text-base text-jk-charcoal/70 leading-relaxed">
              First In, First Out. Check your fridge regularly and use older ingredients first.
              This single habit prevents most food waste.
            </p>
          </div>

          {/* Quick Tip 2 */}
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-6 rounded-xl border-2 border-yellow-200">
            <h3 className="text-lg font-heading text-jk-olive mb-3">
              🔄 Embrace Substitutions
            </h3>
            <p className="text-base text-jk-charcoal/70 leading-relaxed">
              Most recipes are more flexible than you think. Learning common substitutions means you can
              cook with what you have instead of shopping for what you don't.
            </p>
          </div>

          {/* Quick Tip 3 */}
          <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-6 rounded-xl border-2 border-teal-200">
            <h3 className="text-lg font-heading text-jk-olive mb-3">
              🥕 Save Your Scraps
            </h3>
            <p className="text-base text-jk-charcoal/70 leading-relaxed">
              Vegetable peels, herb stems, chicken bones — all make incredible stock.
              Keep a bag in your freezer and add scraps until you have enough.
            </p>
          </div>

          {/* Quick Tip 4 */}
          <div className="bg-gradient-to-br from-rose-50 to-red-50 p-6 rounded-xl border-2 border-rose-200">
            <h3 className="text-lg font-heading text-jk-olive mb-3">
              ❄️ Freeze Before It's Too Late
            </h3>
            <p className="text-base text-jk-charcoal/70 leading-relaxed">
              When ingredients are about to turn, freeze them. Bread, herbs, overripe bananas, cooked proteins
              — all freeze well and extend their usable life dramatically.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
