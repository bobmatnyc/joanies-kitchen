'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function NewMealError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('New meal page error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading text-jk-olive mb-2">Create New Meal</h1>
        <p className="text-jk-charcoal/70 font-body">
          Build a meal from scratch or start with a template
        </p>
      </div>

      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-heading">Failed to load meal builder</AlertTitle>
        <AlertDescription className="font-body">
          {error.message || 'An unexpected error occurred while loading the meal creation form.'}
        </AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-4">
        <Button
          onClick={reset}
          className="bg-jk-tomato hover:bg-jk-tomato/90 text-white min-h-[44px] font-ui"
        >
          Try again
        </Button>
        <Button
          variant="outline"
          asChild
          className="min-h-[44px] border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
        >
          <Link href="/meals">Back to Meals</Link>
        </Button>
        <Button
          variant="outline"
          asChild
          className="min-h-[44px] border-jk-sage text-jk-olive hover:bg-jk-sage/10 font-ui"
        >
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
