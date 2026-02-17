import 'server-only';

/**
 * Jina.ai Reader API - Web scraping utility
 * Converts any URL to clean, LLM-friendly markdown content
 */

const JINA_API_KEY = process.env.JINA_API_KEY || 'jina_6b33070a68824d84be23367fe0ea9f56gTEuH4Pr_Phjuq6Da2eL4iMSBPJQ';
const JINA_READER_ENDPOINT = 'https://r.jina.ai';

export interface JinaScrapedContent {
  success: boolean;
  content?: string;
  title?: string;
  description?: string;
  url?: string;
  error?: string;
}

/**
 * Scrape a URL using Jina.ai Reader API
 * Returns clean markdown content suitable for LLM processing
 */
export async function scrapeWithJina(url: string): Promise<JinaScrapedContent> {
  try {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        success: false,
        error: 'Invalid URL format',
      };
    }

    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        success: false,
        error: 'URL must use HTTP or HTTPS protocol',
      };
    }

    // Construct Jina.ai Reader URL
    const jinaUrl = `${JINA_READER_ENDPOINT}/${url}`;

    console.log('[Jina] Scraping URL:', url);

    // Call Jina.ai Reader API
    const response = await fetch(jinaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${JINA_API_KEY}`,
        'Accept': 'application/json',
        'X-Return-Format': 'markdown',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Jina] API error:', response.status, errorText);

      return {
        success: false,
        error: `Jina.ai API error: ${response.status} - ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Jina.ai returns data in this format:
    // { code: 200, status: 20000, data: { content: "...", title: "...", description: "...", url: "..." } }
    if (data.code !== 200 || !data.data?.content) {
      console.error('[Jina] Unexpected response format:', data);
      return {
        success: false,
        error: 'Failed to extract content from Jina.ai response',
      };
    }

    const scrapedContent = data.data.content;
    const title = data.data.title;
    const description = data.data.description;

    console.log('[Jina] Successfully scraped:', {
      url,
      contentLength: scrapedContent.length,
      title,
    });

    return {
      success: true,
      content: scrapedContent,
      title,
      description,
      url,
    };
  } catch (error) {
    console.error('[Jina] Scraping error:', error);

    if (error instanceof Error) {
      // Handle timeout errors specifically
      if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return {
          success: false,
          error: 'Request timed out. The URL may be too slow to respond.',
        };
      }

      return {
        success: false,
        error: `Scraping failed: ${error.message}`,
      };
    }

    return {
      success: false,
      error: 'An unknown error occurred while scraping',
    };
  }
}

/**
 * Validate if a URL is scrapeable (basic checks)
 */
export function isValidScrapeUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTP or HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }

    // Check for common blocked domains
    const blockedDomains = ['localhost', '127.0.0.1', '0.0.0.0'];
    if (blockedDomains.some((domain) => parsed.hostname.includes(domain))) {
      return { valid: false, error: 'Local URLs are not allowed' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}
