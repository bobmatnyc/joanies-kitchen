import { getRecipe } from '@/app/actions/recipes';
import { RecipeForm } from '@/components/recipe/RecipeForm';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

// Force dynamic rendering since we use authentication
export const dynamic = 'force-dynamic';

interface EditRecipePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const { userId } = await auth();

  // Skip auth check for localhost development
  const isLocalhost = process.env.NODE_ENV === 'development';

  const { id } = await params;

  if (!userId && !isLocalhost) {
    // Redirect to sign-in with return URL
    redirect(`/sign-in?returnUrl=/recipes/${id}/edit`);
  }

  const result = await getRecipe(id);

  if (!result.success || !result.data) {
    notFound();
  }

  // Make sure the user owns this recipe (skip in development)
  if (!isLocalhost && result.data.user_id !== userId) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href={`/recipes/${id}`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Recipe
      </Link>

      <h1 className="text-4xl font-bold mb-8">Edit Recipe</h1>

      <RecipeForm recipe={result.data} />
    </div>
  );
}