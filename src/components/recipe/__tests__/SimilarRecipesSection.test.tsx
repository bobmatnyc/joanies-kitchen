// #128: "Recipes Like This" is fetched during the page request, not from the client
// after getRecipe, where it queued behind every other server action.
import { render, screen, waitFor } from '@testing-library/react';
import { isValidElement, type ReactElement, Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SemanticSearchResult } from '@/app/actions/semantic-search';
import RecipePage from '@/app/recipes/[slug]/page';
import { SimilarRecipesSection } from '../SimilarRecipesSection';
import { SimilarRecipesWidget } from '../SimilarRecipesWidget';

const calls = vi.hoisted(() => [] as string[]);
const getRecipe = vi.hoisted(() => vi.fn());
const findSimilarToRecipe = vi.hoisted(() => vi.fn());
const clientPage = vi.hoisted(() => vi.fn(() => null));

vi.mock('@/app/actions/recipes', () => ({ getRecipe }));
vi.mock('@/app/actions/semantic-search', () => ({ findSimilarToRecipe }));
vi.mock('@/app/recipes/[slug]/RecipePageClient', () => ({ default: clientPage }));
vi.mock('../RecipeCard', () => ({
  RecipeCard: ({ recipe }: { recipe: { name: string } }) => <div>{recipe.name}</div>,
}));

const SOURCE = { id: 'r-1', slug: 'open-soup', name: 'Open Soup' };
const NEIGHBOUR = { id: 'r-2', slug: 'open-salad', name: 'Open Salad', similarity: 0.9 };

beforeEach(() => {
  calls.length = 0;
  getRecipe.mockReset().mockImplementation(async (slug: string) => {
    calls.push(`getRecipe:${slug}`);
    return { success: true, data: SOURCE };
  });
  findSimilarToRecipe.mockReset().mockImplementation(async (id: string) => {
    calls.push(`findSimilarToRecipe:${id}`);
    return { success: true, recipes: [NEIGHBOUR] };
  });
  clientPage.mockClear();
});

/** Renders the server page the way the RSC pass does: the page, then its async slot. */
async function renderServerPage(slug: string) {
  const page = (await RecipePage({ params: Promise.resolve({ slug }) })) as ReactElement<{
    similarRecipes: ReactElement<{ children: ReactElement }>;
  }>;
  const slot = page.props.similarRecipes;
  expect(slot.type).toBe(Suspense);
  const section = slot.props.children as ReactElement<{ slugOrId: string }>;
  expect(section.type).toBe(SimilarRecipesSection);
  return { page, element: await SimilarRecipesSection(section.props) };
}

describe('#128 recipe page fetch trigger', () => {
  it('starts the similar-recipes fetch in the server render, before any client code runs', async () => {
    const { element } = await renderServerPage('open-soup');
    // Only the server-side lookup precedes it; no client action and no client mount.
    expect(calls).toEqual(['getRecipe:open-soup', 'findSimilarToRecipe:r-1']);
    expect(clientPage).not.toHaveBeenCalled();
    expect(isValidElement(element)).toBe(true);
    expect((element as ReactElement<{ initialResult: unknown }>).props.initialResult).toEqual({
      success: true,
      recipes: [NEIGHBOUR],
    });
  });

  it('the seeded widget sends no server action on mount', async () => {
    const { element } = await renderServerPage('open-soup');
    findSimilarToRecipe.mockClear();
    render(element as ReactElement);
    expect(screen.getByText('Recipes Like This')).toBeInTheDocument();
    expect(screen.getByText('Open Salad')).toBeInTheDocument();
    expect(findSimilarToRecipe).not.toHaveBeenCalled();
  });

  it('renders no section when the recipe is not readable', async () => {
    getRecipe.mockResolvedValue({ success: false, error: 'Access denied' });
    expect(await SimilarRecipesSection({ slugOrId: 'secret' })).toBeNull();
    expect(findSimilarToRecipe).not.toHaveBeenCalled();
  });

  it('skips a UUID URL that redirects to its slug', async () => {
    expect(
      await SimilarRecipesSection({ slugOrId: 'aaaaaaaa-0000-4000-8000-00000000000a' })
    ).toBeNull();
    expect(findSimilarToRecipe).not.toHaveBeenCalled();
  });
});

describe('#128 SimilarRecipesWidget with a server result', () => {
  const widget = (initialResult?: SemanticSearchResult) => (
    <SimilarRecipesWidget recipeId="r-1" recipeName="Open Soup" initialResult={initialResult} />
  );

  it('an empty result renders nothing, as before', () => {
    const { container } = render(widget({ success: true, recipes: [] }));
    expect(container).toBeEmptyDOMElement();
    expect(findSimilarToRecipe).not.toHaveBeenCalled();
  });

  it('a rate-limit refusal renders the error card with a retry', () => {
    render(
      widget({
        success: false,
        recipes: [],
        error: 'Too many searches; try again shortly',
        errorCode: 'RATE_LIMITED',
        retryAfterSec: 42,
      })
    );
    expect(screen.getByText('Too many searches; try again shortly')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(findSimilarToRecipe).not.toHaveBeenCalled();
  });

  it('without a server result it still loads through the action', async () => {
    render(widget());
    await waitFor(() => expect(findSimilarToRecipe).toHaveBeenCalledWith('r-1', 6));
  });
});
