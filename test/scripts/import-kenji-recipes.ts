import { resolve } from 'node:path';
import FirecrawlApp from '@mendable/firecrawl-js';
import { config } from 'dotenv';
import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const KENJI_CHEF_ID = '07c02066-6cef-46f5-94d5-84ec0ac2141b';

// Start with 5 popular Kenji recipes
const RECIPE_URLS = [
  'https://www.seriouseats.com/the-food-lab-best-baked-potato',
  'https://www.seriouseats.com/dry-aged-ribeye-steak-recipe',
  'https://www.seriouseats.com/perfect-pan-seared-steak-recipe',
  'https://www.seriouseats.com/easy-pressure-cooker-pork-chile-verde-recipe',
  'https://www.seriouseats.com/basic-sous-vide-chicken-breast-recipe',
];

// OpenRouter configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL = 'anthropic/claude-sonnet-4.5';

interface ParsedRecipe {
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  cuisine?: string;
  tags?: string[];
  imageUrl?: string;
  nutritionInfo?: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
  };
}

async function scrapeRecipePage(url: string, firecrawl: FirecrawlApp) {
  try {
    const result = (await firecrawl.scrape(url, {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      waitFor: 2000,
    })) as any;

    return result;
  } catch (error) {
    throw new Error(
      `Failed to scrape: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function parseRecipeWithAI(content: {
  text?: string;
  markdown?: string;
  html?: string;
  images?: string[];
}): Promise<ParsedRecipe> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const textContent = content.text || content.markdown || content.html || '';

  if (!textContent && (!content.images || content.images.length === 0)) {
    throw new Error('No content provided to parse');
  }

  const prompt = `Parse this recipe content and extract structured data in valid JSON format.

Recipe Content:
${textContent}

${content.images && content.images.length > 0 ? `Image URLs: ${content.images.join(', ')}` : ''}

Return a JSON object with this exact structure:
{
  "name": "recipe title",
  "description": "brief description (1-2 sentences)",
  "ingredients": ["ingredient with amount", "another ingredient", ...],
  "instructions": ["step 1", "step 2", ...],
  "prepTime": minutes (number or null),
  "cookTime": minutes (number or null),
  "servings": number (or null),
  "difficulty": "easy" | "medium" | "hard" (or null),
  "cuisine": "cuisine type" (or null),
  "tags": ["tag1", "tag2"] (or empty array),
  "imageUrl": "main image URL if available" (or null),
  "nutritionInfo": {
    "calories": number (or null),
    "protein": number in grams (or null),
    "carbohydrates": number in grams (or null),
    "fat": number in grams (or null),
    "fiber": number in grams (or null)
  }
}

IMPORTANT:
- Be thorough and accurate
- Extract ALL ingredients with specific amounts and units
- Number each instruction step clearly
- If information is missing, use null (not empty strings)
- Ensure valid JSON format
- Estimate difficulty based on techniques and time if not specified
- Extract nutrition info if available, otherwise leave as null`;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3003',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content_text = data.choices[0].message.content;

    if (!content_text) {
      throw new Error('No response from AI model');
    }

    const parsed = JSON.parse(content_text) as ParsedRecipe;

    // Validate required fields
    if (!parsed.name || !parsed.ingredients || !parsed.instructions) {
      throw new Error('Missing required fields in parsed recipe');
    }

    if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
      throw new Error('Invalid ingredients format');
    }

    if (!Array.isArray(parsed.instructions) || parsed.instructions.length === 0) {
      throw new Error('Invalid instructions format');
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing recipe with AI:', error);
    throw new Error(
      `Failed to parse recipe: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

async function importKenjiRecipes() {
  console.log(`\n🧑‍🍳 Importing ${RECIPE_URLS.length} Kenji López-Alt recipes...\n`);

  // Verify environment variables
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error('FIRECRAWL_API_KEY is not set in .env.local');
  }
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in .env.local');
  }

  // Initialize Firecrawl
  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });

  let success = 0;
  let failed = 0;

  for (let i = 0; i < RECIPE_URLS.length; i++) {
    const url = RECIPE_URLS[i];
    console.log(`[${i + 1}/${RECIPE_URLS.length}] Scraping: ${url}`);

    try {
      // Scrape the page
      console.log('  → Fetching page content...');
      const scraped = await scrapeRecipePage(url, firecrawl);

      if (!scraped.markdown && !scraped.html) {
        throw new Error('Failed to scrape recipe content');
      }

      // Parse with AI
      console.log('  → Parsing with AI...');
      const parsed = await parseRecipeWithAI({
        markdown: scraped.markdown,
        html: scraped.html,
        images: scraped.metadata?.ogImage
          ? Array.isArray(scraped.metadata.ogImage)
            ? scraped.metadata.ogImage
            : [scraped.metadata.ogImage]
          : undefined,
      });

      // Create recipe in database
      console.log('  → Saving to database...');
      const _recipe = await db
        .insert(recipes)
        .values({
          user_id: 'system',
          chef_id: KENJI_CHEF_ID,
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
          model_used: MODEL,
          source: url,
        })
        .returning();

      console.log(`  ✓ Success: ${parsed.name}`);
      success++;

      // Rate limiting: 2 seconds between requests
      if (i < RECIPE_URLS.length - 1) {
        console.log(`  ⏳ Waiting 2 seconds...\n`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`  ✗ Error: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }

  console.log(`\n✨ Import complete!`);
  console.log(`  ✓ Success: ${success}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`\n📍 View recipes at: http://localhost:3003/chef/kenji-lopez-alt\n`);
}

importKenjiRecipes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
