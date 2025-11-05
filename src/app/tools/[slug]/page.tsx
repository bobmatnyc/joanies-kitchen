import { ArrowLeft, BookOpen, DollarSign, Wrench } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getToolBySlug } from '@/app/actions/tools';
import { Button } from '@/components/ui/button';

interface ToolPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: ToolPageProps) {
  const { slug } = await params;
  const result = await getToolBySlug(slug);

  if (!result.success || !result.tool) {
    return {
      title: 'Tool Not Found',
    };
  }

  const { tool } = result;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://recipes.help';
  const canonicalUrl = `${baseUrl}/tools/${slug}`;

  return {
    title: `${tool.displayName} | Kitchen Tools | Joanie's Kitchen`,
    description:
      tool.description ||
      `Learn about ${tool.displayName} - alternatives, pricing, and recipes using this kitchen tool.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${tool.displayName} | Kitchen Tools`,
      description:
        tool.description ||
        `Learn about ${tool.displayName} - alternatives, pricing, and recipes.`,
      url: canonicalUrl,
      type: 'article',
      images: tool.imageUrl
        ? [
            {
              url: tool.imageUrl,
              width: 1200,
              height: 630,
              alt: tool.displayName,
            },
          ]
        : undefined,
    },
    keywords: [
      tool.displayName,
      tool.name,
      `${tool.displayName} alternatives`,
      `${tool.displayName} recipes`,
      tool.category,
      'kitchen tools',
      'cooking equipment',
    ].filter(Boolean),
  };
}

/**
 * Individual Tool Detail Page
 *
 * Displays comprehensive information about a specific kitchen tool:
 * - Name, category, and image
 * - Description and general information
 * - Type/subtype classification
 * - Essential/specialized badges
 * - Alternatives
 * - Price information
 * - Recipes using this tool
 *
 * Features:
 * - Recipe cards for related recipes
 * - Mobile-responsive design
 * - SEO-friendly URLs with slugs
 */
export default async function ToolPage({ params }: ToolPageProps) {
  const { slug } = await params;
  const result = await getToolBySlug(slug);

  if (!result.success || !result.tool) {
    notFound();
  }

  const { tool, recipesUsingTool } = result;

  // Parse alternatives if available
  let alternatives: string[] = [];
  if (tool.alternatives) {
    try {
      alternatives = JSON.parse(tool.alternatives);
    } catch {
      // Ignore parse errors
    }
  }

  const usageCount = tool.usageCount || 0;
  const price = tool.typicalPriceUsd ? parseFloat(tool.typicalPriceUsd) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Tools
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Image and Basic Info */}
          <div className="lg:col-span-1">
            {/* Image */}
            <div className="rounded-lg overflow-hidden bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="relative aspect-square w-full">
                {tool.imageUrl ? (
                  <Image
                    src={tool.imageUrl}
                    alt={tool.displayName}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-700">
                    <Wrench className="h-24 w-24 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
              </div>

              {/* Basic Info Card */}
              <div className="p-6 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {tool.displayName}
                  </h1>
                  {tool.category && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                      Category: <span className="font-medium">{tool.category}</span>
                    </p>
                  )}
                  {tool.type && (
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      Type: <span className="font-medium">{tool.subtype || tool.type}</span>
                    </p>
                  )}
                </div>

                {/* Stats */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Used in recipes:</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {usageCount}
                    </span>
                  </div>

                  {tool.isEssential && (
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-400">
                        Essential Tool
                      </span>
                    </div>
                  )}

                  {tool.isSpecialized && (
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-3 py-1 text-sm font-medium text-purple-700 dark:text-purple-400">
                        Specialized Equipment
                      </span>
                    </div>
                  )}
                </div>

                {/* Price Information */}
                {price && (
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-gray-600 dark:text-gray-400">Typical Price:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        ${price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Details and Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {tool.description && (
              <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  About {tool.displayName}
                </h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {tool.description}
                </p>
              </div>
            )}

            {/* Alternatives */}
            {alternatives.length > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6">
                <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300 mb-3">
                  Alternatives
                </h3>
                <ul className="space-y-2">
                  {alternatives.map((alt, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-amber-800 dark:text-amber-200"
                    >
                      <span className="text-amber-400 dark:text-amber-500 mt-1">•</span>
                      <span>{alt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recipes Using This Tool */}
            {recipesUsingTool && recipesUsingTool.length > 0 && (
              <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Recipes Using {tool.displayName}
                  </h2>
                  {usageCount > 12 && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Showing 12 of {usageCount}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recipesUsingTool.slice(0, 12).map((recipe: any) => (
                    <Link
                      key={recipe.id}
                      href={`/recipes/${recipe.id}`}
                      className="group block rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-amber-500 dark:hover:border-amber-600 transition-colors"
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                        {recipe.name}
                      </h3>
                      {recipe.description && (
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {recipe.description}
                        </p>
                      )}
                      {recipe.cuisine && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-500 capitalize">
                          {recipe.cuisine}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* No Recipes Message */}
            {(!recipesUsingTool || recipesUsingTool.length === 0) && (
              <div className="rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 text-center">
                <Wrench className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">
                  No recipes using {tool.displayName} yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
