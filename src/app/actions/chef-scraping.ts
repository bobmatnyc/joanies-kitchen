'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { parseRecipeWithAI } from '@/lib/ai/recipe-parser';
import { db } from '@/lib/db';
import { scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { crawlChefRecipes, scrapeRecipePage } from '@/lib/firecrawl';
import { linkRecipeToChef, updateChefRecipeCount } from './chefs';

/**
 * Start a scraping job for a chef's recipes
 * Admin only - runs in background
 */
export async function startChefScraping(params: {
  chefId: string;
  sourceUrl: string;
  limit?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
}) {
  await requireAdmin();

  try {
    // Create scraping job
    const job = await db
      .insert(scrapingJobs)
      .values({
        chef_id: params.chefId,
        source_url: params.sourceUrl,
        status: 'pending',
        total_pages: params.limit || 100,
      })
      .returning();

    const jobId = job[0].id;

    // Start scraping in background (don't await)
    // Note: In production, this should be moved to a queue system like BullMQ or Inngest
    scrapeAndParseRecipes(jobId, params).catch((error) => {
      console.error(`Background scraping job ${jobId} failed:`, error);
    });

    revalidatePath('/admin/scraping');

    return { success: true, job: job[0] };
  } catch (error) {
    console.error('Error starting scraping job:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start scraping',
    };
  }
}

/**
 * Background task: Scrape and parse recipes
 * This is a long-running operation that should ideally run in a separate worker
 */
async function scrapeAndParseRecipes(
  jobId: string,
  params: {
    chefId: string;
    sourceUrl: string;
    limit?: number;
    maxDepth?: number;
    includePaths?: string[];
    excludePaths?: string[];
  }
) {
  try {
    // Update job status to running
    await db
      .update(scrapingJobs)
      .set({
        status: 'running',
        started_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(scrapingJobs.id, jobId));

    // Crawl with Firecrawl
    const crawlResult = await crawlChefRecipes({
      baseUrl: params.sourceUrl,
      limit: params.limit,
      maxDepth: params.maxDepth,
      includePaths: params.includePaths,
      excludePaths: params.excludePaths,
    });

    if (!crawlResult.data || crawlResult.data.length === 0) {
      throw new Error('No pages were crawled');
    }

    let recipesScraped = 0;
    let recipesFailed = 0;
    const totalPages = crawlResult.data.length;

    // Update total pages
    await db
      .update(scrapingJobs)
      .set({ total_pages: totalPages, updated_at: new Date() })
      .where(eq(scrapingJobs.id, jobId));

    // Process each page
    for (let i = 0; i < crawlResult.data.length; i++) {
      const page = crawlResult.data[i];

      try {
        // Update current page
        await db
          .update(scrapingJobs)
          .set({ current_page: i + 1, updated_at: new Date() })
          .where(eq(scrapingJobs.id, jobId));

        // Parse recipe with AI
        const parsed = await parseRecipeWithAI({
          markdown: page.markdown,
          html: page.html,
          images: page.metadata?.ogImage ? [page.metadata.ogImage] : undefined,
        });

        // Create recipe in database
        const recipe = await db
          .insert(recipes)
          .values({
            user_id: 'system', // System user for scraped recipes
            chef_id: params.chefId,
            name: parsed.name,
            description: parsed.description || '',
            ingredients: JSON.stringify(parsed.ingredients),
            instructions: JSON.stringify(parsed.instructions),
            prep_time: parsed.prepTime || null,
            cook_time: parsed.cookTime || null,
            servings: parsed.servings || null,
            difficulty: parsed.difficulty || null,
            cuisine: parsed.cuisine || null,
            tags: parsed.tags ? JSON.stringify(parsed.tags) : null,
            images: parsed.imageUrl ? JSON.stringify([parsed.imageUrl]) : null,
            image_url: parsed.imageUrl || null,
            nutrition_info: parsed.nutritionInfo ? JSON.stringify(parsed.nutritionInfo) : null,
            is_system_recipe: true,
            is_public: true,
            is_ai_generated: true,
            model_used: 'anthropic/claude-sonnet-4.5',
            source: page.url || params.sourceUrl,
          })
          .returning();

        // Link recipe to chef
        await linkRecipeToChef({
          chefId: params.chefId,
          recipeId: recipe[0].id,
          originalUrl: page.url || params.sourceUrl,
        });

        recipesScraped++;

        // Update job progress
        await db
          .update(scrapingJobs)
          .set({
            recipes_scraped: recipesScraped,
            recipes_failed: recipesFailed,
            updated_at: new Date(),
          })
          .where(eq(scrapingJobs.id, jobId));

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to parse recipe from ${page.url}:`, error);
        recipesFailed++;

        await db
          .update(scrapingJobs)
          .set({
            recipes_scraped: recipesScraped,
            recipes_failed: recipesFailed,
            updated_at: new Date(),
          })
          .where(eq(scrapingJobs.id, jobId));
      }
    }

    // Mark job as completed
    await db
      .update(scrapingJobs)
      .set({
        status: 'completed',
        completed_at: new Date(),
        recipes_scraped: recipesScraped,
        recipes_failed: recipesFailed,
        updated_at: new Date(),
      })
      .where(eq(scrapingJobs.id, jobId));

    // Update chef recipe count
    await updateChefRecipeCount(params.chefId);

    revalidatePath('/admin/scraping');
  } catch (error) {
    console.error(`Scraping job ${jobId} failed:`, error);

    await db
      .update(scrapingJobs)
      .set({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(scrapingJobs.id, jobId));

    revalidatePath('/admin/scraping');
  }
}

/**
 * Scrape a single recipe URL
 * Admin only
 */
export async function scrapeSingleRecipe(params: { chefId: string; url: string }) {
  await requireAdmin();

  try {
    // Scrape the page
    const scraped = await scrapeRecipePage(params.url);

    if (!scraped.markdown && !scraped.html) {
      throw new Error('Failed to scrape recipe content');
    }

    // Parse with AI
    const parsed = await parseRecipeWithAI({
      markdown: scraped.markdown,
      html: scraped.html,
      images: scraped.metadata?.ogImage
        ? Array.isArray(scraped.metadata.ogImage)
          ? scraped.metadata.ogImage
          : [scraped.metadata.ogImage]
        : undefined,
    });

    // Create recipe
    const recipe = await db
      .insert(recipes)
      .values({
        user_id: 'system',
        chef_id: params.chefId,
        name: parsed.name,
        description: parsed.description || '',
        ingredients: JSON.stringify(parsed.ingredients),
        instructions: JSON.stringify(parsed.instructions),
        prep_time: parsed.prepTime || null,
        cook_time: parsed.cookTime || null,
        servings: parsed.servings || null,
        difficulty: parsed.difficulty || null,
        cuisine: parsed.cuisine || null,
        tags: parsed.tags ? JSON.stringify(parsed.tags) : null,
        images: parsed.imageUrl ? JSON.stringify([parsed.imageUrl]) : null,
        image_url: parsed.imageUrl || null,
        nutrition_info: parsed.nutritionInfo ? JSON.stringify(parsed.nutritionInfo) : null,
        is_system_recipe: true,
        is_public: true,
        is_ai_generated: true,
        model_used: 'anthropic/claude-sonnet-4.5',
        source: params.url,
      })
      .returning();

    // Link to chef
    await linkRecipeToChef({
      chefId: params.chefId,
      recipeId: recipe[0].id,
      originalUrl: params.url,
    });

    return { success: true, recipe: recipe[0] };
  } catch (error) {
    console.error('Error scraping single recipe:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape recipe',
    };
  }
}

/**
 * Get scraping job status
 */
export async function getScrapingJobStatus(jobId: string) {
  try {
    const job = await db.query.scrapingJobs.findFirst({
      where: eq(scrapingJobs.id, jobId),
    });

    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    return { success: true, job };
  } catch (error) {
    console.error('Error getting scraping job status:', error);
    return { success: false, error: 'Failed to get job status' };
  }
}

/**
 * Get all scraping jobs (admin only)
 */
export async function getAllScrapingJobs() {
  await requireAdmin();

  try {
    const jobs = await db.query.scrapingJobs.findMany({
      orderBy: (scrapingJobs, { desc }) => [desc(scrapingJobs.created_at)],
      limit: 50,
    });

    return { success: true, jobs };
  } catch (error) {
    console.error('Error getting scraping jobs:', error);
    return { success: false, error: 'Failed to get jobs', jobs: [] };
  }
}

/**
 * Cancel a scraping job
 * Admin only
 */
export async function cancelScrapingJob(jobId: string) {
  await requireAdmin();

  try {
    const job = await db
      .update(scrapingJobs)
      .set({
        status: 'cancelled',
        completed_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(scrapingJobs.id, jobId))
      .returning();

    if (!job[0]) {
      return { success: false, error: 'Job not found' };
    }

    revalidatePath('/admin/scraping');

    return { success: true, job: job[0] };
  } catch (error) {
    console.error('Error cancelling scraping job:', error);
    return { success: false, error: 'Failed to cancel job' };
  }
}

/**
 * Scrape chef recipes by slug (wrapper for UI)
 * Admin only
 */
export async function scrapeChefRecipes(params: {
  chefSlug: string;
  sourceUrl: string;
  limit?: number;
}) {
  await requireAdmin();

  try {
    // Get chef by slug
    const { getChefBySlug } = await import('./chefs');
    const chefResult = await getChefBySlug(params.chefSlug);

    if (!chefResult.success || !chefResult.chef) {
      return { success: false, error: 'Chef not found' };
    }

    // Start scraping with chef ID
    const result = await startChefScraping({
      chefId: chefResult.chef.id,
      sourceUrl: params.sourceUrl,
      limit: params.limit || 10,
    });

    if (!result.success) {
      return result;
    }

    // Return with simplified response
    return {
      success: true,
      recipesScraped: 0, // Will be updated by background job
      job: result.job,
    };
  } catch (error) {
    console.error('Error scraping chef recipes:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape recipes',
    };
  }
}
