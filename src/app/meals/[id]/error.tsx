'use client';

import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function MealDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Meal detail page error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Back button */}
      <Link
        href="/meals"
        className="inline-flex items-center gap-2 text-jk-olive hover:text-jk-clay mb-6 font-ui"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Meals
      </Link>

      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-heading">Failed to load meal details</AlertTitle>
        <AlertDescription className="font-body">
          {error.message || 'An unexpected error occurred while loading the meal.'}
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
