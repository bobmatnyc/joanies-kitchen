'use client';

import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function MealsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Meals page error:', error);
  }, [error]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle className="font-heading">Something went wrong!</AlertTitle>
        <AlertDescription className="font-body">
          Failed to load meals. {error.message}
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
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
