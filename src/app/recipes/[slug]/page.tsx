'use client';

import {
  Bot,
  ChefHat,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  Edit,
  Eye,
  FileDown,
  FileText,
  Lock,
  Printer,
  Trash2,
  User,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { exportRecipeAsMarkdown, exportRecipeAsPDF } from '@/app/actions/recipe-export';
import { getRecipeViewCount, trackRecipeView } from '@/app/actions/recipe-views';
import { deleteRecipe, getRecipe } from '@/app/actions/recipes';
import { getProfileByUserId } from '@/app/actions/user-profiles';
import { FlagImageButton } from '@/components/admin/FlagImageButton';
import { AddToCollectionButton } from '@/components/collections/AddToCollectionButton';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { ImageCarousel } from '@/components/recipe/ImageCarousel';
import { IngredientsList } from '@/components/recipe/IngredientsList';
import { SimilarRecipesWidget } from '@/components/recipe/SimilarRecipesWidget';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isAdmin } from '@/lib/admin-client';
import { categorizeTags, getCategoryColor, type TagCategory } from '@/lib/tag-ontology';
import { parseRecipe } from '@/lib/utils/recipe-utils';

// Conditionally import Clerk hook
let useUser: any = null;
try {
  const clerk = require('@clerk/nextjs');
  useUser = clerk.useUser;
} catch (_error) {
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
    slug: string;
  }>;
}

/**
 * Check if a string is a UUID format
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export default function RecipePage({ params }: RecipePageProps) {
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [slugOrId, setSlugOrId] = useState<string>('');
  const [exporting, setExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [viewCount, setViewCount] = useState<number>(0);
  const [authorProfile, setAuthorProfile] = useState<any>(null);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const router = useRouter();

  // Safe Clerk usage - will return null values if Clerk is not configured
  let user: any = null;
  let isSignedIn = false;

  if (useUser) {
    try {
      const clerkData = useUser();
      user = clerkData.user;
      isSignedIn = clerkData.isSignedIn || false;
    } catch (_error) {
      // Clerk hook failed, use defaults
      console.log('Clerk hook failed, using development mode');
    }
  }

  useEffect(() => {
    params.then((p) => setSlugOrId(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slugOrId) return;

    async function fetchRecipe() {
      const result = await getRecipe(slugOrId);

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

      // Track view asynchronously (don't await to avoid blocking UI)
      trackRecipeView(result.data.id).catch((err) => console.error('Failed to track view:', err));

      // Fetch view count
      getRecipeViewCount(result.data.id)
        .then((count) => {
          setViewCount(count);
        })
        .catch((err) => {
          console.error('Failed to fetch view count:', err);
        });

      // Fetch author profile
      getProfileByUserId(result.data.user_id)
        .then((profile) => {
          setAuthorProfile(profile);
        })
        .catch((err) => {
          console.error('Failed to fetch author profile:', err);
        });

      // Check if we accessed via UUID but recipe has a slug - redirect to slug URL
      if (isUUID(slugOrId) && result.data.slug) {
        // Use replace to redirect with 301-like behavior (replaces history entry)
        router.replace(`/recipes/${result.data.slug}`);
        return;
      }

      // Check if current user is the owner
      // System recipes cannot be edited by anyone
      if (result.data.is_system_recipe) {
        setIsOwner(false);
      } else {
        // In development mode (no auth), treat all recipes as owned
        const isDevelopment = process.env.NODE_ENV === 'development';
        if (isDevelopment && !isSignedIn) {
          setIsOwner(true);
        } else if (isSignedIn && user?.id === result.data.user_id) {
          setIsOwner(true);
        }
      }

      // Check if user is admin
      if (isSignedIn && user?.id) {
        setIsUserAdmin(isAdmin(user.id));
      }

      setLoading(false);
    }
    fetchRecipe();
  }, [slugOrId, isSignedIn, user, router]);

  const handleExportMarkdown = async () => {
    try {
      setExporting(true);
      // Use recipe ID for export (not slug)
      const result = await exportRecipeAsMarkdown(recipe.id);

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
      // Use recipe ID for export (not slug)
      const result = await exportRecipeAsPDF(recipe.id);

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
      // Use recipe ID for deletion (not slug)
      const result = await deleteRecipe(recipe.id);

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
Prep Time: ${recipe.prep_time || 0} min | Cook Time: ${recipe.cook_time || 0} min | Servings: ${recipe.servings || 0}
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
            <CardDescription>This recipe is private. Please sign in to view it.</CardDescription>
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
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);

  // Categorize tags using the ontology system
  const categorizedTags =
    recipe.tags && recipe.tags.length > 0
      ? categorizeTags(recipe.tags)
      : {
          Cuisine: [],
          'Meal Type': [],
          Dietary: [],
          'Cooking Method': [],
          'Main Ingredient': [],
          Course: [],
          Season: [],
          Difficulty: [],
          Time: [],
          Other: [],
        };
  const categoryEntries = Object.entries(categorizedTags) as [TagCategory, string[]][];

  // Use slug for edit link if available, otherwise fall back to ID
  const editUrl = recipe.slug ? `/recipes/${recipe.slug}/edit` : `/recipes/${recipe.id}/edit`;

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

            {/* Author and View Count */}
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              {authorProfile && (
                <Link
                  href={`/profile/${authorProfile.username}`}
                  className="flex items-center gap-1 hover:text-primary transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span>by {authorProfile.display_name}</span>
                </Link>
              )}
              {viewCount > 0 && (
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>
                    {viewCount.toLocaleString()} {viewCount === 1 ? 'view' : 'views'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Favorite Button */}
            {isSignedIn && <FavoriteButton recipeId={recipe.id} />}

            {/* Add to Collection Button */}
            {isSignedIn && <AddToCollectionButton recipeId={recipe.id} />}

            {/* Admin Image Flagging */}
            {isUserAdmin && (
              <FlagImageButton
                recipeId={recipe.id}
                recipeName={recipe.name}
                isFlagged={recipe.image_flagged_for_regeneration || false}
              />
            )}

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
                <Link href={editUrl}>
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
              <Button variant="outline" disabled={exporting}>
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
            <Button variant="outline" onClick={() => window.print()}>
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
                {recipe.prep_time ? `${recipe.prep_time} min prep` : ''}
                {recipe.prep_time && recipe.cook_time ? ' + ' : ''}
                {recipe.cook_time ? `${recipe.cook_time} min cook` : ''}
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
                recipe.difficulty === 'easy'
                  ? 'text-green-600'
                  : recipe.difficulty === 'medium'
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }
            >
              {recipe.difficulty}
            </Badge>
          )}
          {recipe.is_ai_generated && (
            <Badge variant="secondary">
              <Bot className="w-3 h-3 mr-1" />
              AI Generated
            </Badge>
          )}
          {recipe.is_system_recipe && (
            <Badge variant="default" className="bg-jk-tomato">
              <Lock className="w-3 h-3 mr-1" />
              Shared
            </Badge>
          )}
        </div>

        {/* Categorized Tags in 3 rows */}
        {categoryEntries.length > 0 && (
          <div className="mt-4 space-y-2">
            {/* Row 1: Difficulty + Meal Type */}
            {(categorizedTags.Difficulty?.length > 0 ||
              categorizedTags['Meal Type']?.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {categorizedTags.Difficulty?.map((tag, index) => (
                  <Badge
                    key={`diff-${index}`}
                    className={getCategoryColor('Difficulty')}
                    variant="outline"
                  >
                    {tag}
                  </Badge>
                ))}
                {categorizedTags['Meal Type']?.map((tag, index) => (
                  <Badge
                    key={`meal-${index}`}
                    className={getCategoryColor('Meal Type')}
                    variant="outline"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Row 2: Main Ingredient + Dietary */}
            {(categorizedTags['Main Ingredient']?.length > 0 ||
              categorizedTags.Dietary?.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {categorizedTags['Main Ingredient']?.slice(0, 3).map((tag, index) => (
                  <Badge
                    key={`ing-${index}`}
                    className={getCategoryColor('Main Ingredient')}
                    variant="outline"
                  >
                    {tag}
                  </Badge>
                ))}
                {(categorizedTags['Main Ingredient']?.length || 0) > 3 && (
                  <Badge className={getCategoryColor('Main Ingredient')} variant="outline">
                    +{(categorizedTags['Main Ingredient']?.length || 0) - 3}
                  </Badge>
                )}
                {categorizedTags.Dietary?.slice(0, 2).map((tag, index) => (
                  <Badge
                    key={`diet-${index}`}
                    className={getCategoryColor('Dietary')}
                    variant="outline"
                  >
                    {tag}
                  </Badge>
                ))}
                {(categorizedTags.Dietary?.length || 0) > 2 && (
                  <Badge className={getCategoryColor('Dietary')} variant="outline">
                    +{(categorizedTags.Dietary?.length || 0) - 2}
                  </Badge>
                )}
              </div>
            )}

            {/* Row 3: Season + Other (Expandable) */}
            {(categorizedTags.Season?.length > 0 || categorizedTags.Other?.length > 0) && (
              <details className="group/tags">
                <summary className="text-sm text-muted-foreground cursor-pointer hover:text-primary flex items-center gap-1 list-none">
                  <span className="group-open/tags:rotate-90 transition-transform inline-block">
                    ▸
                  </span>
                  <span>
                    More tags (
                    {(categorizedTags.Season?.length || 0) + (categorizedTags.Other?.length || 0)})
                  </span>
                </summary>
                <div className="flex flex-wrap gap-2 mt-2 pt-1">
                  {categorizedTags.Season?.map((tag, index) => (
                    <Badge
                      key={`season-${index}`}
                      className={getCategoryColor('Season')}
                      variant="outline"
                    >
                      {tag}
                    </Badge>
                  ))}
                  {categorizedTags.Other?.map((tag, index) => (
                    <Badge
                      key={`other-${index}`}
                      className={getCategoryColor('Other')}
                      variant="outline"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Images */}
      {(recipe.images?.length > 0 || recipe.image_url) && (
        <div className="mb-8">
          <ImageCarousel
            images={
              recipe.images?.length > 0 ? recipe.images : recipe.image_url ? [recipe.image_url] : []
            }
            title={recipe.name}
            recipeId={recipe.id}
            isFlagged={recipe.image_flagged_for_regeneration}
            isAdmin={isUserAdmin}
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
            <IngredientsList ingredients={recipe.ingredients} />
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

      {/* Similar Recipes Widget */}
      <div className="mt-8">
        <SimilarRecipesWidget recipeId={recipe.id} recipeName={recipe.name} limit={6} />
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
