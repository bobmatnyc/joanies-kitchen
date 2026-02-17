'use server';

import { auth } from '@/lib/auth';
import { scrapeWithJina, type JinaScrapedContent } from '@/lib/ai/jina-scraper';
import { parseTextWithLLM, type RecipeDetectionResult } from '@/lib/ai/recipe-text-parser';
import { type IngestedRecipe } from '@/lib/ai/recipe-ingestion-parser';
import { toErrorMessage } from '@/lib/utils/error-handling';

/**
 * Scrape a URL using Jina.ai Reader API
 * Admin-only endpoint for system recipe ingestion
 */
export async function scrapeRecipeUrl(url: string): Promise<{
  success: boolean;
  data?: JinaScrapedContent;
  error?: string;
}> {
  try {
    // Check admin permissions
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return { success: false, error: 'Admin access required' };
    }

    // Validate URL
    if (!url || url.trim().length === 0) {
      return { success: false, error: 'URL is required' };
    }

    // Scrape with Jina.ai
    const scrapedContent = await scrapeWithJina(url);

    if (!scrapedContent.success) {
      return {
        success: false,
        error: scrapedContent.error || 'Failed to scrape URL',
      };
    }

    return {
      success: true,
      data: scrapedContent,
    };
  } catch (error) {
    console.error('Error scraping recipe URL:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Parse text content with recipe detection
 * Admin-only endpoint for system recipe ingestion
 */
export async function parseRecipeText(text: string): Promise<{
  success: boolean;
  data?: RecipeDetectionResult;
  error?: string;
}> {
  try {
    // Check admin permissions
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return { success: false, error: 'Admin access required' };
    }

    // Validate text
    if (!text || text.trim().length === 0) {
      return { success: false, error: 'Text is required' };
    }

    // Parse with LLM
    const detectionResult = await parseTextWithLLM(text);

    return {
      success: true,
      data: detectionResult,
    };
  } catch (error) {
    console.error('Error parsing recipe text:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}

/**
 * Combined ingestion workflow for system recipes
 * Handles both URL and text input
 */
export async function ingestSystemRecipe(
  input: string,
  type: 'url' | 'text'
): Promise<{
  success: boolean;
  data?: {
    recipe: IngestedRecipe;
    sourceUrl?: string;
    metadata?: {
      title?: string;
      description?: string;
      confidence?: number;
    };
  };
  error?: string;
}> {
  try {
    // Check admin permissions
    const { sessionClaims } = await auth();
    const metadata = sessionClaims?.metadata as { isAdmin?: string } | undefined;
    if (metadata?.isAdmin !== 'true') {
      return { success: false, error: 'Admin access required' };
    }

    if (type === 'url') {
      // URL ingestion workflow
      // Step 1: Scrape URL with Jina.ai
      const scrapeResult = await scrapeRecipeUrl(input);

      if (!scrapeResult.success || !scrapeResult.data?.content) {
        return {
          success: false,
          error: scrapeResult.error || 'Failed to scrape URL',
        };
      }

      // Step 2: Parse scraped content with LLM
      const parseResult = await parseRecipeText(scrapeResult.data.content);

      if (!parseResult.success || !parseResult.data) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse scraped content',
        };
      }

      // Check if recipe was detected
      if (!parseResult.data.isRecipe || !parseResult.data.recipe) {
        return {
          success: false,
          error: parseResult.data.error || 'No recipe found in the scraped content',
        };
      }

      return {
        success: true,
        data: {
          recipe: parseResult.data.recipe,
          sourceUrl: input,
          metadata: {
            title: scrapeResult.data.title,
            description: scrapeResult.data.description,
            confidence: parseResult.data.confidence,
          },
        },
      };
    } else {
      // Text ingestion workflow
      // Parse text directly with LLM
      const parseResult = await parseRecipeText(input);

      if (!parseResult.success || !parseResult.data) {
        return {
          success: false,
          error: parseResult.error || 'Failed to parse text',
        };
      }

      // Check if recipe was detected
      if (!parseResult.data.isRecipe || !parseResult.data.recipe) {
        return {
          success: false,
          error: parseResult.data.error || 'No recipe found in the provided text',
        };
      }

      return {
        success: true,
        data: {
          recipe: parseResult.data.recipe,
          metadata: {
            confidence: parseResult.data.confidence,
          },
        },
      };
    }
  } catch (error) {
    console.error('Error in system recipe ingestion workflow:', error);
    return {
      success: false,
      error: toErrorMessage(error),
    };
  }
}
