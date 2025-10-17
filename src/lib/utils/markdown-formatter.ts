import matter from 'gray-matter';
import type { Recipe } from '@/lib/db/schema';
import { normalizeIngredient } from './recipe-utils';

/**
 * Formats a recipe object into markdown with YAML frontmatter
 */
export function recipeToMarkdown(recipe: Recipe): string {
  // Parse JSON fields
  const ingredients =
    typeof recipe.ingredients === 'string'
      ? JSON.parse(recipe.ingredients)
      : recipe.ingredients || [];
  const instructions =
    typeof recipe.instructions === 'string'
      ? JSON.parse(recipe.instructions)
      : recipe.instructions || [];
  const tags = recipe.tags
    ? typeof recipe.tags === 'string'
      ? JSON.parse(recipe.tags)
      : recipe.tags
    : [];
  const nutritionInfo = recipe.nutrition_info
    ? typeof recipe.nutrition_info === 'string'
      ? JSON.parse(recipe.nutrition_info)
      : recipe.nutrition_info
    : {};
  // Prepare frontmatter data
  const frontmatter = {
    title: recipe.name,
    description: recipe.description,
    prepTime: recipe.prep_time,
    cookTime: recipe.cook_time,
    totalTime: (recipe.prep_time || 0) + (recipe.cook_time || 0),
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    cuisine: recipe.cuisine,
    imageUrl: recipe.image_url,
    tags: tags,
    nutritionInfo: nutritionInfo,
    createdAt: recipe.created_at?.toISOString(),
    updatedAt: recipe.updated_at?.toISOString(),
  };

  // Build markdown content
  const markdownContent = [];

  // Add description if present
  if (recipe.description) {
    markdownContent.push(`> ${recipe.description}`);
    markdownContent.push('');
  }

  // Add recipe metadata
  markdownContent.push('## Recipe Information');
  markdownContent.push('');
  if (recipe.prep_time) markdownContent.push(`- **Prep Time:** ${recipe.prep_time} minutes`);
  if (recipe.cook_time) markdownContent.push(`- **Cook Time:** ${recipe.cook_time} minutes`);
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0);
  if (totalTime > 0) markdownContent.push(`- **Total Time:** ${totalTime} minutes`);
  if (recipe.servings) markdownContent.push(`- **Servings:** ${recipe.servings}`);
  if (recipe.difficulty) markdownContent.push(`- **Difficulty:** ${recipe.difficulty}`);
  if (recipe.cuisine) markdownContent.push(`- **Cuisine:** ${recipe.cuisine}`);
  markdownContent.push('');

  // Add ingredients
  if (ingredients && ingredients.length > 0) {
    markdownContent.push('## Ingredients');
    markdownContent.push('');
    ingredients.forEach((ingredient: string) => {
      // Normalize ingredient formatting for consistency
      const normalized = normalizeIngredient(ingredient);
      markdownContent.push(`- ${normalized}`);
    });
    markdownContent.push('');
  }

  // Add instructions
  if (instructions && instructions.length > 0) {
    markdownContent.push('## Instructions');
    markdownContent.push('');
    instructions.forEach((instruction: string, index: number) => {
      markdownContent.push(`${index + 1}. ${instruction}`);
    });
    markdownContent.push('');
  }

  // Add nutrition info if present
  if (nutritionInfo && Object.keys(nutritionInfo).length > 0) {
    markdownContent.push('## Nutrition Information');
    markdownContent.push('');
    markdownContent.push('| Nutrient | Value |');
    markdownContent.push('|----------|-------|');

    const nutritionLabels: Record<string, string> = {
      calories: 'Calories',
      protein: 'Protein',
      carbs: 'Carbohydrates',
      fat: 'Fat',
      fiber: 'Fiber',
      sugar: 'Sugar',
      sodium: 'Sodium',
    };

    Object.entries(nutritionInfo).forEach(([key, value]) => {
      const label = nutritionLabels[key] || key;
      markdownContent.push(`| ${label} | ${value} |`);
    });
    markdownContent.push('');
  }

  // Add tags if present
  if (tags && tags.length > 0) {
    markdownContent.push('## Tags');
    markdownContent.push('');
    markdownContent.push(tags.map((tag: string) => `#${tag}`).join(' '));
    markdownContent.push('');
  }

  // Combine frontmatter and content
  const fullMarkdown = matter.stringify(markdownContent.join('\n'), frontmatter);

  return fullMarkdown;
}

/**
 * Generates a safe filename from recipe title
 */
export function generateRecipeFilename(title: string): string {
  // Remove special characters and replace spaces with hyphens
  const safeName = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

  return `${safeName}.md`;
}

/**
 * Formats recipe data for display in markdown preview
 */
export function formatRecipePreview(recipe: Partial<Recipe>): string {
  const preview = [];

  preview.push(`# ${recipe.name || 'Untitled Recipe'}`);
  preview.push('');

  if (recipe.description) {
    preview.push(`*${recipe.description}*`);
    preview.push('');
  }

  const details = [];
  if (recipe.prep_time) details.push(`Prep: ${recipe.prep_time}min`);
  if (recipe.cook_time) details.push(`Cook: ${recipe.cook_time}min`);
  if (recipe.servings) details.push(`Servings: ${recipe.servings}`);

  if (details.length > 0) {
    preview.push(details.join(' | '));
    preview.push('');
  }

  return preview.join('\n');
}
