import { ArrowLeft, BookOpen, ExternalLink, Package } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getIngredientBySlug } from '@/app/actions/ingredients';
import { JoanieComment } from '@/components/recipe/JoanieComment';
import { Button } from '@/components/ui/button';

interface IngredientPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: IngredientPageProps) {
  const { slug } = await params;
  const result = await getIngredientBySlug(slug);

  if (!result.success || !result.ingredient) {
    return {
      title: 'Ingredient Not Found',
    };
  }

  const { ingredient } = result;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://recipes.help';
  const canonicalUrl = `${baseUrl}/ingredients/${slug}`;

  return {
    title: `${ingredient.display_name} | Ingredient Guide | Joanie's Kitchen`,
    description:
      ingredient.description ||
      `Learn about ${ingredient.display_name} - storage tips, substitutions, and recipes using this ingredient.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${ingredient.display_name} | Ingredient Guide`,
      description:
        ingredient.description ||
        `Learn about ${ingredient.display_name} - storage tips, substitutions, and recipes.`,
      url: canonicalUrl,
      type: 'article',
      images: ingredient.image_url
        ? [
            {
              url: ingredient.image_url,
              width: 1200,
              height: 630,
              alt: ingredient.display_name,
            },
          ]
        : undefined,
    },
    keywords: [
      ingredient.display_name,
      ingredient.name,
      `${ingredient.display_name} substitutes`,
      `${ingredient.display_name} storage`,
      `recipes with ${ingredient.display_name}`,
      ingredient.category,
    ].filter(Boolean),
  };
}

/**
 * Individual Ingredient Detail Page
 *
 * Displays comprehensive information about a specific ingredient:
 * - Name, category, and image
 * - Description and general information
 * - Joanie's personal notes and tips
 * - Storage tips
 * - Substitution suggestions
 * - Recipes using this ingredient
 * - Usage statistics
 *
 * Features:
 * - Link to fridge search with ingredient pre-filled
 * - Recipe cards for related recipes
 * - Mobile-responsive design
 * - SEO-friendly URLs with slugs
 */
export default async function IngredientPage({ params }: IngredientPageProps) {
  const { slug } = await params;
  const result = await getIngredientBySlug(slug);

  if (!result.success || !result.ingredient) {
    notFound();
  }

  const { ingredient, joanieComment, recipesUsingIngredient } = result;

  // Parse substitutions if available
  let substitutions: string[] = [];
  if (ingredient.substitutions) {
    try {
      substitutions = JSON.parse(ingredient.substitutions);
    } catch {
      // Ignore parse errors
    }
  }

  const usageCount = ingredient.usage_count || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/ingredients"
            className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Ingredients
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
                {ingredient.image_url ? (
                  <Image
                    src={ingredient.image_url}
                    alt={ingredient.display_name}
                    fill
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 dark:bg-gray-700">
                    <Package className="h-24 w-24 text-gray-300 dark:text-gray-600" />
                  </div>
                )}
              </div>

              {/* Basic Info Card */}
              <div className="p-6 space-y-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {ingredient.display_name}
                  </h1>
                  {ingredient.category && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 capitalize">
                      Category: <span className="font-medium">{ingredient.category}</span>
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

                  {ingredient.is_common && (
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-400">
                        Popular Ingredient
                      </span>
                    </div>
                  )}

                  {ingredient.is_allergen && (
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-400">
                        Common Allergen
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <Link
                  href={`/fridge?ingredient=${encodeURIComponent(ingredient.name)}`}
                  className="block"
                >
                  <Button className="w-full" variant="default">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Find Recipes with {ingredient.display_name}
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Right Column: Details and Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {ingredient.description && (
              <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  About {ingredient.display_name}
                </h2>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {ingredient.description}
                </p>
              </div>
            )}

            {/* Joanie's Comment */}
            {joanieComment && (
              <div>
                <JoanieComment comment={joanieComment} />
              </div>
            )}

            {/* Storage Tips */}
            {ingredient.storage_tips && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-6">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-3">
                  Storage Tips
                </h3>
                <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                  {ingredient.storage_tips}
                </p>
              </div>
            )}

            {/* Substitutions */}
            {substitutions.length > 0 && (
              <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-6">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-3">
                  Substitutions
                </h3>
                <ul className="space-y-2">
                  {substitutions.map((sub, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-purple-800 dark:text-purple-200"
                    >
                      <span className="text-purple-400 dark:text-purple-500 mt-1">•</span>
                      <span>{sub}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recipes Using This Ingredient */}
            {recipesUsingIngredient && recipesUsingIngredient.length > 0 && (
              <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Recipes Featuring {ingredient.display_name}
                  </h2>
                  <Link
                    href={`/fridge?ingredient=${encodeURIComponent(ingredient.name)}`}
                    className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                  >
                    View all {usageCount}
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {recipesUsingIngredient.slice(0, 6).map((recipe: any) => (
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
          </div>
        </div>
      </div>
    </div>
  );
}
