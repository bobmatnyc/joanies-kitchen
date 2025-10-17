import { ChefHat, LayoutTemplate } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function NewMealLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="h-10 w-72 bg-jk-sage/20 rounded animate-pulse mb-2" />
        <div className="h-5 w-96 bg-jk-sage/10 rounded animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="w-full">
        <div className="grid w-full max-w-md grid-cols-2 gap-2 mb-8">
          <div className="h-10 bg-jk-sage/20 rounded animate-pulse flex items-center justify-center">
            <ChefHat className="w-4 h-4 text-jk-sage/40 mr-2" />
            <span className="text-jk-sage/40 font-ui">Build Meal</span>
          </div>
          <div className="h-10 bg-jk-sage/10 rounded animate-pulse flex items-center justify-center">
            <LayoutTemplate className="w-4 h-4 text-jk-sage/40 mr-2" />
            <span className="text-jk-sage/40 font-ui">Use Template</span>
          </div>
        </div>

        {/* Form skeleton */}
        <div className="space-y-6">
          {/* Basic info card */}
          <Card className="border-jk-sage/50">
            <CardContent className="p-6">
              <div className="h-7 w-40 bg-jk-sage/20 rounded animate-pulse mb-4" />
              <div className="space-y-4">
                {/* Meal name */}
                <div>
                  <div className="h-5 w-24 bg-jk-sage/10 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-jk-sage/5 rounded animate-pulse" />
                </div>
                {/* Description */}
                <div>
                  <div className="h-5 w-32 bg-jk-sage/10 rounded animate-pulse mb-2" />
                  <div className="h-24 w-full bg-jk-sage/5 rounded animate-pulse" />
                </div>
                {/* Type and occasion */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="h-5 w-20 bg-jk-sage/10 rounded animate-pulse mb-2" />
                    <div className="h-10 w-full bg-jk-sage/5 rounded animate-pulse" />
                  </div>
                  <div>
                    <div className="h-5 w-24 bg-jk-sage/10 rounded animate-pulse mb-2" />
                    <div className="h-10 w-full bg-jk-sage/5 rounded animate-pulse" />
                  </div>
                </div>
                {/* Servings */}
                <div>
                  <div className="h-5 w-20 bg-jk-sage/10 rounded animate-pulse mb-2" />
                  <div className="h-10 w-32 bg-jk-sage/5 rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recipe search card */}
          <Card className="border-jk-sage/50">
            <CardContent className="p-6">
              <div className="h-7 w-32 bg-jk-sage/20 rounded animate-pulse mb-4" />
              <div className="space-y-4">
                <div className="h-10 w-full bg-jk-sage/5 rounded animate-pulse" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-32 bg-jk-sage/5 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <div className="h-11 w-24 bg-jk-sage/20 rounded animate-pulse" />
            <div className="h-11 w-32 bg-jk-sage/20 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
