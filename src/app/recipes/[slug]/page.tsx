'use client';

import {
  Apple,
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
  Sparkles,
  Trash2,
  User,
  Users,
  Utensils,
} from 'lucide-react';
import Link from 'next/link';
import { notFound, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getOriginalRecipe } from '@/app/actions/recipe-cloning';
import { exportRecipeAsMarkdown, exportRecipeAsPDF } from '@/app/actions/recipe-export';
import { getRecipeViewCount, trackRecipeView } from '@/app/actions/recipe-views';
import { deleteRecipe, getRecipe } from '@/app/actions/recipes';
import { getProfileByUserId } from '@/app/actions/user-profiles';
import { AdminContentActions } from '@/components/admin/AdminContentActions';
import { AdminEditModeProvider } from '@/components/admin/AdminEditMode';
import { FlagImageButton } from '@/components/admin/FlagImageButton';
import { RecipeContentWithEdit } from '@/components/admin/RecipeContentWithEdit';
import { AddToCollectionButton } from '@/components/collections/AddToCollectionButton';
import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { BackToChef } from '@/components/recipe/BackToChef';
import { CloneRecipeButton } from '@/components/recipe/CloneRecipeButton';
import { FlagButton } from '@/components/recipe/FlagButton';
import { ImageCarousel } from '@/components/recipe/ImageCarousel';
import { InventoryMatchSection } from '@/components/recipe/InventoryMatchSection';
import { RatingDisplay } from '@/components/recipe/RatingDisplay';
import { RecipeComments } from '@/components/recipe/RecipeComments';
import {
  RecipeEngagementStats,
  RecipeForkAttribution,
} from '@/components/recipe/RecipeEngagementStats';
import { RecipeRatings } from '@/components/recipe/RecipeRatings';
import { SemanticTagDisplay } from '@/components/recipe/SemanticTagDisplay';
import { SimilarRecipesWidget } from '@/components/recipe/SimilarRecipesWidget';
import { SubstitutionSuggestionsWrapper } from '@/components/recipe/SubstitutionSuggestionsWrapper';
import { WasteReductionSection } from '@/components/recipe/WasteReductionSection';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isAdmin } from '@/lib/admin-client';
import { parseRecipe } from '@/lib/utils/recipe-utils';

/**
 * Safe Clerk user hook that handles the case where Clerk is not available
 * This MUST be called unconditionally to satisfy React's Rules of Hooks
 */
function useSafeClerkUser() {
  try {
    const { useUser } = require('@clerk/nextjs');
    return useUser();
  } catch (_error) {
    // Clerk not available - return default values
    // This maintains consistent hook call order regardless of Clerk availability
    return { user: null, isSignedIn: false, isLoaded: true };
  }
}

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
  const [originalRecipe, setOriginalRecipe] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extract chef slug from URL params for back navigation
  const fromParam = searchParams.get('from');
  const chefSlug = fromParam?.startsWith('chef/') ? fromParam.replace('chef/', '') : null;

  // Safe Clerk usage - MUST be called unconditionally (React Rules of Hooks)
  // Will return null values if Clerk is not configured
  const { user, isSignedIn } = useSafeClerkUser();

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

      // Fetch original recipe if this is a fork
      if (result.data.source?.includes('Forked from recipe ID:')) {
        getOriginalRecipe(result.data.id)
          .then((original) => {
            if (original) {
              setOriginalRecipe(parseRecipe(original));
            }
          })
          .catch((err) => {
            console.error('Failed to fetch original recipe:', err);
          });
      }

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

  const handleExportMarkdown = useCallback(async () => {
    if (!recipe) return;
    try {
      setExporting(true);
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
  }, [recipe]);

  const handleExportPDF = useCallback(async () => {
    if (!recipe) return;
    try {
      setExporting(true);
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
  }, [recipe]);

  const handleDelete = useCallback(async () => {
    if (!recipe) return;
    try {
      setDeleting(true);
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
  }, [recipe, router]);

  const handleCopyRecipe = useCallback(async () => {
    if (!recipe) return;
    try {
      // Format recipe as text - use tag labels from ontology
      const { getTagLabel, normalizeTagToId } = await import('@/lib/tags');
      const tagLabels =
        recipe.tags && recipe.tags.length > 0
          ? recipe.tags.map((tag: string) => getTagLabel(normalizeTagToId(tag))).join(', ')
          : '';

      const recipeText = `
${recipe.name}
${recipe.description ? `\n${recipe.description}\n` : ''}
Prep Time: ${recipe.prep_time || 0} min | Cook Time: ${recipe.cook_time || 0} min | Servings: ${recipe.servings || 0}
${recipe.cuisine ? `Cuisine: ${recipe.cuisine}` : ''} ${recipe.difficulty ? `| Difficulty: ${recipe.difficulty}` : ''}

INGREDIENTS:
${recipe.ingredients.map((ing: string) => `• ${ing}`).join('\n')}

INSTRUCTIONS:
${recipe.instructions.map((inst: string, i: number) => `${i + 1}. ${inst}`).join('\n')}
${tagLabels ? `\nTags: ${tagLabels}` : ''}
      `.trim();

      await navigator.clipboard.writeText(recipeText);
      toast.success('Recipe copied to clipboard!');
    } catch (error) {
      console.error('Copy error:', error);
      toast.error('Failed to copy recipe');
    }
  }, [recipe]);

  // ALL MEMOIZED VALUES MUST BE CALLED BEFORE ANY EARLY RETURNS
  // This ensures consistent hook order across all renders (React Rules of Hooks)
  const totalTime = useMemo(
    () => (recipe ? (recipe.prep_time || 0) + (recipe.cook_time || 0) : 0),
    [recipe]
  );

  const editUrl = useMemo(
    () =>
      recipe?.slug
        ? `/recipes/${recipe.slug}/edit`
        : recipe?.id
          ? `/recipes/${recipe.id}/edit`
          : '',
    [recipe]
  );

  // Extract categorized tags for metadata display
  const categorizedTags = useMemo(() => {
    if (!recipe?.tags) return null;

    // Import categorizeTags dynamically to avoid circular dependencies
    const { categorizeTags } = require('@/lib/tag-ontology');
    return categorizeTags(recipe.tags);
  }, [recipe]);

  // Generate JSON-LD structured data for recipe
  const recipeJsonLd = useMemo(() => {
    if (!recipe) return null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://recipes.help';
    const recipeUrl = recipe.slug
      ? `${baseUrl}/recipes/${recipe.slug}`
      : `${baseUrl}/recipes/${recipe.id}`;

    return {
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: recipe.name,
      description: recipe.description || `Delicious ${recipe.name} recipe from Joanie's Kitchen`,
      image: recipe.images?.[0] || (recipe.image_url ? [recipe.image_url] : []),
      author: {
        '@type': authorProfile ? 'Person' : 'Organization',
        name: authorProfile?.display_name || "Joanie's Kitchen",
      },
      datePublished: recipe.created_at,
      dateModified: recipe.updated_at,
      prepTime: recipe.prep_time ? `PT${recipe.prep_time}M` : undefined,
      cookTime: recipe.cook_time ? `PT${recipe.cook_time}M` : undefined,
      totalTime: totalTime > 0 ? `PT${totalTime}M` : undefined,
      recipeYield: recipe.servings ? `${recipe.servings} servings` : undefined,
      recipeCategory: recipe.cuisine || undefined,
      recipeCuisine: recipe.cuisine || undefined,
      keywords: recipe.tags?.join(', ') || undefined,
      recipeIngredient: recipe.ingredients || [],
      recipeInstructions:
        recipe.instructions?.map((step: string, i: number) => ({
          '@type': 'HowToStep',
          position: i + 1,
          text: step,
        })) || [],
      nutrition: recipe.nutrition_info
        ? {
            '@type': 'NutritionInformation',
            ...(typeof recipe.nutrition_info === 'string'
              ? JSON.parse(recipe.nutrition_info)
              : recipe.nutrition_info),
          }
        : undefined,
      aggregateRating:
        recipe.avg_user_rating && recipe.total_user_ratings
          ? {
              '@type': 'AggregateRating',
              ratingValue: recipe.avg_user_rating,
              ratingCount: recipe.total_user_ratings,
            }
          : undefined,
      url: recipeUrl,
      isAccessibleForFree: 'True',
      license: recipe.license
        ? `https://creativecommons.org/licenses/${recipe.license.toLowerCase().replace(/_/g, '-')}/4.0/`
        : undefined,
    };
  }, [recipe, authorProfile, totalTime]);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="animate-pulse space-y-8">
          {/* Header Skeleton */}
          <div className="h-8 bg-muted rounded-md w-3/4" />
          <div className="h-4 bg-muted rounded-md w-full" />
          <div className="h-4 bg-muted rounded-md w-5/6" />

          {/* Buttons Skeleton */}
          <div className="flex gap-2">
            <div className="h-10 bg-muted rounded-md w-24" />
            <div className="h-10 bg-muted rounded-md w-24" />
            <div className="h-10 bg-muted rounded-md w-24" />
          </div>

          {/* Content Skeleton */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="h-96 bg-muted rounded-lg" />
            <div className="h-96 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Show auth required message for private recipes when not signed in
  if (requiresAuth && !isSignedIn) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {chefSlug ? (
          <BackToChef chefSlug={chefSlug} />
        ) : (
          <Link
            href="/recipes"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 min-h-[44px] min-w-[44px] -ml-2 pl-2 pr-4 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Recipes
          </Link>
        )}

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

  return (
    <AdminEditModeProvider>
      {/* JSON-LD Structured Data for SEO */}
      {recipeJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(recipeJsonLd),
          }}
        />
      )}

      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Show back to chef if coming from a chef page, otherwise back to recipes */}
        {chefSlug ? (
          <BackToChef chefSlug={chefSlug} />
        ) : (
          <Link
            href="/recipes"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 min-h-[44px] min-w-[44px] -ml-2 pl-2 pr-4 py-2 rounded-md hover:bg-accent transition-colors"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Recipes
          </Link>
        )}

        {/* Tool Buttons Row */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Engagement Actions */}
          {isSignedIn && <FavoriteButton recipeId={recipe.id} />}
          {isSignedIn && <AddToCollectionButton recipeId={recipe.id} />}
          {!isOwner && (
            <CloneRecipeButton
              recipeId={recipe.id}
              recipeName={recipe.name}
              currentUserId={user?.id}
              recipeOwnerId={recipe.user_id}
              variant="outline"
            />
          )}
          {/* Report Button - available to all users except recipe owner */}
          {!isOwner && <FlagButton recipeId={recipe.id} recipeName={recipe.name} />}

          {/* Utility Actions */}
          <Link href={`/recipes/${recipe.id}/similar`} className="contents">
            <Button
              variant="outline"
              className="min-h-[44px] min-w-[44px]"
              aria-label="View similar recipes"
            >
              <Sparkles className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Similar</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={handleCopyRecipe}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Copy recipe to clipboard"
          >
            <Copy className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Copy</span>
          </Button>

          {/* Export Dropdown - Touch-friendly Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={exporting}
                className="min-h-[44px] min-w-[44px]"
                aria-label="Export recipe"
              >
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'Export'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="start">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  onClick={handleExportMarkdown}
                  disabled={exporting}
                  className="justify-start min-h-[44px] w-full"
                  aria-label="Export as Markdown"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export as Markdown
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleExportPDF}
                  disabled={exporting}
                  className="justify-start min-h-[44px] w-full"
                  aria-label="Export as PDF"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Export as PDF
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="min-h-[44px] min-w-[44px]"
            aria-label="Print recipe"
          >
            <Printer className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Print</span>
          </Button>

          {/* Admin Actions */}
          {isUserAdmin && (
            <>
              <FlagImageButton
                recipeId={recipe.id}
                recipeName={recipe.name}
                isFlagged={recipe.image_flagged_for_regeneration || false}
              />
              <AdminContentActions recipeId={recipe.id} recipeName={recipe.name} />
            </>
          )}

          {/* Owner Actions - Visually separated */}
          {isOwner && (
            <>
              <div className="w-full sm:w-auto sm:ml-auto" />
              <Link href={editUrl} className="contents">
                <Button
                  variant="outline"
                  className="min-h-[44px] min-w-[44px]"
                  aria-label="Edit recipe"
                >
                  <Edit className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Edit</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleting}
                className="min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                aria-label="Delete recipe"
              >
                <Trash2 className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </>
          )}
        </div>

        {/* Recipe Header */}
        <div className="mb-8">
          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">{recipe.name}</h1>

          {/* Description */}
          {recipe.description && (
            <p className="text-base sm:text-lg text-muted-foreground mb-6 leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* Metadata Row */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm mb-4 items-center">
            {/* Author and View Count */}
            {authorProfile && (
              <Link
                href={`/profile/${authorProfile.username}`}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors min-h-[44px] px-2 -ml-2 rounded-md hover:bg-accent"
                aria-label={`View ${authorProfile.display_name}'s profile`}
              >
                <User className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">by {authorProfile.display_name}</span>
              </Link>
            )}
            {viewCount > 0 && (
              <div
                className="flex items-center gap-1.5 text-muted-foreground"
                aria-label={`${viewCount.toLocaleString()} views`}
              >
                <Eye className="w-4 h-4 flex-shrink-0" />
                <span>
                  {viewCount.toLocaleString()} {viewCount === 1 ? 'view' : 'views'}
                </span>
              </div>
            )}
            {(recipe.avg_user_rating || recipe.total_user_ratings > 0) && (
              <RatingDisplay
                averageRating={recipe.avg_user_rating}
                totalRatings={recipe.total_user_ratings || 0}
                size="sm"
                showCount
                onClick={() => {
                  const ratingsSection = document.getElementById('ratings-and-reviews');
                  ratingsSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              />
            )}
            {recipe.cuisine && (
              <div
                className="flex items-center gap-1.5 text-muted-foreground"
                aria-label={`Cuisine: ${recipe.cuisine}`}
              >
                <ChefHat className="w-4 h-4 flex-shrink-0" />
                <span>{recipe.cuisine}</span>
              </div>
            )}
            {categorizedTags?.['Meal Type']?.[0] && (
              <div
                className="flex items-center gap-1.5 text-muted-foreground"
                aria-label={`Meal type: ${require('@/lib/tags').getTagLabel(categorizedTags['Meal Type'][0])}`}
              >
                <Utensils className="w-4 h-4 flex-shrink-0" />
                <span>{require('@/lib/tags').getTagLabel(categorizedTags['Meal Type'][0])}</span>
              </div>
            )}
            {categorizedTags?.['Main Ingredient']?.[0] && (
              <div
                className="flex items-center gap-1.5 text-muted-foreground"
                aria-label={`Main ingredient: ${require('@/lib/tags').getTagLabel(categorizedTags['Main Ingredient'][0])}`}
              >
                <Apple className="w-4 h-4 flex-shrink-0" />
                <span>
                  {require('@/lib/tags').getTagLabel(categorizedTags['Main Ingredient'][0])}
                </span>
              </div>
            )}
            {totalTime > 0 && (
              <div
                className="flex items-center gap-1.5 text-muted-foreground"
                aria-label={`Total time: ${totalTime} minutes`}
              >
                <Clock className="w-4 h-4 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  {recipe.prep_time ? `${recipe.prep_time} min prep` : ''}
                  {recipe.prep_time && recipe.cook_time ? ' + ' : ''}
                  {recipe.cook_time ? `${recipe.cook_time} min cook` : ''}
                </span>
              </div>
            )}
            {recipe.servings && (
              <div
                className="flex items-center gap-1.5 text-muted-foreground"
                aria-label={`Servings: ${recipe.servings}`}
              >
                <Users className="w-4 h-4 flex-shrink-0" />
                <span>{recipe.servings} servings</span>
              </div>
            )}
            {recipe.difficulty && (
              <Badge
                variant="outline"
                className={
                  recipe.difficulty === 'easy'
                    ? 'text-green-600 border-green-600/20'
                    : recipe.difficulty === 'medium'
                      ? 'text-yellow-600 border-yellow-600/20'
                      : 'text-red-600 border-red-600/20'
                }
                aria-label={`Difficulty: ${recipe.difficulty}`}
              >
                {recipe.difficulty}
              </Badge>
            )}
            {recipe.is_ai_generated && (
              <Badge variant="secondary" aria-label="AI Generated Recipe">
                <Bot className="w-3 h-3 mr-1" />
                AI Generated
              </Badge>
            )}
            {recipe.is_system_recipe && (
              <Badge variant="default" className="bg-jk-tomato" aria-label="Shared System Recipe">
                <Lock className="w-3 h-3 mr-1" />
                Shared
              </Badge>
            )}
          </div>

          {/* Semantic Tags - Exclude categories shown in metadata */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="mt-4">
              <SemanticTagDisplay
                tags={recipe.tags}
                layout="grouped"
                showCategoryLabels
                size="md"
                excludeCategories={['Cuisine', 'Meal Type', 'Main Ingredient', 'Difficulty']}
              />
            </div>
          )}
        </div>

        {/* Fork Attribution - show if this recipe was forked from another */}
        {originalRecipe && (
          <div className="mb-6">
            <RecipeForkAttribution
              originalRecipeName={originalRecipe.name}
              originalRecipeId={originalRecipe.id}
              originalRecipeSlug={originalRecipe.slug}
            />
          </div>
        )}

        {/* Engagement Stats - Inline row display */}
        {(recipe.like_count > 0 || recipe.fork_count > 0 || recipe.collection_count > 0) && (
          <div className="mb-6">
            <RecipeEngagementStats
              likeCount={recipe.like_count || 0}
              forkCount={recipe.fork_count || 0}
              collectionCount={recipe.collection_count || 0}
              recipeId={recipe.id}
              inline
            />
          </div>
        )}

        {/* Images */}
        {(recipe.images?.length > 0 || recipe.image_url) && (
          <div className="mb-8">
            <ImageCarousel
              images={
                recipe.images?.length > 0
                  ? recipe.images
                  : recipe.image_url
                    ? [recipe.image_url]
                    : []
              }
              title={recipe.name}
              recipeId={recipe.id}
              isFlagged={recipe.image_flagged_for_regeneration}
              isAdmin={isUserAdmin}
            />
          </div>
        )}

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-2">
          {/* Recipe Content with Admin Edit Overlays */}
          <RecipeContentWithEdit recipe={recipe} isAdmin={isUserAdmin} />
        </div>

        {/* Similar Recipes Widget */}
        <div className="mt-8">
          <SimilarRecipesWidget recipeId={recipe.id} recipeName={recipe.name} limit={6} />
        </div>

        {/* YOU HAVE / YOU NEED SECTION - Week 2 Task 3.1 */}
        <div className="mt-8 sm:mt-12 mb-8">
          <InventoryMatchSection recipeId={recipe.id} ingredients={recipe.ingredients} />
        </div>

        {/* SMART SUBSTITUTIONS SECTION */}
        <div className="mb-8">
          <SubstitutionSuggestionsWrapper
            recipeId={recipe.id}
            recipeName={recipe.name}
            ingredients={recipe.ingredients}
          />
        </div>

        {/* WASTE-REDUCTION CONTENT SECTION - Week 2 Task 3.3 */}
        {(recipe.resourcefulness_score ||
          recipe.waste_reduction_tags ||
          recipe.scrap_utilization_notes ||
          recipe.environmental_notes) && (
          <div className="mb-8">
            <WasteReductionSection
              resourcefulnessScore={recipe.resourcefulness_score}
              wasteReductionTags={recipe.waste_reduction_tags}
              scrapUtilizationNotes={recipe.scrap_utilization_notes}
              environmentalNotes={recipe.environmental_notes}
            />
          </div>
        )}

        {/* RATINGS & REVIEWS SECTION */}
        <div className="mb-8">
          <RecipeRatings
            recipeId={recipe.id}
            averageRating={recipe.avg_user_rating}
            totalRatings={recipe.total_user_ratings || 0}
            currentUserId={user?.id}
            isAuthenticated={isSignedIn || false}
          />
        </div>

        {/* COMMENTS SECTION */}
        <div className="mb-8">
          <RecipeComments
            recipeId={recipe.id}
            currentUserId={user?.id}
            isAuthenticated={isSignedIn || false}
          />
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
    </AdminEditModeProvider>
  );
}
