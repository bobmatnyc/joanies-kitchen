import { ArrowLeft, Package, Wrench } from 'lucide-react';
import Link from 'next/link';
import { getAllTools } from '@/app/actions/tools';
import { ToolsContent } from '@/components/tool/ToolsContent';

/**
 * Kitchen Tools Directory Page
 *
 * Browse all kitchen tools with:
 * - Search functionality
 * - Sort by usage, alphabetical, category, or essential first
 * - Grid view with category badges
 * - Usage statistics from recipe_tools table
 *
 * Design mirrors /ingredients page for consistency
 *
 * Note: This is a Server Component that fetches initial data,
 * then passes it to a Client Component for interactive filtering.
 */
export default async function ToolsPage() {
  // Fetch initial tools on server
  const result = await getAllTools({
    limit: 100, // Load all tools for client-side filtering
    offset: 0,
    sort: 'usage',
  });

  // Handle error case
  if (!result.success || !result.tools) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 py-8">
            <Link
              href="/ingredients"
              className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Ingredients</span>
            </Link>

            <div className="flex items-center gap-4">
              <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
                <Wrench className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Kitchen Tools Directory
                </h1>
                <p className="mt-1 text-gray-600 dark:text-gray-400">
                  Essential tools and equipment mentioned in Joanie&apos;s recipes
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-6">
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-6 text-center">
            <p className="text-red-600 dark:text-red-400">
              {result.error || 'Failed to load tools'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Serialize tools data to remove Date objects (convert to ISO strings)
  const serializedTools = result.tools.map((tool) => ({
    ...tool,
    createdAt: tool.createdAt.toISOString(),
    updatedAt: tool.updatedAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-8">
          {/* Back to Ingredients */}
          <Link
            href="/ingredients"
            className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Ingredients</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
              <Wrench className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Kitchen Tools Directory
              </h1>
              <p className="mt-1 text-gray-600 dark:text-gray-400">
                Essential tools and equipment mentioned in Joanie&apos;s recipes
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Content (Client Component) */}
      <ToolsContent initialTools={serializedTools} initialTotalCount={result.totalCount} />

      {/* Footer Note */}
      <div className="container mx-auto px-4 py-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>New:</strong> Kitchen tools have been migrated to a dedicated tools table with
            rich ontology support (5 types, 48 subtypes). This enables better categorization,
            essential/specialized flags, alternative suggestions, and accurate usage tracking across
            all recipes.
          </p>
        </div>
      </div>
    </div>
  );
}
