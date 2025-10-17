import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function MealsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <div className="h-10 w-48 bg-jk-sage/20 rounded animate-pulse mb-2" />
          <div className="h-5 w-96 bg-jk-sage/10 rounded animate-pulse" />
        </div>
        <Button
          disabled
          className="bg-jk-tomato/50 text-white min-h-[44px] touch-manipulation font-ui"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Meal
        </Button>
      </div>

      {/* Filter skeleton */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="h-5 w-24 bg-jk-sage/20 rounded animate-pulse" />
          <div className="h-10 w-full sm:w-48 bg-jk-sage/10 rounded animate-pulse" />
        </div>
      </div>

      {/* Meals grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="h-64 animate-pulse bg-jk-sage/5 border-jk-sage/30" />
        ))}
      </div>
    </div>
  );
}
