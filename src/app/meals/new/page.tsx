import { ChefHat, LayoutTemplate, Loader2 } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { MealBuilder } from '@/components/meals/MealBuilder';
import { MealTemplateSelector } from '@/components/meals/MealTemplateSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { auth } from '@/lib/auth';

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-jk-sage" />
    </div>
  );
}

export default async function NewMealPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-heading text-jk-olive mb-2">Create New Meal</h1>
        <p className="text-jk-charcoal/70 font-body">
          Build a meal from scratch or start with a template
        </p>
      </div>

      {/* Tabs for different creation methods */}
      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="builder" className="font-ui">
            <ChefHat className="w-4 h-4 mr-2" />
            Build Meal
          </TabsTrigger>
          <TabsTrigger value="templates" className="font-ui">
            <LayoutTemplate className="w-4 h-4 mr-2" />
            Use Template
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder">
          <Suspense fallback={<LoadingSkeleton />}>
            <MealBuilder />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates">
          <Suspense fallback={<LoadingSkeleton />}>
            <MealTemplateSelector />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const metadata = {
  title: "Create New Meal | Joanie's Kitchen",
  description: 'Create a new meal plan',
};
