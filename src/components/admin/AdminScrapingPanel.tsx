'use client';

import { useState } from 'react';
import { scrapeChefRecipes } from '@/app/actions/chef-scraping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';

export function AdminScrapingPanel() {
  const [chefSlug, setChefSlug] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(0);

    try {
      // Simulate progress (real implementation would use streaming)
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const result = await scrapeChefRecipes({
        chefSlug,
        sourceUrl,
        limit: 10
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (result.success) {
        const recipeCount = 'recipesScraped' in result ? result.recipesScraped : 0;
        setSuccess(`Successfully scraped ${recipeCount} recipes!`);
        setChefSlug('');
        setSourceUrl('');
        setTimeout(() => {
          setSuccess(null);
          setProgress(0);
        }, 5000);
      } else {
        const errorMsg = 'error' in result ? result.error : 'Failed to scrape recipes';
        setError(errorMsg || 'Failed to scrape recipes');
      }
    } catch (err) {
      console.error('Scraping failed:', err);
      setError('An unexpected error occurred during scraping');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scrape Chef Recipes</CardTitle>
        <CardDescription>
          Import recipes from a chef's website or public recipe collection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleScrape} className="space-y-4">
          <div>
            <Label htmlFor="chefSlug">Chef Slug *</Label>
            <Input
              id="chefSlug"
              value={chefSlug}
              onChange={(e) => setChefSlug(e.target.value)}
              required
              placeholder="gordon-ramsay"
            />
            <p className="text-xs text-jk-olive/60 mt-1">
              The chef must already exist in the system
            </p>
          </div>

          <div>
            <Label htmlFor="sourceUrl">Source URL *</Label>
            <Input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              required
              placeholder="https://example.com/recipes"
            />
            <p className="text-xs text-jk-olive/60 mt-1">
              URL to the recipe listing page or RSS feed
            </p>
          </div>

          {/* Progress Bar */}
          {isLoading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-jk-olive/60">Scraping recipes...</span>
                <span className="text-jk-olive">{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          )}

          {/* Success Message */}
          {success && (
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert className="border-red-500 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Info Box */}
          <div className="p-4 bg-jk-linen rounded-lg border border-jk-olive/20">
            <p className="text-sm text-jk-olive-dark mb-2">
              <strong>Supported Sources:</strong>
            </p>
            <ul className="text-xs text-jk-olive/80 space-y-1 list-disc list-inside">
              <li>Recipe websites with structured data (Schema.org)</li>
              <li>RSS feeds (XML format)</li>
              <li>JSON-LD recipe collections</li>
              <li>Popular recipe platforms (AllRecipes, Food Network, etc.)</li>
            </ul>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scraping Recipes...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Start Scraping
              </>
            )}
          </Button>
        </form>

        {/* Documentation Link */}
        <div className="mt-4 pt-4 border-t border-jk-olive/20">
          <a
            href="/docs/scraping-guide"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-jk-olive hover:text-jk-tomato transition-colors inline-flex items-center"
          >
            View Scraping Documentation
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
