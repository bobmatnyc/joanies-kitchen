// #184: RecipePreviewModal parsed ingredients, instructions and tags with a bare JSON.parse, so a
// malformed stored value crashed the admin moderation queue.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RecipePreviewModal } from '../RecipePreviewModal';

vi.mock('../ModerationActionDialog', () => ({ ModerationActionDialog: () => null }));
vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: test stub
  default: (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />,
}));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
  }
);

function modalRecipe(fields: { ingredients: string; instructions: string; tags: string }) {
  return {
    id: 'r-1',
    name: 'Soup',
    description: null,
    cuisine: null,
    difficulty: null,
    prep_time: null,
    cook_time: null,
    servings: null,
    images: null,
    user_id: 'u-1',
    created_at: new Date('2026-01-01T00:00:00Z'),
    moderation_status: 'pending',
    submission_notes: null,
    ...fields,
  };
}

function show(recipe: ReturnType<typeof modalRecipe>) {
  render(<RecipePreviewModal recipe={recipe} open onOpenChange={vi.fn()} />);
}

describe('RecipePreviewModal field parsing (#184)', () => {
  it('renders malformed ingredients, instructions and tags without throwing', () => {
    show(
      modalRecipe({
        ingredients: '{"water","salt"}',
        instructions: 'Boil the water.',
        tags: '{soup,easy}',
      })
    );
    expect(screen.getByText('Boil the water.')).toBeTruthy();
    expect(screen.getByText('soup')).toBeTruthy();
  });

  it('renders valid JSON exactly as before', () => {
    show(modalRecipe({ ingredients: '["water"]', instructions: '["boil"]', tags: '["soup"]' }));
    expect(screen.getByText('water')).toBeTruthy();
    expect(screen.getByText('boil')).toBeTruthy();
    expect(screen.getByText('soup')).toBeTruthy();
  });
});
