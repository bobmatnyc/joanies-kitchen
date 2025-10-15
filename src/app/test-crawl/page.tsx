import { RecipeCrawlPanel } from '@/components/recipe/RecipeCrawlPanel';

export default function TestCrawlPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Recipe Crawl Pipeline Test</h1>
      <RecipeCrawlPanel />
    </div>
  );
}
