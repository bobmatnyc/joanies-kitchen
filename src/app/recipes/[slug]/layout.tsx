import { getRecipe } from '@/app/actions/recipes';
import { redirect } from 'next/navigation';

interface RecipeLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

/**
 * Check if a string is a UUID format
 */
function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Recipe Detail Page Layout
 *
 * Provides metadata and SEO for individual recipe pages.
 * This layout wraps the client-side recipe page component.
 *
 * SEO CRITICAL: Handles server-side 301 redirect from UUID to slug URLs
 * for better SEO (search engines prefer slug URLs over UUIDs).
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getRecipe(slug);

  // If accessed via UUID but recipe has a slug, redirect to slug URL (301)
  if (result.success && result.data && isUUID(slug) && result.data.slug) {
    redirect(`/recipes/${result.data.slug}`);
  }

  if (!result.success || !result.data) {
    return {
      title: 'Recipe Not Found',
    };
  }

  const recipe = result.data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://recipes.help';

  // Prefer slug over ID for canonical URL (SEO best practice)
  const canonicalSlug = recipe.slug || recipe.id;
  const canonicalUrl = `${baseUrl}/recipes/${canonicalSlug}`;

  // Get first image for OG image
  const images = recipe.images && Array.isArray(recipe.images) ? recipe.images : [];
  const firstImage = images.length > 0 ? images[0] : recipe.image_url;

  return {
    title: `${recipe.name} | Joanie's Kitchen`,
    description: recipe.description || `Delicious ${recipe.name} recipe from Joanie's Kitchen - ${recipe.cuisine ? `${recipe.cuisine} cuisine` : 'Easy to make'}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: recipe.name,
      description: recipe.description || `Delicious ${recipe.name} recipe`,
      url: canonicalUrl,
      type: 'article',
      images: firstImage ? [
        {
          url: firstImage,
          width: 1200,
          height: 630,
          alt: recipe.name,
        }
      ] : undefined,
      siteName: "Joanie's Kitchen",
    },
    twitter: {
      card: 'summary_large_image',
      title: recipe.name,
      description: recipe.description || `Delicious ${recipe.name} recipe`,
      images: firstImage ? [firstImage] : undefined,
    },
    keywords: [
      recipe.name,
      recipe.cuisine,
      ...(recipe.tags || []),
      'recipe',
      'cooking',
      'zero waste cooking',
    ].filter(Boolean),
  };
}

export default async function RecipeLayout({ children, params }: RecipeLayoutProps) {
  const { slug } = await params;
  const result = await getRecipe(slug);

  // Server-side 301 redirect from UUID to slug (SEO best practice)
  if (result.success && result.data && isUUID(slug) && result.data.slug) {
    redirect(`/recipes/${result.data.slug}`);
  }

  return <>{children}</>;
}
