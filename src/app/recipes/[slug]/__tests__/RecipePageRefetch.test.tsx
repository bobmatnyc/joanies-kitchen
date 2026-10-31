/**
 * #22: the removed client auth shim built a new user object on every render, and the
 * recipe fetch effect depends on `user`, so a signed-in visitor refetched the recipe
 * and re-tracked a view on every render. The session user must keep its reference.
 * The real useSessionUser runs here over a mocked useSession that, like
 * SessionProvider, returns the same session object on every render.
 */
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipePageClient from '@/app/recipes/[slug]/RecipePageClient';

const getRecipe = vi.hoisted(() => vi.fn());
const trackRecipeView = vi.hoisted(() => vi.fn(async () => undefined));
const ROUTER = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const SESSION = vi.hoisted(() => ({
  data: {
    user: { id: 'u1', name: 'Ada Lovelace', email: 'ada@x.test', image: null, isAdmin: false },
    expires: '2099-01-01',
  },
  status: 'authenticated',
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  // Stable like Next's router; a new object per call would itself rerun the fetch effect.
  useRouter: () => ROUTER,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('next-auth/react', () => ({ useSession: () => SESSION, signIn: vi.fn() }));
vi.mock('@/app/actions/recipes', () => ({ getRecipe, deleteRecipe: vi.fn() }));
vi.mock('@/app/actions/recipe-cloning', () => ({ getOriginalRecipe: vi.fn(async () => null) }));
vi.mock('@/app/actions/recipe-export', () => ({
  exportRecipeAsMarkdown: vi.fn(),
  exportRecipeAsPDF: vi.fn(),
}));
vi.mock('@/app/actions/recipe-views', () => ({
  getRecipeViewCount: vi.fn(async () => 0),
  trackRecipeView,
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

const ROW = {
  id: 'r-22',
  slug: 'plain-soup',
  name: 'Plain Soup',
  user_id: 'system',
  is_system_recipe: true,
  ingredients: '[]',
  instructions: '[]',
  tags: '[]',
  images: null,
  image_url: null,
};

beforeEach(() => {
  getRecipe.mockReset();
  trackRecipeView.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('recipe page fetch (#22)', () => {
  it('signed in: fetches the recipe and tracks the view a bounded number of times', async () => {
    getRecipe.mockResolvedValue({ success: true, data: ROW });
    render(<RecipePageClient params={Promise.resolve({ slug: 'plain-soup' })} />);
    await screen.findByAltText('Recipe placeholder');
    // Let effects and the background fetches settle; a per-render refetch keeps going.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(getRecipe.mock.calls.length).toBeLessThanOrEqual(2);
    expect(trackRecipeView.mock.calls.length).toBeLessThanOrEqual(2);
  });
});
