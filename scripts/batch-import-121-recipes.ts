#!/usr/bin/env tsx
/**
 * Batch Import 121 Chef Recipes
 *
 * Uses Firecrawl SaaS service for robust web scraping
 * and server actions for recipe extraction and storage.
 */

import * as dotenv from 'dotenv';
import { scrapeRecipePage } from '../src/lib/firecrawl.js';
import { getOpenRouterClient } from '../src/lib/ai/openrouter-server.js';
import { db } from '../src/lib/db/index.js';
import { recipes } from '../src/lib/db/schema.js';
import { generateRecipeEmbedding } from '../src/lib/ai/embeddings.js';
import { saveRecipeEmbedding } from '../src/lib/db/embeddings.js';
import { evaluateRecipeQuality } from '../src/lib/ai/recipe-quality-evaluator.js';

dotenv.config({ path: '.env.local' });

const CHEF_RECIPES = {
  'alton-brown': {
    name: 'Alton Brown',
    chefId: null, // Will be looked up or created
    urls: [
      'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/',
      'https://altonbrown.com/recipes/meatloaf-reloaded/',
      'https://altonbrown.com/recipes/perfect-cocoa-brownies/',
      'https://altonbrown.com/recipes/semi-instant-pancake-mix/',
      'https://altonbrown.com/recipes/scallion-pancakes/',
      'https://www.foodnetwork.com/recipes/alton-brown/the-chewy-recipe-1909046',
      'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-1939524',
      'https://www.foodnetwork.com/recipes/alton-brown/shepherds-pie-recipe2-1942900',
      'https://www.foodnetwork.com/recipes/alton-brown/who-loves-ya-baby-back-recipe-1937448',
      'https://www.foodnetwork.com/recipes/alton-brown/pan-seared-rib-eye-recipe-2131274',
      'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-recipe-1939165',
      'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-reloaded-5518729',
    ],
  },
  'bren-smith': {
    name: 'Bren Smith',
    chefId: null,
    urls: [
      'https://www.greenwave.org/recipes-1/bbq-kelp-carrots',
      'https://www.greenwave.org/recipes-1/tamarind-kelp-noodles',
      'https://www.greenwave.org/recipes-1/zucchini-kelp-cake',
      'https://www.greenwave.org/recipes-1/tahini-salad-fried-kelp',
      'https://www.greenwave.org/recipes-1/kelp-butter-wb8n6',
      'https://www.greenwave.org/recipes-1/kelp-orzo-soup-gxs59',
      'https://www.greenwave.org/recipes-1/kelp-scampi',
      'https://www.greenwave.org/recipes-1/shrimp-kelp-fra-diavolo',
      'https://atlanticseafarms.com/recipes/melissa-clarks-creamy-white-bean-and-seaweed-stew-with-parmesan/',
      'https://atlanticseafarms.com/recipes/melissa-clarks-lemony-pasta-with-kelp-chile-and-anchovies/',
      'https://riverheadnewsreview.timesreview.com/2014/07/56138/how-do-you-eat-kelp-here-are-two-recipes/',
    ],
  },
  'cristina-scarpaleggia': {
    name: 'Cristina Scarpaleggia',
    chefId: null,
    urls: [
      'https://en.julskitchen.com/first-course/soup/best-pappa-al-pomodoro',
      'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-gnudi',
      'https://en.julskitchen.com/tuscany/fried-sage-leaves',
      'https://en.julskitchen.com/appetizer/chicken-liver-crostini',
      'https://en.julskitchen.com/first-course/fresh-pasta/how-to-make-ricotta-ravioli',
      'https://en.julskitchen.com/breakfast/italian-croissants',
      'https://en.julskitchen.com/tuscany/tuscan-schiacciata-with-walnuts',
      'https://en.julskitchen.com/vegetarian/roasted-peppers-appetizer',
      'https://en.julskitchen.com/side/cavolo-nero-salad',
      'https://en.julskitchen.com/dessert/cookies/almond-and-rice-flour-lemon-cookies',
      'https://en.julskitchen.com/dessert/grape-focaccia',
      'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-pesto',
    ],
  },
  'dan-barber': {
    name: 'Dan Barber',
    chefId: null,
    urls: [
      'https://food52.com/recipes/9111-dan-barber-s-braised-short-ribs',
      'https://food52.com/recipes/20792-dan-barber-s-cauliflower-steaks-with-cauliflower-puree',
      'https://www.jamesbeard.org/stories/waste-less-recipe-dan-barbers-root-vegetable-peel-chips',
      'https://www.washingtonpost.com/recipes/dan-barbers-scrambled-eggs/',
      'https://www.today.com/food/stop-wasting-food-money-these-easy-recipes-tips-t116216',
      'https://www.esquire.com/food-drink/food/recipes/a9989/parsnip-steak-recipe-dan-barber-5806809/',
      'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587',
      'https://www.williams-sonoma.com/recipe/kale-salad-with-pine-nuts-currants-and-parmesan.html',
      'https://www.mindful.org/how-to-make-a-carrot-steak-recipe/',
      'https://time.com/2924024/summer-recipes-by-writers/',
      'https://www.tastingtable.com/687150/recipe-vegetable-chips-blue-hill-restaurant-dan-barber/',
    ],
  },
  'david-zilber': {
    name: 'David Zilber',
    chefId: null,
    urls: [
      'https://www.highsnobiety.com/p/david-zilber-interview/',
      'https://www.ethanchlebowski.com/cooking-techniques-recipes/noma-guide-to-lacto-fermented-pickles',
      'https://www.splendidtable.org/story/2018/10/31/lacto-blueberries',
      'https://www.vice.com/en/article/coffee-kombucha-recipe/',
      'https://www.pdxmonthly.com/eat-and-drink/2019/09/make-nomas-umami-bomb-mushrooms-in-your-home-kitchen',
      'https://xtinenyc.com/food/the-moment/with-rene-redzepi/',
    ],
  },
  'ina-garten': {
    name: 'Ina Garten',
    chefId: null,
    urls: [
      'https://barefootcontessa.com/recipes/baked-fontina',
      'https://barefootcontessa.com/recipes/chicken-pot-pie',
      'https://www.foodnetwork.com/recipes/ina-garten/garlic-and-herb-roasted-shrimp-3742576',
      'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592',
      'https://www.foodnetwork.com/recipes/ina-garten/roast-chicken-with-radishes-3742076',
      'https://www.foodnetwork.com/recipes/ina-garten/lemon-parmesan-chicken-with-arugula-salad-topping-5176940',
      'https://www.foodnetwork.com/recipes/ina-garten/rigatoni-with-sausage-and-fennel-3753750',
      'https://www.foodnetwork.com/recipes/ina-garten/orecchiette-with-broccoli-rabe-and-sausage-5176922',
      'https://www.foodnetwork.com/recipes/ina-garten/herbed-orzo-with-feta-3753751',
      'https://www.foodnetwork.com/recipes/ina-garten/annas-tomato-tart-3756210',
      'https://www.foodnetwork.com/recipes/ina-garten/salty-oatmeal-chocolate-chunk-cookies-5468289',
      'https://www.foodnetwork.com/recipes/ina-garten/vanilla-rum-panna-cotta-with-salted-caramel-5190866',
    ],
  },
  'jeremy-fox': {
    name: 'Jeremy Fox',
    chefId: null,
    urls: [
      'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/',
      'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes',
      'https://cookbookreview.blog/2018/08/23/lima-bean-and-sorrel-cacio-e-pepe-by-jeremy-fox/comment-page-1/',
      'https://cookbookreview.blog/2018/08/23/carrot-juice-cavatelli-tops-salsa-and-spiced-pulp-crumble-by-jeremy-fox/',
      'https://cookbookreview.blog/2018/08/23/carta-da-musica-leaves-things-and-truffled-pecorino-by-jeremy-fox/',
      'https://www.7x7.com/chef-jeremy-fox-back-on-top-birdie-g-2653511058/recipe-make-jeremy-fox-s-grilled-asparagus-with-horsey-feta-everything-spice',
      'https://hotpotato.kitchen/on-vegetables',
    ],
  },
  'kirsten-and-christopher-shockey': {
    name: 'Kirsten & Christopher Shockey',
    chefId: null,
    urls: [
      'https://www.thedoctorskitchen.com/recipes/kirsten-shockey-s-be-good-to-your-gut-fennel-chutney',
      'https://www.makesauerkraut.com/fermented-vegetables-book-review/',
      'https://www.motherearthnews.com/real-food/habanero-salsa-zm0z17aszqui/',
      'https://www.motherearthnews.com/real-food/green-chile-recipe-zm0z17aszqui/',
      'https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-kale-tips-and-a-recipe-for-kale-kimchi-zbcz1511/',
      'https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-garlic-paste-zerz1502znut/',
      'https://www.motherearthnews.com/real-food/seasonal-recipes/squash-chutney-recipe-zerz1502znut/',
      'https://www.motherearthnews.com/real-food/cubed-spring-radish-kimchi-zbcz1505/',
      'https://www.motherearthnews.com/real-food/how-to-ferment-sauerkraut-zerz1502znut/',
      'https://www.motherearthnews.com/real-food/fermented-nettle-pesto-zbcz1505/',
      'https://www.motherearthnews.com/real-food/fermenting-garlic-scapes-zbcz1506/',
      'https://www.motherearthnews.com/real-food/fermenting/when-life-hands-you-garlic-mustard-ferment-it-zbcz1604',
      'https://www.amexessentials.com/kirsten-shockey-spicy-carrot-lime-salad-recipe/',
    ],
  },
  'nancy-silverton': {
    name: 'Nancy Silverton',
    chefId: null,
    urls: [
      'https://ooni.com/blogs/recipes/nancy-silvertons-pizza-dough',
      'https://ooni.com/blogs/recipes/nancy-silvertons-fresh-basil-pesto',
      'https://ooni.com/blogs/recipes/nancy-silvertons-passata-di-pomodoro',
      'https://food52.com/recipes/65914-nancy-silverton-s-marinated-olives-and-fresh-pecorino',
      'https://food52.com/recipes/82016-genius-chopped-salad-recipe',
      'https://www.labreabakery.com/recipes/classic-grilled-cheese-marinated-onions-and-whole-grain-mustard',
      'https://food52.com/recipes/75772-nancy-silverton-s-egg-salad-with-bagna-cauda-toast',
      'https://www.saveur.com/butterscotch-budino-pudding-recipe/',
      'https://www.today.com/food/nancy-silverton-cookie-recipe-changed-life-t295295',
      'https://food52.com/recipes/14500-nancy-silverton-s-whipped-cream',
      'https://www.foodgal.com/2017/04/nancy-silvertons-polenta-cake-with-brutti-ma-buoni-topping/',
    ],
  },
  'tamar-adler': {
    name: 'Tamar Adler',
    chefId: null,
    urls: [
      'https://food52.com/blog/4193-an-everlasting-piece-of-pork-belly-tamar-adler',
      'https://food52.com/recipes/75385-stewed-cauliflower-tomatoes-and-chick-peas-with-lemony-uplift-ala-tamar-adler',
      'https://www.npr.org/2023/03/20/1164403171/everlasting-meal-tamar-adler-leftovers-cookbook-nut-butter-noodles',
      'https://www.saveur.com/article/Recipes/Minestrone-1000090697/',
      'https://www.ediblemanhattan.com/recipes/heres-what-writer-tamar-adler-would-serve-at-an-old-school-summer-picnic/',
      'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/',
      'https://www.blackseedbagels.com/recipes-by-tamar/',
    ],
  },
};

interface ExtractedRecipe {
  name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: number;
  images?: string[];
  cuisine?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  confidenceScore: number;
  isValid: boolean;
}

function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d+)/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (timeStr.toLowerCase().includes('hour')) {
    return value * 60;
  }
  return value;
}

async function extractRecipeFromContent(url: string, content: string): Promise<ExtractedRecipe | null> {
  try {
    const openrouter = getOpenRouterClient();
    const limitedContent = content.substring(0, 50000);

    const completion = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: `Extract the recipe from this content. Return ONLY valid JSON with no markdown formatting, code blocks, or extra text.

Recipe Content:
${limitedContent}

Required JSON format:
{
  "name": "Recipe name",
  "description": "Brief description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["step 1", "step 2"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": 4,
  "images": ["image_url_1", "image_url_2"],
  "cuisine": "Italian",
  "tags": ["quick", "healthy"],
  "difficulty": "easy",
  "confidenceScore": 0.95,
  "isValid": true
}

Important:
- Return ONLY the JSON object, no markdown code blocks
- Set isValid to true if you found a complete recipe
- Set isValid to false if the page doesn't contain a recipe
- Include as many images as you can find (max 6)
- confidenceScore should be 0-1 (how confident you are this is a valid recipe)`,
        },
      ],
      temperature: 0.1,
    });

    const responseContent = completion.choices[0].message.content || '{}';
    const cleanContent = responseContent
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const extracted: ExtractedRecipe = JSON.parse(cleanContent);

    if (!extracted.isValid) {
      console.log(`  ⚠️  Invalid recipe extracted from ${url}`);
      return null;
    }

    return extracted;
  } catch (error: any) {
    console.error(`  ❌ Error extracting recipe from ${url}:`, error.message);
    return null;
  }
}

async function storeRecipe(recipe: ExtractedRecipe, metadata: { sourceUrl: string; chefSlug: string }): Promise<string | null> {
  try {
    console.log(`  💾 Storing recipe: ${recipe.name}`);

    // Evaluate recipe quality
    const qualityEval = await evaluateRecipeQuality({
      name: recipe.name,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
    });
    console.log(`  ⭐ Quality rating: ${qualityEval.rating}/5 - ${qualityEval.reasoning}`);

    // Generate embedding
    let embeddingResult: { embedding: number[]; embeddingText: string } | null = null;
    try {
      embeddingResult = await generateRecipeEmbedding({
        id: '',
        user_id: 'system',
        chef_id: null,
        source_id: null,
        name: recipe.name,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        cuisine: recipe.cuisine || null,
        tags: JSON.stringify(recipe.tags || []),
        difficulty: recipe.difficulty || null,
        prep_time: null,
        cook_time: null,
        servings: null,
        image_url: null,
        images: null,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: true,
        nutrition_info: null,
        model_used: null,
        source: null,
        license: 'ALL_RIGHTS_RESERVED',
        created_at: new Date(),
        updated_at: new Date(),
        search_query: null,
        discovery_date: null,
        confidence_score: null,
        validation_model: null,
        embedding_model: null,
        discovery_week: null,
        discovery_year: null,
        published_date: null,
        system_rating: null,
        system_rating_reason: null,
        avg_user_rating: null,
        total_user_ratings: null,
        slug: null,
        is_meal_prep_friendly: false,
        image_flagged_for_regeneration: false,
        image_regeneration_requested_at: null,
        image_regeneration_requested_by: null,
        like_count: 0,
        fork_count: 0,
        collection_count: 0,
        instruction_metadata: null,
        instruction_metadata_version: null,
        instruction_metadata_generated_at: null,
        instruction_metadata_model: null,
        content_flagged_for_cleanup: false,
        ingredients_need_cleanup: false,
        instructions_need_cleanup: false,
        deleted_at: null,
        deleted_by: null,
        weight_score: null,
        richness_score: null,
        acidity_score: null,
        sweetness_level: null,
        dominant_textures: null,
        dominant_flavors: null,
        serving_temperature: null,
        pairing_rationale: null,
        video_url: null,
        resourcefulness_score: null,
        waste_reduction_tags: null,
        scrap_utilization_notes: null,
        environmental_notes: null,
        qa_status: null,
        qa_timestamp: null,
        qa_method: null,
        qa_confidence: null,
        qa_notes: null,
        qa_issues_found: null,
        qa_fixes_applied: null,
      });
    } catch (error: any) {
      console.warn(`  ⚠️  Failed to generate embedding: ${error.message}`);
    }

    // Save to database
    const [savedRecipe] = await db
      .insert(recipes)
      .values({
        user_id: 'system',
        chef_id: null, // TODO: Link to chef when we have chef_id
        name: recipe.name,
        description: recipe.description || '',
        ingredients: JSON.stringify(recipe.ingredients),
        instructions: JSON.stringify(recipe.instructions),
        prep_time: parseTimeToMinutes(recipe.prepTime),
        cook_time: parseTimeToMinutes(recipe.cookTime),
        servings: recipe.servings || null,
        cuisine: recipe.cuisine || null,
        tags: JSON.stringify(recipe.tags || []),
        difficulty: recipe.difficulty || null,
        images: JSON.stringify(recipe.images || []),
        source: metadata.sourceUrl,
        discovery_date: new Date(),
        confidence_score: recipe.confidenceScore.toString(),
        validation_model: 'anthropic/claude-3-haiku',
        embedding_model: embeddingResult ? 'sentence-transformers/all-MiniLM-L6-v2' : null,
        is_ai_generated: false,
        is_public: true,
        is_system_recipe: true,
        system_rating: qualityEval.rating.toFixed(1),
        system_rating_reason: qualityEval.reasoning,
        avg_user_rating: null,
        total_user_ratings: 0,
      })
      .returning();

    // Save embedding
    if (embeddingResult) {
      try {
        await saveRecipeEmbedding(
          savedRecipe.id,
          embeddingResult.embedding,
          embeddingResult.embeddingText,
          'sentence-transformers/all-MiniLM-L6-v2'
        );
      } catch (error: any) {
        console.warn(`  ⚠️  Failed to save embedding: ${error.message}`);
      }
    }

    console.log(`  ✅ Stored recipe with ID: ${savedRecipe.id}`);
    return savedRecipe.id;
  } catch (error: any) {
    console.error(`  ❌ Error storing recipe:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting batch import of 121 chef recipes using Firecrawl');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const totalUrls = Object.values(CHEF_RECIPES).reduce((sum, chef) => sum + chef.urls.length, 0);
  console.log(`📊 Total chefs: ${Object.keys(CHEF_RECIPES).length}`);
  console.log(`📊 Total URLs: ${totalUrls}\n`);

  let count = 0;
  let successCount = 0;
  let failCount = 0;

  for (const [chefSlug, data] of Object.entries(CHEF_RECIPES)) {
    console.log(`\n👨‍🍳 Starting ${data.name} (${data.urls.length} recipes)`);
    console.log('─'.repeat(50));

    for (const url of data.urls) {
      count++;
      console.log(`\n[${count}/${totalUrls}] Processing: ${url}`);

      try {
        // Step 1: Scrape with Firecrawl
        console.log(`  🔍 Scraping with Firecrawl...`);
        const scrapeResult = await scrapeRecipePage(url);

        if (!scrapeResult.success) {
          console.log(`  ❌ Failed to scrape: ${scrapeResult.error}`);
          failCount++;
          continue;
        }

        const content = scrapeResult.markdown || scrapeResult.html || '';
        if (!content) {
          console.log(`  ❌ No content extracted`);
          failCount++;
          continue;
        }

        console.log(`  ✅ Scraped ${content.length} characters`);

        // Step 2: Extract recipe with AI
        console.log(`  🤖 Extracting recipe with AI...`);
        const recipe = await extractRecipeFromContent(url, content);

        if (!recipe) {
          failCount++;
          continue;
        }

        console.log(`  ✅ Extracted: ${recipe.name}`);

        // Step 3: Store in database
        const recipeId = await storeRecipe(recipe, { sourceUrl: url, chefSlug });

        if (recipeId) {
          successCount++;
        } else {
          failCount++;
        }

        // Rate limiting
        console.log(`  ⏳ Waiting 2 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
        failCount++;
      }
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Batch import complete!');
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Total: ${count}`);
  console.log(`📈 Success rate: ${((successCount / count) * 100).toFixed(1)}%`);
}

main().catch(console.error);
