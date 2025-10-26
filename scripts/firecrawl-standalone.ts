/**
 * Standalone Firecrawl client for use in scripts
 * (Bypasses Next.js server-only restriction)
 */

import FirecrawlApp from '@mendable/firecrawl-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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

export function getFirecrawlClient() {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY environment variable is not set');
  }

  return new FirecrawlApp({ apiKey });
}

export async function scrapeRecipePage(url: string): Promise<ScrapeResponse> {
  const client = getFirecrawlClient();

  try {
    const result = (await client.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 2000,
    })) as any;

    return result;
  } catch (error) {
    console.error(`Error scraping recipe page ${url}:`, error);
    throw new Error(
      `Failed to scrape recipe page: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
