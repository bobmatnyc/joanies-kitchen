import type { Metadata } from 'next';
import { socialImages } from '@/lib/default-og-image';
import { NOT_FOUND_METADATA } from '@/lib/not-found-metadata';
import { getBaseUrl } from '@/lib/site-url';
import { parseRecipeTags } from '@/lib/types/parsers';
import { toUsableImageUrl } from '@/lib/utils/recipe-image';
import { findVisibleRecipe, loadVisibleRecipeOrNotFound } from './recipe-access';

interface RecipeLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // #138: no notFound() here. Next re-runs this while rendering the 404, and a throw
  // drops not-found.tsx's title and robots. The layout below owns the 404 (#134).
  // A missing or hidden recipe gets the fixed 404 metadata, so no private field leaks.
  const recipe = await findVisibleRecipe(slug);
  if (!recipe) return NOT_FOUND_METADATA;
  // #163: normalized base URL (env may carry a trailing newline)
  const baseUrl = getBaseUrl();

  // Prefer slug over ID for canonical URL (SEO best practice)
  const canonicalSlug = recipe.slug || recipe.id;
  const canonicalUrl = `${baseUrl}/recipes/${canonicalSlug}`;

  // Get first image for OG image
  const images = recipe.images && Array.isArray(recipe.images) ? recipe.images : [];
  // #172: a data: placeholder must not become og:image.
  const firstImage = toUsableImageUrl(images.length > 0 ? images[0] : recipe.image_url);
  // #171: this segment's `openGraph` replaces the root one whole, so the root
  // opengraph-image never reaches it. Without a recipe image, name the generated one.
  // #256: via the shared helper. #164: a page image states no width/height; it is an
  // arbitrary external or Blob file whose real size we do not store.
  const social = socialImages(firstImage ? { url: firstImage, alt: recipe.name } : null);

  return {
    // #138: the root layout's title.template appends the brand.
    title: recipe.name,
    description:
      recipe.description ||
      `Delicious ${recipe.name} recipe from Joanie's Kitchen - ${recipe.cuisine ? `${recipe.cuisine} cuisine` : 'Easy to make'}`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: recipe.name,
      description: recipe.description || `Delicious ${recipe.name} recipe`,
      url: canonicalUrl,
      type: 'article',
      images: social.openGraph,
      siteName: "Joanie's Kitchen",
    },
    twitter: {
      card: 'summary_large_image',
      title: recipe.name,
      description: recipe.description || `Delicious ${recipe.name} recipe`,
      images: social.twitter, // #171: same fallback as openGraph
    },
    // #138: tags is a JSON string; spreading it emitted one keyword per character.
    keywords: [
      recipe.name,
      recipe.cuisine,
      ...parseRecipeTags(recipe.tags),
      'recipe',
      'cooking',
      'zero waste cooking',
    ].filter((keyword): keyword is string => Boolean(keyword)),
  };
}

export default async function RecipeLayout({ children, params }: RecipeLayoutProps) {
  const { slug } = await params;
  // #134: notFound() before the shell commits, so a missing or hidden recipe is a
  // real 404. Also redirects a visible recipe's UUID URL to its slug.
  await loadVisibleRecipeOrNotFound(slug);

  return <>{children}</>;
}
