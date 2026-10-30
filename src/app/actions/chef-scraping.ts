'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { parseRecipeWithAI } from '@/lib/ai/recipe-parser';
import { recountChefRecipes } from '@/lib/chef-recipe-count';
// #142: duplicate checks and chef links live in a server-internal module.
import {
  linkInsertedRecipe,
  linkSkippedDuplicate,
  skippedDuplicate,
  skippedResult,
} from '@/lib/chef-scraping-links';
import { db } from '@/lib/db';
import { type NewScrapingJob, scrapingJobs } from '@/lib/db/chef-schema';
import { recipes } from '@/lib/db/schema';
import { crawlChefRecipes, scrapeRecipePage } from '@/lib/firecrawl';
import type { DuplicateMatch } from '@/lib/recipes/dedup';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { toRecipeInt } from '@/lib/utils/recipe-int';

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
      error: toErrorMessage(error),
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
    let recipesSkipped = 0;
    const totalPages = crawlResult.data.length;
    const saveProgress = (extra: Partial<NewScrapingJob> = {}) =>
      db
        .update(scrapingJobs)
        .set({
          ...extra,
          recipes_scraped: recipesScraped,
          recipes_failed: recipesFailed,
          // #142: scraping_jobs has no skipped column; the count lives in metadata.
          metadata: sql`coalesce(${scrapingJobs.metadata}, '{}'::jsonb) || jsonb_build_object('recipes_skipped', ${recipesSkipped}::int)`,
          updated_at: new Date(),
        })
        .where(eq(scrapingJobs.id, jobId));
    /** #142: a skipped duplicate; a source-URL match is linked to the chef first. */
    const skip = async (match: DuplicateMatch, url: string) => {
      await linkSkippedDuplicate(params.chefId, match, url);
      recipesSkipped++;
      await saveProgress();
    };

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

        // #135: a page without its own URL is not checked (its source falls back to
        // the crawl's base URL, which every such page shares).
        const urlMatch = page.url ? await skippedDuplicate({ sourceUrl: page.url }) : null;
        if (page.url && urlMatch) {
          await skip(urlMatch, page.url); // #142: link it to the chef, count it as skipped
          continue;
        }

        // Parse recipe with AI
        const parsed = await parseRecipeWithAI({
          markdown: page.markdown,
          html: page.html,
          images: page.metadata?.ogImage ? [page.metadata.ogImage] : undefined,
        });

        const match = page.url
          ? await skippedDuplicate({ sourceUrl: page.url, title: parsed.name })
          : null;
        if (page.url && match) {
          await skip(match, page.url); // #135, #142
          continue;
        }

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
            // #12: coerce to integer-or-null so free text never reaches the integer column.
            prep_time: toRecipeInt(parsed.prepTime),
            cook_time: toRecipeInt(parsed.cookTime),
            servings: toRecipeInt(parsed.servings),
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

        // #142: a failed link deletes the recipe and throws, so the page counts as failed.
        await linkInsertedRecipe(params.chefId, recipe[0].id, page.url || params.sourceUrl);

        recipesScraped++;

        // Update job progress
        await saveProgress();

        // Small delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to parse recipe from ${page.url}:`, error);
        recipesFailed++;

        await saveProgress();
      }
    }

    // Mark job as completed
    await saveProgress({ status: 'completed', completed_at: new Date() });

    // Update chef recipe count
    await recountChefRecipes(params.chefId);

    revalidatePath('/admin/scraping');
  } catch (error) {
    console.error(`Scraping job ${jobId} failed:`, error);

    await db
      .update(scrapingJobs)
      .set({
        status: 'failed',
        error: toErrorMessage(error),
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
    // #135: a URL variant of a stored source is skipped before the paid scrape.
    const urlDuplicate = await skippedDuplicate({ sourceUrl: params.url });
    if (urlDuplicate) return await skippedResult(params.chefId, urlDuplicate, params.url);

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

    const duplicate = await skippedDuplicate({ sourceUrl: params.url, title: parsed.name });
    if (duplicate) return await skippedResult(params.chefId, duplicate, params.url); // #135

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
        // #12: coerce to integer-or-null so free text never reaches the integer column.
        prep_time: toRecipeInt(parsed.prepTime),
        cook_time: toRecipeInt(parsed.cookTime),
        servings: toRecipeInt(parsed.servings),
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

    // #142: a failed link deletes the recipe and throws into the failure answer below.
    await linkInsertedRecipe(params.chefId, recipe[0].id, params.url);

    return { success: true, recipe: recipe[0] };
  } catch (error) {
    console.error('Error scraping single recipe:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Get scraping job status
 */
export async function getScrapingJobStatus(jobId: string) {
  await requireAdmin(); // See #13: scraping jobs are admin data

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
      error: toErrorMessage(error),
    };
  }
}
