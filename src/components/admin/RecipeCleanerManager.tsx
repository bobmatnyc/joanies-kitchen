'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface CleanResult {
  processed: number;
  skipped: number;
  errors: string[];
}

export function RecipeCleanerManager() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<CleanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClean() {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/admin/clean-recipes?limit=5', {
        method: 'POST',
      });

      const data = (await response.json()) as {
        success: boolean;
        data?: CleanResult;
        error?: string;
        hint?: string;
      };

      if (!response.ok || !data.success) {
        setError([data.error, data.hint].filter(Boolean).join(' — '));
      } else if (data.data) {
        setResult(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error contacting the server');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={handleClean}
          disabled={isRunning}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60"
        >
          {isRunning ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Cleaning recipes...
            </>
          ) : (
            'Clean Recipes (Local AI)'
          )}
        </Button>

        <p className="text-sm text-gray-500">
          Uses local Gemma model — requires Ollama running
        </p>
      </div>

      {result && (
        <div className="rounded-md bg-green-50 border border-green-200 p-4">
          <p className="text-sm font-medium text-green-800">
            Cleaned {result.processed} recipe{result.processed !== 1 ? 's' : ''}, skipped{' '}
            {result.skipped}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc list-inside text-sm text-yellow-700">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
}
