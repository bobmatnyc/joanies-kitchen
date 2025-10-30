#!/usr/bin/env tsx
/**
 * Generate AI images for meals using local Stable Diffusion XL
 *
 * Process:
 * 1. Query meals without image_url
 * 2. For each meal, get associated recipes/courses
 * 3. Generate descriptive prompt for complete meal composition
 * 4. Call Python SD XL subprocess to generate image
 * 5. Upload to Vercel Blob storage
 * 6. Update meal record with image_url
 *
 * Environment Variables:
 * - BLOB_READ_WRITE_TOKEN: Vercel Blob storage token (required)
 * - APPLY_CHANGES: "true" to apply changes, "false" for dry run (default: "false")
 * - LIMIT: Maximum number of meals to process (default: 10)
 *
 * Usage:
 *   # Dry run (preview only)
 *   npm run tsx scripts/generate-meal-images-sd.ts
 *
 *   # Apply changes
 *   APPLY_CHANGES=true npm run tsx scripts/generate-meal-images-sd.ts
 *
 *   # Process specific number
 *   APPLY_CHANGES=true LIMIT=5 npm run tsx scripts/generate-meal-images-sd.ts
 */

import 'dotenv/config';
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { put } from '@vercel/blob';
import { eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { mealRecipes, meals } from '@/lib/db/meals-schema';
import { recipes } from '@/lib/db/schema';

// Configuration
const APPLY_CHANGES = process.env.APPLY_CHANGES === 'true';
const LIMIT = parseInt(process.env.LIMIT || '10', 10);
const RATE_LIMIT_DELAY = 2000; // 2 seconds between operations
const MAX_RETRIES = 2;
const RETRY_DELAY = 3000;

// Paths
const PYTHON_SCRIPT = join(process.cwd(), 'scripts/image-gen/meal_image_generator.py');
const TEMP_DIR = join(process.cwd(), 'tmp/meal-images');

interface MealImageResult {
  mealId: string;
  mealName: string;
  success: boolean;
  imageUrl?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
  generationTime?: number;
}

interface CourseInfo {
  category: string;
  recipeName: string;
  cuisine: string | null;
}

/**
 * Ensure temp directory exists
 */
function ensureTempDir(): void {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
    console.log(`✅ Created temp directory: ${TEMP_DIR}`);
  }
}

/**
 * Check Python dependencies
 */
function checkPythonDependencies(): boolean {
  try {
    console.log('🔍 Checking Python dependencies...');

    // Check if Python is available
    execSync('python3 --version', { stdio: 'pipe' });

    // Check required packages
    const requiredPackages = ['torch', 'diffusers', 'PIL'];
    for (const pkg of requiredPackages) {
      try {
        execSync(`python3 -c "import ${pkg}"`, { stdio: 'pipe' });
      } catch {
        console.error(`❌ Missing Python package: ${pkg}`);
        console.error(`   Install with: pip3 install ${pkg}`);
        return false;
      }
    }

    console.log('✅ All Python dependencies available');
    return true;
  } catch (_error) {
    console.error('❌ Python not found or error checking dependencies');
    return false;
  }
}

/**
 * Generate meal description for prompt
 */
function generateMealDescription(courses: CourseInfo[]): string {
  const courseDescriptions: string[] = [];

  // Group by course category
  const groupedCourses = courses.reduce(
    (acc, course) => {
      if (!acc[course.category]) {
        acc[course.category] = [];
      }
      acc[course.category].push(course);
      return acc;
    },
    {} as Record<string, CourseInfo[]>
  );

  // Generate descriptions by course category
  const categoryOrder = ['appetizer', 'soup', 'salad', 'main', 'side', 'bread', 'dessert', 'drink'];

  for (const category of categoryOrder) {
    const coursesInCategory = groupedCourses[category];
    if (!coursesInCategory || coursesInCategory.length === 0) continue;

    const names = coursesInCategory.map((c) => c.recipeName).join(' and ');
    courseDescriptions.push(`${category}: ${names}`);
  }

  // Include any remaining categories not in the predefined order
  for (const [category, coursesInCategory] of Object.entries(groupedCourses)) {
    if (!categoryOrder.includes(category)) {
      const names = coursesInCategory.map((c) => c.recipeName).join(' and ');
      courseDescriptions.push(`${category}: ${names}`);
    }
  }

  return courseDescriptions.join(', ');
}

/**
 * Build prompt for meal image generation
 */
function buildMealPrompt(meal: any, courses: CourseInfo[]): string {
  const coursesDescription = generateMealDescription(courses);
  const mealType = meal.meal_type || 'meal';

  // Detect cuisine from courses
  const cuisines = courses
    .map((c) => c.cuisine)
    .filter((c): c is string => c !== null && c !== undefined);
  const primaryCuisine = cuisines.length > 0 ? cuisines[0] : null;

  let styleDescription = 'elegant dining table';
  if (primaryCuisine) {
    const cuisineLower = primaryCuisine.toLowerCase();
    if (cuisineLower.includes('italian')) {
      styleDescription = 'rustic Italian trattoria with checkered tablecloth';
    } else if (cuisineLower.includes('french')) {
      styleDescription = 'elegant French bistro with marble table';
    } else if (cuisineLower.includes('asian') || cuisineLower.includes('japanese')) {
      styleDescription = 'modern Asian restaurant with bamboo mat';
    } else if (cuisineLower.includes('mexican')) {
      styleDescription = 'colorful Mexican cantina with terracotta dishes';
    } else if (cuisineLower.includes('american')) {
      styleDescription = 'classic American diner with bright lighting';
    }
  }

  const prompt = `Professional overhead food photography of a complete ${mealType}: ${meal.name}.
Multiple elegant dishes arranged on ${styleDescription} featuring:
${coursesDescription}
Flat lay composition with warm natural lighting,
styled by a professional food stylist,
high-end food magazine quality,
appetizing presentation showing full meal composition.
NO text, NO watermarks, NO logos.
Ultra-realistic, editorial quality.`;

  return prompt;
}

/**
 * Call Python SD XL script to generate image
 */
async function generateSDImage(
  prompt: string,
  mealName: string,
  retryCount = 0
): Promise<{ imagePath: string; generationTime: number }> {
  const startTime = Date.now();
  const sanitizedName = mealName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 50);
  const timestamp = Date.now();
  const outputPath = join(TEMP_DIR, `${sanitizedName}-${timestamp}.png`);

  console.log(`   🎨 Generating SD XL image...`);
  console.log(`   📝 Prompt: "${prompt.substring(0, 100)}..."`);

  return new Promise((resolve, reject) => {
    // Spawn Python process
    const pythonProcess = spawn('python3', [
      PYTHON_SCRIPT,
      '--prompt',
      prompt,
      '--output',
      outputPath,
      '--steps',
      '30',
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      // Stream output for progress visibility
      process.stdout.write(`      ${output}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      const generationTime = Math.round((Date.now() - startTime) / 1000);

      if (code === 0 && existsSync(outputPath)) {
        console.log(`   ✅ SD XL image generated in ${generationTime}s`);
        resolve({ imagePath: outputPath, generationTime });
      } else {
        const error = new Error(`Python process failed with code ${code}: ${stderr || stdout}`);

        // Retry on failure
        if (retryCount < MAX_RETRIES) {
          console.log(
            `   ⚠️  Generation failed, retrying in ${RETRY_DELAY / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`
          );
          setTimeout(() => {
            generateSDImage(prompt, mealName, retryCount + 1)
              .then(resolve)
              .catch(reject);
          }, RETRY_DELAY);
        } else {
          reject(error);
        }
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
  });
}

/**
 * Upload image to Vercel Blob
 */
async function uploadToBlob(imagePath: string, mealName: string): Promise<string> {
  try {
    console.log(`   ☁️  Uploading to Vercel Blob...`);

    const fs = await import('node:fs/promises');
    const buffer = await fs.readFile(imagePath);

    const safeFileName = mealName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .substring(0, 50);
    const filename = `meals/sd-xl/${safeFileName}-${Date.now()}.png`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'image/png',
    });

    console.log(`   ✅ Uploaded to: ${blob.url}`);

    // Clean up temp file
    unlinkSync(imagePath);

    return blob.url;
  } catch (error: any) {
    console.error(`   ❌ Upload failed:`, error?.message || error);
    throw error;
  }
}

/**
 * Process a single meal - generate and upload image
 */
async function processMeal(meal: any): Promise<MealImageResult> {
  const result: MealImageResult = {
    mealId: meal.id,
    mealName: meal.name,
    success: false,
  };

  try {
    console.log(`\n🍽️  Processing Meal: ${meal.name}`);
    console.log(`   Type: ${meal.meal_type || 'N/A'}`);
    console.log(`   Occasion: ${meal.occasion || 'N/A'}`);

    // Check if already has image
    if (meal.image_url) {
      console.log(`   ⏭️  Skipping - already has image`);
      result.skipped = true;
      result.skipReason = 'already has image';
      return result;
    }

    // Step 1: Get courses/recipes for this meal
    console.log(`   📋 Fetching meal courses...`);
    const mealCoursesData = await db
      .select({
        mealRecipe: mealRecipes,
        recipe: recipes,
      })
      .from(mealRecipes)
      .innerJoin(recipes, eq(mealRecipes.recipe_id, recipes.id))
      .where(eq(mealRecipes.meal_id, meal.id));

    if (mealCoursesData.length === 0) {
      console.log(`   ⏭️  Skipping - no recipes in meal`);
      result.skipped = true;
      result.skipReason = 'no recipes';
      return result;
    }

    const courses: CourseInfo[] = mealCoursesData.map((data) => ({
      category: data.mealRecipe.course_category,
      recipeName: data.recipe.name,
      cuisine: data.recipe.cuisine,
    }));

    console.log(`   ✅ Found ${courses.length} course(s):`);
    courses.forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.category}: ${c.recipeName}`);
    });

    // Step 2: Build prompt
    const prompt = buildMealPrompt(meal, courses);

    // Step 3: Generate SD XL image
    const { imagePath, generationTime } = await generateSDImage(prompt, meal.name);
    result.generationTime = generationTime;

    // Step 4: Upload to Blob
    const blobUrl = await uploadToBlob(imagePath, meal.name);

    // Step 5: Update meal record
    if (APPLY_CHANGES) {
      console.log(`   💾 Updating meal in database...`);
      await db
        .update(meals)
        .set({
          image_url: blobUrl,
          updated_at: new Date(),
        })
        .where(eq(meals.id, meal.id));
      console.log(`   ✅ Meal updated successfully!`);
    } else {
      console.log(`   ⚠️  DRY RUN - Would update meal with: ${blobUrl}`);
    }

    result.success = true;
    result.imageUrl = blobUrl;

    // Rate limiting delay
    if (APPLY_CHANGES) {
      console.log(`   ⏳ Waiting ${RATE_LIMIT_DELAY / 1000}s before next meal...`);
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
    }

    return result;
  } catch (error: any) {
    console.error(`   ❌ Failed to process meal:`, error?.message || error);
    result.error = error?.message || String(error);
    return result;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🍽️  Meal Image Generator - Stable Diffusion XL');
  console.log('═'.repeat(80));
  console.log(`Mode: ${APPLY_CHANGES ? 'APPLY CHANGES' : 'DRY RUN'}`);
  console.log(`Limit: ${LIMIT} meals`);
  console.log();

  // Check environment
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('❌ Error: BLOB_READ_WRITE_TOKEN not found in environment');
    process.exit(1);
  }

  // Check Python dependencies
  if (!checkPythonDependencies()) {
    console.error('\n❌ Missing dependencies. Install with:');
    console.error('   pip3 install torch torchvision diffusers pillow transformers accelerate');
    process.exit(1);
  }

  // Check Python script exists
  if (!existsSync(PYTHON_SCRIPT)) {
    console.error(`❌ Python script not found: ${PYTHON_SCRIPT}`);
    console.error('   Please ensure meal_image_generator.py exists in scripts/image-gen/');
    process.exit(1);
  }

  // Ensure temp directory
  ensureTempDir();

  try {
    // Query meals without images
    console.log('🔍 Querying meals without images...');
    const mealsWithoutImages = await db
      .select()
      .from(meals)
      .where(isNull(meals.image_url))
      .limit(LIMIT);

    console.log(`✅ Found ${mealsWithoutImages.length} meal(s) without images\n`);

    if (mealsWithoutImages.length === 0) {
      console.log('✅ All meals already have images! Nothing to do.');
      process.exit(0);
    }

    // Display meals to process
    console.log('📖 Meals to process:');
    mealsWithoutImages.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.name} (${m.meal_type || 'unknown type'})`);
    });

    // Estimate time
    const estimatedMinutes = Math.ceil((mealsWithoutImages.length * 35) / 60); // ~35s per image
    console.log(
      `\n⏰ Estimated time: ~${estimatedMinutes} minute(s) (${mealsWithoutImages.length} × 30-40s/image)`
    );
    console.log(`💰 Cost: FREE (local Stable Diffusion XL)\n`);

    if (!APPLY_CHANGES) {
      console.log('⚠️  DRY RUN MODE - No changes will be saved');
      console.log('   Set APPLY_CHANGES=true to apply changes\n');
    }

    // Process each meal
    const results: MealImageResult[] = [];

    for (let i = 0; i < mealsWithoutImages.length; i++) {
      const meal = mealsWithoutImages[i];
      console.log(`\n[${i + 1}/${mealsWithoutImages.length}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      const result = await processMeal(meal);
      results.push(result);
    }

    // Generate summary report
    console.log(`\n\n${'═'.repeat(80)}`);
    console.log('📊 SUMMARY REPORT');
    console.log('═'.repeat(80));

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success && !r.skipped);
    const skipped = results.filter((r) => r.skipped);

    console.log(`\n✅ Successfully generated: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`⏭️  Skipped: ${skipped.length}`);
    console.log(`📊 Total processed: ${results.length}`);

    if (successful.length > 0) {
      const avgTime =
        successful.reduce((sum, r) => sum + (r.generationTime || 0), 0) / successful.length;
      console.log(`⏱️  Average generation time: ${Math.round(avgTime)}s per image`);

      console.log('\n✅ Successfully generated images:');
      successful.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.mealName} (${r.generationTime}s)`);
        if (APPLY_CHANGES) {
          console.log(`      Image: ${r.imageUrl}`);
        }
      });
    }

    if (skipped.length > 0) {
      console.log('\n⏭️  Skipped meals:');
      skipped.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.mealName} - ${r.skipReason}`);
      });
    }

    if (failed.length > 0) {
      console.log('\n❌ Failed to generate images:');
      failed.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.mealName}`);
        console.log(`      Error: ${r.error}`);
      });
    }

    console.log(`\n💰 Total cost: $0.00 (local generation)`);
    console.log(`\n✅ Script completed!\n`);
  } catch (error: any) {
    console.error('\n❌ Script failed:', error?.message || error);
    throw error;
  }
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
