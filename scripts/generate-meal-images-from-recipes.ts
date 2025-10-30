#!/usr/bin/env tsx

/**
 * Meal Image Generation Script
 *
 * Generates images for meals using their recipes as prompt generators.
 * Uses Stable Diffusion XL for high-quality image generation.
 *
 * Usage:
 *   npx tsx scripts/generate-meal-images-from-recipes.ts --meal-slug joanies-sunday-lunch
 *   npx tsx scripts/generate-meal-images-from-recipes.ts --all
 */

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { put } from '@vercel/blob';

const sql = neon(process.env.DATABASE_URL!);

interface Recipe {
  id: string;
  name: string;
  description: string | null;
  ingredients: string;
  cuisine: string | null;
}

interface Meal {
  id: string;
  name: string;
  description: string | null;
  meal_type: string | null;
  slug: string;
}

interface MealRecipe {
  meal: Meal;
  recipes: Recipe[];
}

/**
 * Generate a detailed prompt for meal image generation
 */
function generateMealPrompt(meal: Meal, recipes: Recipe[]): string {
  const recipeTitles = recipes.map((r) => r.name).join(', ');
  const cuisines = [...new Set(recipes.map((r) => r.cuisine).filter(Boolean))];
  const cuisineText = cuisines.length > 0 ? cuisines.join(' and ') : 'gourmet';

  // Extract key ingredients from recipes
  const allIngredients: string[] = [];
  for (const recipe of recipes) {
    try {
      const ingredients = JSON.parse(recipe.ingredients);
      allIngredients.push(...ingredients);
    } catch {
      // Skip if can't parse
    }
  }

  // Get prominent ingredients (mentioned in multiple recipes or unique items)
  const ingredientCounts = new Map<string, number>();
  for (const ing of allIngredients) {
    const cleaned = ing
      .toLowerCase()
      .replace(/^\d+.*?(cup|tablespoon|teaspoon|lb|oz|g|kg)\s+/i, '')
      .trim();
    const key = cleaned.split(',')[0].trim();
    ingredientCounts.set(key, (ingredientCounts.get(key) || 0) + 1);
  }

  const prominentIngredients = Array.from(ingredientCounts.entries())
    .filter(([_, count]) => count >= 2 || ingredientCounts.size <= 5)
    .slice(0, 5)
    .map(([ing]) => ing);

  const mealTypeText = meal.meal_type ? `${meal.meal_type} ` : '';

  const prompt = `Professional overhead food photography of a complete ${cuisineText} ${mealTypeText}meal. ${meal.description || ''}
The spread includes: ${recipeTitles}.
Featured ingredients: ${prominentIngredients.join(', ')}.
Styled on elegant dinnerware with natural lighting, rustic wooden table, garnished with fresh herbs,
warm inviting atmosphere, culinary magazine quality, shallow depth of field,
vibrant colors, appetizing presentation, 8K ultra detailed food photography`;

  return prompt;
}

/**
 * Generate image using Stable Diffusion XL
 */
async function generateImage(prompt: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const venvPython = path.join(process.cwd(), 'scripts/image-gen/venv/bin/python3');
    const sdxlScript = path.join(process.cwd(), 'scripts/image-gen/meal_image_generator.py');

    // Check if SD XL script exists
    if (!require('node:fs').existsSync(sdxlScript)) {
      reject(new Error(`SD XL script not found at ${sdxlScript}`));
      return;
    }

    // Check if venv Python exists
    if (!require('node:fs').existsSync(venvPython)) {
      reject(new Error(`Python venv not found at ${venvPython}`));
      return;
    }

    const args = [
      sdxlScript,
      '--prompt',
      prompt,
      '--output',
      outputPath,
      '--width',
      '1024',
      '--height',
      '1024',
      '--steps',
      '30',
    ];

    console.log('🎨 Starting Stable Diffusion XL image generation...');
    console.log(`   Model: Stable Diffusion XL (30 steps, high quality)`);

    const childProcess = spawn(venvPython, args);

    let _stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      const text = data.toString();
      _stdout += text;
      console.log(text);
    });

    childProcess.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      console.error(text);
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Image generation completed');
        resolve();
      } else {
        reject(new Error(`Image generation failed with code ${code}: ${stderr}`));
      }
    });

    childProcess.on('error', (err) => {
      reject(new Error(`Failed to start SD XL process: ${err.message}`));
    });
  });
}

/**
 * Upload image to Vercel Blob
 */
async function uploadToBlob(localPath: string, mealId: string): Promise<string> {
  console.log(`📤 Uploading to Vercel Blob...`);

  const fileBuffer = await fs.readFile(localPath);
  const hash = crypto.createHash('md5').update(fileBuffer).digest('hex').substring(0, 8);
  const filename = `meals/${mealId}-${hash}.png`;

  const blob = await put(filename, fileBuffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/png',
  });

  console.log(`✅ Uploaded: ${blob.url}`);
  return blob.url;
}

/**
 * Get meal with recipes
 */
async function getMealWithRecipes(mealSlug: string): Promise<MealRecipe | null> {
  const result = await sql`
    SELECT
      m.id as meal_id,
      m.name as meal_name,
      m.description as meal_description,
      m.meal_type,
      m.slug,
      json_agg(
        json_build_object(
          'id', r.id,
          'name', r.name,
          'description', r.description,
          'ingredients', r.ingredients,
          'cuisine', r.cuisine
        )
      ) as recipes
    FROM meals m
    INNER JOIN meal_recipes mr ON m.id = mr.meal_id
    INNER JOIN recipes r ON mr.recipe_id = r.id
    WHERE m.slug = ${mealSlug}
    GROUP BY m.id, m.name, m.description, m.meal_type, m.slug
  `;

  if (result.length === 0) return null;

  const row = result[0] as any;
  return {
    meal: {
      id: row.meal_id,
      name: row.meal_name,
      description: row.meal_description,
      meal_type: row.meal_type,
      slug: row.slug,
    },
    recipes: row.recipes,
  };
}

/**
 * Get all meals without images
 */
async function getAllMealsWithoutImages(): Promise<MealRecipe[]> {
  const result = await sql`
    SELECT
      m.id as meal_id,
      m.name as meal_name,
      m.description as meal_description,
      m.meal_type,
      m.slug,
      json_agg(
        json_build_object(
          'id', r.id,
          'name', r.name,
          'description', r.description,
          'ingredients', r.ingredients,
          'cuisine', r.cuisine
        )
      ) as recipes
    FROM meals m
    INNER JOIN meal_recipes mr ON m.id = mr.meal_id
    INNER JOIN recipes r ON mr.recipe_id = r.id
    WHERE m.image_url IS NULL OR m.image_url = ''
    GROUP BY m.id, m.name, m.description, m.meal_type, m.slug
    LIMIT 10
  `;

  return result.map((row: any) => ({
    meal: {
      id: row.meal_id,
      name: row.meal_name,
      description: row.meal_description,
      meal_type: row.meal_type,
      slug: row.slug,
    },
    recipes: row.recipes,
  }));
}

/**
 * Update meal with generated image URL
 */
async function updateMealImage(mealId: string, imageUrl: string): Promise<void> {
  await sql`
    UPDATE meals
    SET image_url = ${imageUrl},
        updated_at = NOW()
    WHERE id = ${mealId}
  `;
  console.log(`✅ Updated meal ${mealId} with image URL`);
}

/**
 * Process a single meal
 */
async function processMeal(mealData: MealRecipe): Promise<void> {
  const { meal, recipes } = mealData;

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 Processing: ${meal.name}`);
  console.log(`   Recipes: ${recipes.map((r) => r.name).join(', ')}`);
  console.log('='.repeat(80));

  // Generate prompt
  const prompt = generateMealPrompt(meal, recipes);
  console.log(`\n💭 Prompt:\n${prompt}\n`);

  // Create temp directory
  const tmpDir = path.join(process.cwd(), 'tmp/meal-images');
  await fs.mkdir(tmpDir, { recursive: true });

  // Generate image
  const tempPath = path.join(tmpDir, `${meal.slug}-${Date.now()}.png`);
  await generateImage(prompt, tempPath);

  // Upload to Vercel Blob
  const blobUrl = await uploadToBlob(tempPath, meal.id);

  // Update database
  await updateMealImage(meal.id, blobUrl);

  // Clean up temp file
  await fs.unlink(tempPath);
  console.log('🗑️  Cleaned up temp file');

  console.log(`\n✅ Completed: ${meal.name}`);
  console.log(`   Image URL: ${blobUrl}`);
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Meal Image Generator - Using Stable Diffusion XL for high-quality generation

Usage:
  npx tsx scripts/generate-meal-images-from-recipes.ts --meal-slug <slug>
  npx tsx scripts/generate-meal-images-from-recipes.ts --all

Options:
  --meal-slug <slug>  Generate image for specific meal
  --all               Generate images for all meals without images (max 10)
  --help              Show this help message

Requirements:
  - Python venv with Stable Diffusion XL at scripts/image-gen/venv
  - Run setup: cd scripts/image-gen && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt
    `);
    process.exit(0);
  }

  try {
    if (args.includes('--all')) {
      console.log('🔍 Finding meals without images...\n');
      const meals = await getAllMealsWithoutImages();

      if (meals.length === 0) {
        console.log('✅ No meals need images!');
        return;
      }

      console.log(`Found ${meals.length} meals to process\n`);

      for (const mealData of meals) {
        await processMeal(mealData);
      }

      console.log(`\n${'='.repeat(80)}`);
      console.log(`✅ Completed ${meals.length} meals!`);
      console.log('='.repeat(80));
    } else {
      const mealSlugIndex = args.indexOf('--meal-slug');
      if (mealSlugIndex === -1 || !args[mealSlugIndex + 1]) {
        console.error('❌ Error: --meal-slug requires a value');
        process.exit(1);
      }

      const mealSlug = args[mealSlugIndex + 1];
      console.log(`🔍 Looking for meal: ${mealSlug}\n`);

      const mealData = await getMealWithRecipes(mealSlug);

      if (!mealData) {
        console.error(`❌ Error: Meal not found: ${mealSlug}`);
        process.exit(1);
      }

      await processMeal(mealData);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
