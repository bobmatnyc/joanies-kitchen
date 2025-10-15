'use client';

import { useEffect, useState } from 'react';
import { getRecipe, deleteRecipe } from '@/app/actions/recipes';
import { parseRecipe } from '@/lib/utils/recipe-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Clock, Users, ChefHat, Edit, Printer, Bot, Download, FileText, FileDown, Trash2, Lock, Copy } from 'lucide-react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { exportRecipeAsMarkdown, exportRecipeAsPDF } from '@/app/actions/recipe-export';
import { toast } from 'sonner';
import { ImageCarousel } from '@/components/recipe/ImageCarousel';
import { categorizeTags, getCategoryColor, type TagCategory } from '@/lib/tag-ontology';

// Conditionally import Clerk hook
let useUser: any = null;
try {
  const clerk = require('@clerk/nextjs');
  useUser = clerk.useUser;
} catch (error) {
  // Clerk not available
  console.log('Clerk not available in recipe page');
}

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface RecipePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function RecipePage({ params }: RecipePageProps) {
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recipeId, setRecipeId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const router = useRouter();

  // Safe Clerk usage - will return null values if Clerk is not configured
  let user: any = null;
  let isSignedIn = false;

  if (useUser) {
    try {
      const clerkData = useUser();
      user = clerkData.user;
      isSignedIn = clerkData.isSignedIn || false;
    } catch (error) {
      // Clerk hook failed, use defaults
      console.log('Clerk hook failed, using development mode');
    }
  }

  useEffect(() => {
    params.then(p => setRecipeId(p.id));
  }, [params]);

  useEffect(() => {
    if (!recipeId) return;

    async function fetchRecipe() {
      const result = await getRecipe(recipeId);

      if (!result.success || !result.data) {
        // Check if it's an access denied error for private recipe
        if (result.error === 'Access denied' && !isSignedIn) {
          setRequiresAuth(true);
          setLoading(false);
          return;
        }
        notFound();
        return;
      }

      const parsedRecipe = parseRecipe(result.data);
      setRecipe(parsedRecipe);

      // Check if current user is the owner
      // In development mode (no auth), treat all recipes as owned
      const isDevelopment = process.env.NODE_ENV === 'development';
      if (isDevelopment && !isSignedIn) {
        setIsOwner(true);
      } else if (isSignedIn && user?.id === result.data.userId) {
        setIsOwner(true);
      }

      setLoading(false);
    }
    fetchRecipe();
  }, [recipeId, isSignedIn, user]);

  const handleExportMarkdown = async () => {
    try {
      setExporting(true);
      const result = await exportRecipeAsMarkdown(recipeId);

      // Convert base64 to blob and download
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Recipe exported as Markdown!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export recipe');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const result = await exportRecipeAsPDF(recipeId);

      // Convert base64 to blob and download
      const byteCharacters = atob(result.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mimeType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Recipe exported as PDF!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export recipe as PDF');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const result = await deleteRecipe(recipeId);

      if (result.success) {
        toast.success('Recipe deleted successfully');
        router.push('/recipes');
      } else {
        toast.error(result.error || 'Failed to delete recipe');
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete recipe');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleCopyRecipe = async () => {
    try {
      // Format recipe as text
      const recipeText = `
${recipe.name}
${recipe.description ? `\n${recipe.description}\n` : ''}
Prep Time: ${recipe.prepTime || 0} min | Cook Time: ${recipe.cookTime || 0} min | Servings: ${recipe.servings || 0}
${recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : ''} ${recipe.difficulty ? `| Difficulty: ${recipe.difficulty}` : ''}

INGREDIENTS:
${recipe.ingredients.map((ing: string) => `• ${ing}`).join('\n')}

INSTRUCTIONS:
${recipe.instructions.map((inst: string, i: number) => `${i + 1}. ${inst}`).join('\n')}
${recipe.tags && recipe.tags.length > 0 ? `\nTags: ${recipe.tags.join(', ')}` : ''}
      `.trim();

      await navigator.clipboard.writeText(recipeText);
      toast.success('Recipe copied to clipboard!');
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Failed to copy recipe');
    }
  };

  if (loading) {
    return <div className="container mx-auto py-8 px-4">Loading...</div>;
  }

  // Show auth required message for private recipes when not signed in
  if (requiresAuth && !isSignedIn) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Link
          href="/recipes"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Recipes
        </Link>

        <Card className="max-w-md mx-auto mt-8">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <CardTitle>Private Recipe</CardTitle>
            <CardDescription>
              This recipe is private. Please sign in to view it.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/sign-in">
              <Button>Sign In to View Recipe</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!recipe) {
    notFound();
    return null;
  }
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  // Categorize tags using the ontology system
  const categorizedTags = recipe.tags && recipe.tags.length > 0
    ? categorizeTags(recipe.tags)
    : {};
  const categoryEntries = Object.entries(categorizedTags) as [TagCategory, string[]][];

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Link
        href="/recipes"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Recipes
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2">{recipe.name}</h1>
            {recipe.description && (
              <p className="text-lg text-muted-foreground">{recipe.description}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleCopyRecipe}
              className="flex items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy Recipe
            </Button>
            {isOwner && (
              <>
                <Link href={`/recipes/${recipeId}/edit`}>
                  <Button variant="outline">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </>
            )}
            <div className="relative group">
              <Button
                variant="outline"
                disabled={exporting}
              >
                <Download className="w-4 h-4 mr-2" />
                {exporting ? 'Exporting...' : 'Export'}
              </Button>
              <div className="absolute right-0 mt-2 w-48 bg-background border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <button
                  onClick={handleExportMarkdown}
                  className="w-full text-left px-4 py-2 hover:bg-accent flex items-center"
                  disabled={exporting}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export as Markdown
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full text-left px-4 py-2 hover:bg-accent flex items-center"
                  disabled={exporting}
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Export as PDF
                </button>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm">
          {recipe.cuisine && (
            <div className="flex items-center gap-1">
              <ChefHat className="w-4 h-4" />
              <span>{recipe.cuisine}</span>
            </div>
          )}
          {totalTime > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                {recipe.prepTime ? `${recipe.prepTime} min prep` : ''}
                {recipe.prepTime && recipe.cookTime ? ' + ' : ''}
                {recipe.cookTime ? `${recipe.cookTime} min cook` : ''}
              </span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{recipe.servings} servings</span>
            </div>
          )}
          {recipe.difficulty && (
            <Badge
              variant="outline"
              className={
                recipe.difficulty === 'easy' ? 'text-green-600' :
                recipe.difficulty === 'medium' ? 'text-yellow-600' :
                'text-red-600'
              }
            >
              {recipe.difficulty}
            </Badge>
          )}
          {recipe.isAiGenerated && (
            <Badge variant="secondary">
              <Bot className="w-3 h-3 mr-1" />
              AI Generated
            </Badge>
          )}
        </div>

        {/* Categorized Tags */}
        {categoryEntries.length > 0 && (
          <div className="mt-4 space-y-3">
            {categoryEntries.map(([category, categoryTags]) => (
              <div key={category} className="space-y-1">
                <span className="text-sm font-semibold text-muted-foreground">
                  {category}
                </span>
                <div className="flex flex-wrap gap-2">
                  {categoryTags.map((tag, index) => (
                    <Badge
                      key={index}
                      className={getCategoryColor(category)}
                      variant="outline"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Images */}
      {(recipe.images?.length > 0 || recipe.imageUrl) && (
        <div className="mb-8">
          <ImageCarousel
            images={recipe.images?.length > 0 ? recipe.images : recipe.imageUrl ? [recipe.imageUrl] : []}
            title={recipe.name}
          />
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-2">
        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>Ingredients</CardTitle>
            <CardDescription>Everything you'll need</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {recipe.ingredients.map((ingredient: string, index: number) => {
                // Check if ingredient has amount (starts with number, fraction, or common amount words)
                const hasAmount = /^[\d½¼¾⅓⅔⅛⅜⅝⅞]|^(a |an |one |two |three |some |few |several )/i.test(ingredient.trim());

                return (
                  <li key={index} className="flex items-start">
                    <span className="inline-block w-2 h-2 bg-primary rounded-full mt-1.5 mr-3 flex-shrink-0" />
                    <span className={!hasAmount ? 'text-amber-600' : ''}>
                      {ingredient}
                      {!hasAmount && (
                        <span className="text-xs text-amber-600 ml-2 opacity-75" title="Amount not specified">
                          (amount not specified)
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions</CardTitle>
            <CardDescription>Step-by-step directions</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {recipe.instructions.map((instruction: string, index: number) => (
                <li key={index} className="flex">
                  <span className="font-semibold text-primary mr-3 flex-shrink-0">
                    {index + 1}.
                  </span>
                  <span>{instruction}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recipe</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{recipe.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}