'use client';

import { SemanticSearchPanel } from '@/components/recipe/SemanticSearchPanel';

export default function SemanticSearchPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Semantic Recipe Search</h1>
          <p className="text-muted-foreground text-lg">
            Use natural language to find recipes that match what you're craving. Try queries like
            "comfort food for cold weather" or "quick healthy dinner".
          </p>
        </div>

        <SemanticSearchPanel />

        <div className="mt-12 border-t pt-8">
          <h2 className="text-xl font-semibold mb-4">Example Searches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              'spicy comfort food',
              'quick easy pasta',
              'healthy breakfast ideas',
              'warming winter soup',
              'light summer salad',
              'decadent chocolate dessert',
              'Asian fusion dinner',
              'kid-friendly weeknight meals',
              'romantic dinner for two',
            ].map((example) => (
              <button
                key={example}
                className="p-4 text-left border rounded-lg hover:bg-accent transition-colors"
                onClick={() => {
                  const input = document.querySelector(
                    'input[placeholder*="Describe"]'
                  ) as HTMLInputElement;
                  if (input) {
                    input.value = example;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    // Trigger search
                    const searchButton = document.querySelector(
                      'button:has-text("Search")'
                    ) as HTMLButtonElement;
                    searchButton?.click();
                  }
                }}
              >
                <p className="font-medium">{example}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t pt-8">
          <h2 className="text-xl font-semibold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-2xl">
                1
              </div>
              <h3 className="font-semibold">Natural Language Query</h3>
              <p className="text-sm text-muted-foreground">
                Describe what you want in plain English. No need for exact recipe names.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-2xl">
                2
              </div>
              <h3 className="font-semibold">AI Understanding</h3>
              <p className="text-sm text-muted-foreground">
                Our AI converts your query into a semantic embedding and finds similar recipes.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-2xl">
                3
              </div>
              <h3 className="font-semibold">Smart Results</h3>
              <p className="text-sm text-muted-foreground">
                Get recipes ranked by similarity, with filtering options for cuisine, difficulty,
                and dietary needs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
