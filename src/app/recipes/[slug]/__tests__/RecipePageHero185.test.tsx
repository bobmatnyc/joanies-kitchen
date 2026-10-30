/**
 * #185: a recipe with no usable image rendered no hero at all, and a stored site logo
 * rendered as the hero. Both must show the shared placeholder.
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipePageClient from '@/app/recipes/[slug]/RecipePageClient';

const getRecipe = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/lib/auth-client', () => ({ useUser: () => ({ user: null, isSignedIn: false }) }));
vi.mock('@/app/actions/recipes', () => ({ getRecipe, deleteRecipe: vi.fn() }));
vi.mock('@/app/actions/recipe-cloning', () => ({ getOriginalRecipe: vi.fn(async () => null) }));
vi.mock('@/app/actions/recipe-export', () => ({
  exportRecipeAsMarkdown: vi.fn(),
  exportRecipeAsPDF: vi.fn(),
}));
vi.mock('@/app/actions/recipe-views', () => ({
  getRecipeViewCount: vi.fn(async () => 0),
  trackRecipeView: vi.fn(async () => undefined),
}));
vi.mock('@/app/actions/user-profiles', () => ({ getProfileByUserId: vi.fn(async () => null) }));
// Page sections unrelated to the hero image.
vi.mock('@/components/admin/AdminContentActions', () => ({ AdminContentActions: () => null }));
vi.mock('@/components/admin/AdminEditMode', () => ({
  AdminEditModeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/admin/FlagImageButton', () => ({ FlagImageButton: () => null }));
vi.mock('@/components/admin/RecipeContentWithEdit', () => ({ RecipeContentWithEdit: () => null }));
vi.mock('@/components/admin/RecipeImageFlag', () => ({ RecipeImageFlag: () => null }));
vi.mock('@/components/collections/AddToCollectionButton', () => ({
  AddToCollectionButton: () => null,
}));
vi.mock('@/components/favorites/FavoriteButton', () => ({ FavoriteButton: () => null }));
vi.mock('@/components/recipe/BackToChef', () => ({ BackToChef: () => null }));
vi.mock('@/components/recipe/CloneRecipeButton', () => ({ CloneRecipeButton: () => null }));
vi.mock('@/components/recipe/FlagButton', () => ({ FlagButton: () => null }));
vi.mock('@/components/recipe/InventoryMatchSection', () => ({ InventoryMatchSection: () => null }));
vi.mock('@/components/recipe/RatingDisplay', () => ({ RatingDisplay: () => null }));
vi.mock('@/components/recipe/RecipeComments', () => ({ RecipeComments: () => null }));
vi.mock('@/components/recipe/RecipeEngagementStats', () => ({
  RecipeEngagementStats: () => null,
  RecipeForkAttribution: () => null,
}));
vi.mock('@/components/recipe/RecipeRatings', () => ({ RecipeRatings: () => null }));
vi.mock('@/components/recipe/SemanticTagDisplay', () => ({ SemanticTagDisplay: () => null }));
vi.mock('@/components/recipe/SubstitutionSuggestionsWrapper', () => ({
  SubstitutionSuggestionsWrapper: () => null,
}));
vi.mock('@/components/recipe/WasteReductionSection', () => ({ WasteReductionSection: () => null }));
// The page loads tag-ontology through a CommonJS `require('@/lib/...')`, which vitest
// cannot resolve; no tags skips that branch. Image parsing stays the real parseRecipe.
vi.mock('@/lib/utils/recipe-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils/recipe-utils')>();
  return {
    ...actual,
    parseRecipe: (row: Parameters<typeof actual.parseRecipe>[0]) => ({
      ...actual.parseRecipe(row),
      tags: undefined,
    }),
  };
});

const LOGO = 'https://omnivorescookbook.com/wp-content/themes/oc2025/images/logo.svg';

function recipeRow(images: string | null, image_url: string | null) {
  return {
    id: 'r-185',
    slug: 'plain-soup',
    name: 'Plain Soup',
    user_id: 'system',
    is_system_recipe: true,
    ingredients: '[]',
    instructions: '[]',
    tags: '[]',
    images,
    image_url,
  };
}

/** The placeholder hero is announced as a placeholder, never as "Plain Soup - Image 1". */
async function heroSrc(): Promise<string | null> {
  render(<RecipePageClient params={Promise.resolve({ slug: 'plain-soup' })} />);
  const hero = await screen.findByAltText('Recipe placeholder');
  expect(screen.queryByAltText('Plain Soup - Image 1')).toBeNull();
  return hero.getAttribute('src');
}

beforeEach(() => {
  getRecipe.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('recipe page hero placeholder (#185)', () => {
  it('a recipe with no image shows the placeholder hero', async () => {
    getRecipe.mockResolvedValue({ success: true, data: recipeRow(null, null) });
    expect(await heroSrc()).toBe('/placeholders/generic.svg');
  });

  it('a recipe whose only image is a site logo shows the placeholder hero', async () => {
    getRecipe.mockResolvedValue({
      success: true,
      data: recipeRow(JSON.stringify([LOGO]), LOGO),
    });
    expect(await heroSrc()).toBe('/placeholders/generic.svg');
  });

  it('a real photo keeps the dish alt text', async () => {
    const photo = 'https://x.test/uploads/Our-Signature-Margarita.jpg';
    getRecipe.mockResolvedValue({ success: true, data: recipeRow(JSON.stringify([photo]), null) });
    render(<RecipePageClient params={Promise.resolve({ slug: 'plain-soup' })} />);
    const hero = await screen.findByAltText('Plain Soup - Image 1');
    expect(hero.getAttribute('src')).toBe(photo);
  });
});
