import { RecipeForm } from '@/components/recipe/RecipeForm';
import { AIRecipeUploader } from '@/components/recipe/AIRecipeUploader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

// Force dynamic rendering since we use authentication
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Create Recipe | Joanie\'s Kitchen',
  description: 'Create a new recipe with AI or detailed form'
};

export default async function NewRecipePage() {
  const { userId } = await auth();

  // Skip auth check for localhost development
  const isLocalhost = process.env.NODE_ENV === 'development';

  if (!userId && !isLocalhost) {
    // Redirect to sign-in with return URL
    redirect('/sign-in?returnUrl=/recipes/new');
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/recipes"
        className="inline-flex items-center text-sm text-jk-olive/60 hover:text-jk-olive mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Recipes
      </Link>

      <h1 className="text-4xl font-heading text-jk-olive mb-8">
        Create New Recipe
      </h1>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
          <TabsTrigger value="ai">AI Upload (Quick)</TabsTrigger>
          <TabsTrigger value="detailed">Detailed Form</TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <AIRecipeUploader />
        </TabsContent>

        <TabsContent value="detailed">
          <RecipeForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}