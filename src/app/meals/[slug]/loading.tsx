import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';

export default function MealDetailLoading() {
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

      <div className="space-y-8">
        {/* Meal header skeleton */}
        <Card className="border-jk-sage">
          <div className="p-6">
            {/* Title and badge */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-64 bg-jk-sage/20 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-jk-sage/20 rounded animate-pulse" />
                </div>
                <div className="h-5 w-full max-w-2xl bg-jk-sage/10 rounded animate-pulse" />
                <div className="h-5 w-32 bg-jk-sage/10 rounded animate-pulse" />
              </div>
              <div className="h-11 w-24 bg-jk-sage/20 rounded animate-pulse" />
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-jk-sage/30">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 bg-jk-sage/10 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-jk-sage/20 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Recipes section skeleton */}
        <div className="space-y-6">
          <div className="h-8 w-32 bg-jk-sage/20 rounded animate-pulse" />

          {/* Course sections */}
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-jk-sage/50">
              <div className="p-6">
                <div className="h-7 w-40 bg-jk-sage/20 rounded animate-pulse mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="h-32 bg-jk-sage/5 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Shopping list section skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-8 w-40 bg-jk-sage/20 rounded animate-pulse" />
            <div className="h-11 w-52 bg-jk-sage/20 rounded animate-pulse" />
          </div>
          <Card className="h-64 animate-pulse bg-jk-sage/5 border-jk-sage/30" />
        </div>
      </div>
    </div>
  );
}
