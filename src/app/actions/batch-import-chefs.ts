'use server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { convertUrlToRecipe } from './recipe-crawl';
import { generateRecipeEmbedding } from '@/lib/ai/embeddings';
import { saveRecipeEmbedding } from '@/lib/db/embeddings';

// Recipe URL data structure
interface RecipeURL {
  chefSlug: string;
  recipeName: string;
  url: string;
}

// Truncated list - add all 121 URLs here
const RECIPE_DATA: RecipeURL[] = [
  { chefSlug: 'alton-brown', recipeName: 'Good Eats Roast Thanksgiving Turkey', url: 'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/' },
  { chefSlug: 'alton-brown', recipeName: 'Meatloaf: Reloaded', url: 'https://altonbrown.com/recipes/meatloaf-reloaded/' },
];

export async function batchImportChefRecipe(recipeUrl: RecipeURL, chefId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  console.log('Importing:', recipeUrl.recipeName);

  const result = await convertUrlToRecipe(recipeUrl.url);
  if (!result.success || !result.recipe) {
    throw new Error(result.error || 'Failed to extract recipe');
  }

  const extracted = result.recipe;

  const embeddingResult = await generateRecipeEmbedding({
    id: '',
    user_id: userId,
    chef_id: chefId,
    source_id: null,
    name: extracted.name,
    description: extracted.description || '',
    ingredients: JSON.stringify(extracted.ingredients),
    instructions: JSON.stringify(extracted.instructions),
    cuisine: extracted.cuisine || null,
    tags: JSON.stringify(extracted.tags || []),
    difficulty: extracted.difficulty || null,
    prep_time: null,
    cook_time: null,
    servings: extracted.servings || null,
    images: JSON.stringify(extracted.images || []),
    source: recipeUrl.url,
    is_public: true,
    is_system_recipe: true,
    created_at: new Date(),
    updated_at: new Date(),
    resourcefulness_score: null,
    waste_reduction_tags: null,
    scrap_utilization_notes: null,
    environmental_notes: null,
    qa_status: 'validated',
    qa_timestamp: new Date(),
    qa_method: 'batch-import',
    qa_confidence: '0.95',
    qa_notes: 'Imported via batch import',
    qa_issues_found: null,
    qa_fixes_applied: JSON.stringify(['chef_attribution']),
  });

  const [newRecipe] = await db.insert(recipes).values({
    user_id: userId,
    chef_id: chefId,
    name: extracted.name,
    slug: extracted.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: extracted.description,
    ingredients: JSON.stringify(extracted.ingredients),
    instructions: JSON.stringify(extracted.instructions),
    prep_time: extracted.prepTime ? parseInt(extracted.prepTime) : null,
    cook_time: extracted.cookTime ? parseInt(extracted.cookTime) : null,
    servings: extracted.servings,
    difficulty: extracted.difficulty,
    cuisine: extracted.cuisine,
    tags: JSON.stringify(extracted.tags || []),
    images: JSON.stringify(extracted.images || []),
    source: recipeUrl.url,
    is_public: true,
    is_system_recipe: true,
    qa_status: 'validated',
    qa_method: 'batch-import',
    qa_confidence: '0.95',
  }).returning();

  await saveRecipeEmbedding(newRecipe.id, embeddingResult.embedding, embeddingResult.embeddingText);

  return { success: true, recipeId: newRecipe.id, recipeName: newRecipe.name };
}
