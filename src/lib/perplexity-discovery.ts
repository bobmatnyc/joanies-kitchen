/**
 * Perplexity API Integration for Weekly Recipe Discovery
 *
 * Uses Perplexity's online search model to discover newly published recipes
 * from specific weeks, enabling week-by-week discovery.
 *
 * IMPORTANT: This module contains API keys and MUST ONLY be imported in server-side code.
 * Week utility functions (getWeekInfo, formatWeekInfo) have been moved to @/lib/week-utils
 * to allow safe client-side imports.
 */

import OpenAI from 'openai';
import type { WeekInfo } from '@/lib/week-utils';

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY || '',
  baseURL: 'https://api.perplexity.ai',
});

export interface DiscoveredRecipe {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
  source: string;
}

/**
 * Discovers recipes published in a specific week using Perplexity AI
 *
 * @param weekInfo - Week information (from getWeekInfo)
 * @param options - Discovery options
 * @returns Array of discovered recipes with metadata
 */
export async function discoverWeeklyRecipes(
  weekInfo: WeekInfo,
  options?: {
    cuisine?: string;
    maxResults?: number;
  }
): Promise<{
  success: boolean;
  recipes: DiscoveredRecipe[];
  error?: string;
}> {
  try {
    const cuisineFilter = options?.cuisine ? ` focusing on ${options.cuisine} cuisine` : '';
    const maxResults = options?.maxResults || 10;

    console.log(
      `[Perplexity] Discovering${cuisineFilter} recipes from week ${weekInfo.week}, ${weekInfo.year}`
    );
    console.log(`[Perplexity] Date range: ${weekInfo.startDate} to ${weekInfo.endDate}`);

    // Optimized prompt for better discovery rate
    // Strategy: Flexible date matching + expanded sources + clear task guidance
    const prompt = `You are a recipe discovery assistant. Your goal is to find ${maxResults} NEW recipes published or featured during the week of ${weekInfo.startDate} to ${weekInfo.endDate}${cuisineFilter}.

DISCOVERY TASK - Find recipes that were:
- Published during this specific week (${weekInfo.startDate} to ${weekInfo.endDate})
- Featured or highlighted during this week on recipe websites
- Trending or popular in this time period
- Include recipes with week/month publication metadata (e.g., 'Week of Sept 14', 'Mid-September ${weekInfo.year}')

PRIORITIZE recipes with exact publication dates, but INCLUDE relevant recipes from this timeframe even if the exact date is approximate or unclear.

TRUSTED RECIPE SOURCES (search these sites):
- AllRecipes.com
- Food Network (foodnetwork.com)
- Serious Eats (seriouseats.com)
- Bon Appétit (bonappetit.com)
- Epicurious (epicurious.com)
- NYT Cooking (cooking.nytimes.com)
- Tasty (tasty.co)
- Simply Recipes (simplyrecipes.com)
- King Arthur Baking (kingarthurbaking.com)
- The Kitchn (thekitchn.com)
- Budget Bytes (budgetbytes.com)
- Minimalist Baker (minimalistbaker.com)
- Cookie and Kate (cookieandkate.com)
- Half Baked Harvest (halfbakedharvest.com)
- Pinch of Yum (pinchofyum.com)

WHAT TO LOOK FOR:
- Recipe blog posts with publication dates in this week
- New recipe releases from major food sites
- Seasonal/trending recipes highlighted during this period
- Weekly recipe roundups or features

QUALITY REQUIREMENTS:
1. Must have clear ingredient lists and cooking instructions
2. Direct URLs to recipe pages (NOT category/index pages)
3. Complete recipes (NOT recipe roundups or collections)
4. Prefer established recipe sources
5. Avoid duplicate recipes

For each recipe found, provide:
- Direct URL to the recipe page
- Recipe title
- Brief description or key ingredients
- Publication date if available (or note 'approximate' if unclear)
- Source website name

Return ONLY a JSON array in this EXACT format with NO markdown code blocks:
[
  {
    "title": "Recipe Title Here",
    "url": "https://example.com/full-recipe-url",
    "snippet": "Brief description of the recipe and what makes it special",
    "publishedDate": "YYYY-MM-DD or 'approximate'",
    "source": "Website Name"
  }
]

Return ONLY the JSON array. No markdown, no code blocks, no explanations.`;

    const response = await perplexity.chat.completions.create({
      model: 'sonar',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2, // Lower temperature for more focused results
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content || '[]';

    // Clean up response - remove markdown code blocks if present
    let jsonStr = content.trim();

    // Remove markdown code blocks
    jsonStr = jsonStr.replace(/```json\s*/g, '');
    jsonStr = jsonStr.replace(/```\s*/g, '');

    // Find the JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      console.error('No JSON array found in response:', jsonStr);
      return {
        success: false,
        recipes: [],
        error: 'Invalid response format from Perplexity',
      };
    }

    const recipes = JSON.parse(arrayMatch[0]);

    // Validate and filter results
    const validRecipes = recipes.filter((recipe: any) => {
      return (
        recipe.title &&
        recipe.url &&
        recipe.url.startsWith('http') &&
        recipe.source &&
        recipe.snippet
      );
    });

    console.log(
      `[Perplexity] Found ${validRecipes.length} valid recipes for week ${weekInfo.year}-W${weekInfo.week}`
    );

    return {
      success: true,
      recipes: validRecipes.map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        snippet: r.snippet || '',
        publishedDate: r.publishedDate,
        source: r.source || '',
      })),
    };
  } catch (error: any) {
    console.error('[Perplexity] Discovery failed:', error.message);
    return {
      success: false,
      recipes: [],
      error: error.message,
    };
  }
}
