import 'server-only';
import FirecrawlApp from '@mendable/firecrawl-js';

// Type definitions for Firecrawl responses
export interface ScrapeResponse {
  success: boolean;
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    language?: string;
    sourceURL?: string;
    ogImage?: string | string[];
  };
  error?: string;
}

export interface CrawlStatusResponse {
  status: 'scraping' | 'completed' | 'failed';
  total?: number;
  completed?: number;
  data?: any[];
  error?: string;
}

// Initialize Firecrawl client
export function getFirecrawlClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY environment variable is not set');
  }

  return new FirecrawlApp({ apiKey });
}

/**
 * Scrape a single recipe page
 * Returns markdown and HTML content with metadata
 */
export async function scrapeRecipePage(url: string): Promise<ScrapeResponse> {
  const client = getFirecrawlClient();

  try {
    console.log(`[Firecrawl] Scraping ${url} with 120s timeout...`);

    // Firecrawl SDK v4.4.1 uses the new v1 API which returns Document directly
    // It throws errors on failure instead of returning {success: false}
    const result = (await client.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 2000, // Wait 2 seconds for dynamic content
      timeout: 120000, // Increase timeout to 120 seconds (2 minutes)
    })) as any;

    console.log(`[Firecrawl] Success! Result:`, {
      hasMarkdown: !!result.markdown,
      hasHtml: !!result.html,
      markdownLength: result.markdown?.length,
    });

    // The new API doesn't have a 'success' field - it just returns the document
    // Add success: true for backward compatibility with our interface
    return {
      success: true,
      markdown: result.markdown,
      html: result.html,
      metadata: result.metadata,
    };
  } catch (error: any) {
    console.error(`[Firecrawl] ERROR scraping ${url}:`);
    console.error(`[Firecrawl] Error message:`, error?.message);
    console.error(`[Firecrawl] Error name:`, error?.name);
    console.error(`[Firecrawl] Error type:`, error?.constructor?.name);

    // Log specific Firecrawl SDK errors
    if (error.name === 'FirecrawlSdkError') {
      console.error(`[Firecrawl] Firecrawl SDK Error Details:`, {
        message: error.message,
        code: error.code,
      });
    }

    throw new Error(
      `Failed to scrape recipe page: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Crawl a chef's recipe collection
 * Returns array of scraped pages
 */
export async function crawlChefRecipes(params: {
  baseUrl: string;
  limit?: number;
  maxDepth?: number;
  excludePaths?: string[];
  includePaths?: string[];
}): Promise<CrawlStatusResponse> {
  const client = getFirecrawlClient();
  const { baseUrl, limit = 100, maxDepth = 3, excludePaths = [], includePaths = [] } = params;

  try {
    // Start async crawl using v4 API
    const crawlJob = (await client.crawl(baseUrl, {
      limit,
      maxDiscoveryDepth: maxDepth,
      excludePaths,
      includePaths,
      scrapeOptions: {
        formats: ['markdown', 'html'],
        onlyMainContent: true,
        waitFor: 2000,
      } as any,
    })) as any;

    // Wait for crawl to complete
    let crawlStatus = await client.getCrawlStatus(crawlJob.id);

    while (crawlStatus.status === 'scraping') {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
      crawlStatus = await client.getCrawlStatus(crawlJob.id);
    }

    if (crawlStatus.status === 'failed') {
      throw new Error(`Crawl failed: ${(crawlStatus as any).error || 'Unknown error'}`);
    }

    return crawlStatus as any;
  } catch (error) {
    console.error(`Error crawling chef recipes from ${baseUrl}:`, error);
    throw new Error(
      `Failed to crawl chef recipes: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Scrape multiple recipe URLs in batch
 */
export async function batchScrapeRecipes(urls: string[]): Promise<ScrapeResponse[]> {
  const _client = getFirecrawlClient();
  const results: ScrapeResponse[] = [];

  // Process in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchPromises = batch.map((url) => scrapeRecipePage(url));

    try {
      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`Failed to scrape ${batch[index]}:`, result.reason);
        }
      });

      // Wait 1 second between batches
      if (i + batchSize < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Error in batch scraping:`, error);
    }
  }

  return results;
}

/**
 * Check if Firecrawl API is configured and available
 */
export function isFirecrawlConfigured(): boolean {
  return !!process.env.FIRECRAWL_API_KEY;
}
