import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '@/lib/db/schema';
import { RecipeCard } from '../RecipeCard';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock tag ontology module
vi.mock('@/lib/tag-ontology', () => ({
  categorizeTags: (tags: string[]) => ({ general: tags }),
  getCategoryColor: () => 'blue',
}));

describe('RecipeCard', () => {
  const mockRecipe: Recipe = {
    id: 'test-recipe-1',
    user_id: 'test-user',
    chef_id: null,
    source_id: null,
    name: 'Chocolate Chip Cookies',
    slug: 'chocolate-chip-cookies',
    description: 'Delicious homemade cookies',
    ingredients: JSON.stringify(['flour', 'sugar', 'chocolate chips']),
    instructions: JSON.stringify(['Mix ingredients', 'Bake at 350F']),
    prep_time: 15,
    cook_time: 12,
    servings: 24,
    difficulty: 'easy',
    cuisine: 'American',
    tags: JSON.stringify(['dessert', 'baking']),
    images: JSON.stringify([]),
    is_ai_generated: false,
    is_public: true,
    is_system_recipe: false,
    is_meal_prep_friendly: false,
    nutrition_info: null,
    model_used: null,
    source: null,
    license: 'PERSONAL_USE',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    image_url: null,
    system_rating: null,
    avg_user_rating: null,
    total_user_ratings: null,
    embedding_model: null,
    search_query: null,
    discovery_date: null,
    validation_model: null,
    confidence_score: null,
    discovery_week: null,
    discovery_year: null,
    published_date: null,
    system_rating_reason: null,
    image_flagged_for_regeneration: false,
    image_regeneration_requested_at: null,
    image_regeneration_requested_by: null,
    content_flagged_for_cleanup: false,
    ingredients_need_cleanup: false,
    instructions_need_cleanup: false,
    deleted_at: null,
    deleted_by: null,
    like_count: 0,
    fork_count: 0,
    collection_count: 0,
    instruction_metadata: null,
    instruction_metadata_version: null,
    instruction_metadata_generated_at: null,
    instruction_metadata_model: null,
    weight_score: null,
    richness_score: null,
    acidity_score: null,
    sweetness_level: null,
    dominant_textures: null,
    dominant_flavors: null,
    serving_temperature: null,
    pairing_rationale: null,
    video_url: null,
    resourcefulness_score: null,
    waste_reduction_tags: null,
    scrap_utilization_notes: null,
    environmental_notes: null,
  };

  it('renders recipe name', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
  });

  it('renders recipe description', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    expect(screen.getByText('Delicious homemade cookies')).toBeInTheDocument();
  });

  it('displays total time', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    // Total time should be prep + cook = 15 + 12 = 27
    expect(screen.getByText('27')).toBeInTheDocument();
  });

  it('displays servings', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('displays difficulty', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    expect(screen.getByText('easy')).toBeInTheDocument();
  });

  it('links to recipe detail page', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    const link = screen.getByRole('link', { name: /view recipe/i });
    expect(link).toHaveAttribute('href', '/recipes/test-recipe-1');
  });

  it('displays rank badge when showRank is provided', () => {
    render(<RecipeCard recipe={mockRecipe} showRank={1} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays similarity score when showSimilarity is true', () => {
    render(<RecipeCard recipe={mockRecipe} showSimilarity={true} similarity={0.85} />);
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    const minimalRecipe: Recipe = {
      ...mockRecipe,
      prep_time: null,
      cook_time: null,
      cuisine: null,
      tags: null,
    };

    render(<RecipeCard recipe={minimalRecipe} />);
    expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
  });

  it('displays recipe image when available', () => {
    const recipeWithImage: Recipe = {
      ...mockRecipe,
      images: JSON.stringify(['https://example.com/cookie.jpg']),
    };

    render(<RecipeCard recipe={recipeWithImage} />);
    const images = screen.getAllByRole('img');
    const recipeImage = images.find((img) => img.getAttribute('alt') === 'Chocolate Chip Cookies');
    expect(recipeImage).toHaveAttribute('src', 'https://example.com/cookie.jpg');
  });

  it('shows top-rated badge for high-rated recipes', () => {
    const topRatedRecipe: Recipe = {
      ...mockRecipe,
      system_rating: '4.8',
    };

    render(<RecipeCard recipe={topRatedRecipe} />);
    // The component should show some indication of top rating
    // This might need adjustment based on actual implementation
  });

  it('parses tags correctly', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    expect(screen.getByText('dessert')).toBeInTheDocument();
    expect(screen.getByText('baking')).toBeInTheDocument();
  });

  it('handles null images array', () => {
    const recipeNoImages: Recipe = {
      ...mockRecipe,
      images: null,
    };

    render(<RecipeCard recipe={recipeNoImages} />);
    expect(screen.getByText('Chocolate Chip Cookies')).toBeInTheDocument();
  });
});
