import { RecipeCrawlPanel } from '@/components/recipe/RecipeCrawlPanel';

export default function AdminCrawlPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recipe Web Crawler</h2>
        <p className="text-gray-600 mt-2">
          Search for recipes online and automatically import them into your database
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <RecipeCrawlPanel />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
          <li>Enter a recipe search query (e.g., &quot;chocolate chip cookies&quot;)</li>
          <li>SerpAPI searches the web for quality recipe sources</li>
          <li>AI extracts recipe data from each URL</li>
          <li>Recipes are validated for quality and completeness</li>
          <li>Approved recipes are saved with images and embeddings</li>
        </ol>
      </div>
    </div>
  );
}
