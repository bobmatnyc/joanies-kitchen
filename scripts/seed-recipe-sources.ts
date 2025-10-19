#!/usr/bin/env tsx

/**
 * Recipe Sources Seed Script
 *
 * Populates the recipe_sources and recipe_source_types tables with initial data.
 * This script is idempotent - safe to run multiple times.
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { recipeSources, recipeSourceTypes } from '../src/lib/db/schema';

// Load environment variables
config({ path: '.env.local' });

// Database connection
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

// Recipe sources data
interface SourceData {
  name: string;
  slug: string;
  website_url?: string;
  logo_url?: string;
  description?: string;
  is_active: boolean;
  types: {
    name: string;
    description: string;
  }[];
}

const RECIPE_SOURCES: SourceData[] = [
  {
    name: 'Serious Eats',
    slug: 'serious-eats',
    website_url: 'https://www.seriouseats.com',
    description: 'Trusted recipes with deep culinary science. Home of The Food Lab and J. Kenji López-Alt.',
    is_active: true,
    types: [
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from Serious Eats website',
      },
      {
        name: 'Chef Profile',
        description: 'Chef-attributed recipes from Serious Eats contributors',
      },
    ],
  },
  {
    name: 'TheMealDB',
    slug: 'themealdb',
    website_url: 'https://www.themealdb.com',
    description: 'Free open-source recipe database with 500+ curated recipes',
    is_active: true,
    types: [
      {
        name: 'API',
        description: 'Recipes imported via TheMealDB API',
      },
    ],
  },
  {
    name: 'Open Recipe Database',
    slug: 'open-recipe-db',
    website_url: 'https://cosylab.iiitd.edu.in/recipedb/',
    description: 'Academic recipe dataset from IIIT Delhi with 118K+ recipes',
    is_active: true,
    types: [
      {
        name: 'API',
        description: 'Recipes imported from Open Recipe Database',
      },
    ],
  },
  {
    name: 'Epicurious',
    slug: 'epicurious',
    website_url: 'https://www.epicurious.com',
    description: 'Classic recipes from Bon Appétit and Gourmet magazines',
    is_active: true,
    types: [
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from Epicurious website',
      },
    ],
  },
  {
    name: 'User Generated',
    slug: 'user-generated',
    description: 'Recipes created by registered users of the platform',
    is_active: true,
    types: [
      {
        name: 'Manual Entry',
        description: 'Recipes manually entered by users',
      },
      {
        name: 'Recipe Import',
        description: 'Recipes imported by users from external URLs',
      },
    ],
  },
  {
    name: 'AI Generated',
    slug: 'ai-generated',
    description: 'Recipes generated using AI models (OpenRouter, GPT, Claude, etc.)',
    is_active: true,
    types: [
      {
        name: 'OpenRouter API',
        description: 'Recipes generated via OpenRouter API (Gemini, GPT-4, Claude)',
      },
      {
        name: 'Direct LLM',
        description: 'Recipes generated directly from LLM APIs',
      },
    ],
  },
  {
    name: 'Kenji López-Alt',
    slug: 'kenji-lopez-alt',
    website_url: 'https://www.seriouseats.com/kenji-lopez-alt-5118689',
    description: 'Chef, author, and culinary scientist. Creator of The Food Lab.',
    is_active: true,
    types: [
      {
        name: 'Chef Profile',
        description: 'Recipes attributed to J. Kenji López-Alt',
      },
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from Kenji\'s articles and website',
      },
    ],
  },
  {
    name: 'Nancy Silverton',
    slug: 'nancy-silverton',
    website_url: 'https://www.nancysilverton.com',
    description: 'Chef, baker, and restaurateur. Known for artisan bread and Italian cuisine.',
    is_active: true,
    types: [
      {
        name: 'Chef Profile',
        description: 'Recipes attributed to Nancy Silverton',
      },
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from Nancy\'s cookbooks and website',
      },
    ],
  },
  {
    name: 'Lidia Bastianich',
    slug: 'lidia-bastianich',
    website_url: 'https://www.lidiasitaly.com',
    description: 'Italian-American chef, author, and TV host. Expert in authentic Italian cuisine.',
    is_active: true,
    types: [
      {
        name: 'Chef Profile',
        description: 'Recipes attributed to Lidia Bastianich',
      },
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from Lidia\'s website and cookbooks',
      },
    ],
  },
  {
    name: 'AllRecipes',
    slug: 'allrecipes',
    website_url: 'https://www.allrecipes.com',
    description: 'Community-driven recipe platform with millions of user-submitted recipes',
    is_active: true,
    types: [
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from AllRecipes website',
      },
      {
        name: 'API',
        description: 'Recipes imported via AllRecipes API (if available)',
      },
    ],
  },
  {
    name: 'Food Network',
    slug: 'food-network',
    website_url: 'https://www.foodnetwork.com',
    description: 'Recipes from celebrity chefs and Food Network shows',
    is_active: true,
    types: [
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from Food Network website',
      },
      {
        name: 'Chef Profile',
        description: 'Chef-attributed recipes from Food Network personalities',
      },
    ],
  },
  {
    name: 'Bon Appétit',
    slug: 'bon-appetit',
    website_url: 'https://www.bonappetit.com',
    description: 'Modern recipes and cooking techniques from Bon Appétit Test Kitchen',
    is_active: true,
    types: [
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from Bon Appétit website',
      },
      {
        name: 'Chef Profile',
        description: 'Recipes from Bon Appétit Test Kitchen chefs',
      },
    ],
  },
  {
    name: 'NYT Cooking',
    slug: 'nyt-cooking',
    website_url: 'https://cooking.nytimes.com',
    description: 'Trusted recipes from New York Times Cooking',
    is_active: true,
    types: [
      {
        name: 'Web Scrape',
        description: 'Recipes scraped from NYT Cooking (requires subscription)',
      },
      {
        name: 'API',
        description: 'Recipes imported via NYT Cooking API (if available)',
      },
    ],
  },
];

/**
 * Seed recipe sources and source types
 */
async function seedRecipeSources() {
  console.log('🌱 Seeding recipe sources...\n');

  let sourcesCreated = 0;
  let sourcesUpdated = 0;
  let typesCreated = 0;

  for (const sourceData of RECIPE_SOURCES) {
    console.log(`Processing source: ${sourceData.name}`);

    try {
      // Check if source already exists
      const existingSource = await db
        .select()
        .from(recipeSources)
        .where(eq(recipeSources.slug, sourceData.slug))
        .limit(1);

      let sourceId: string;

      if (existingSource.length === 0) {
        // Create new source
        const [newSource] = await db
          .insert(recipeSources)
          .values({
            name: sourceData.name,
            slug: sourceData.slug,
            website_url: sourceData.website_url,
            logo_url: sourceData.logo_url,
            description: sourceData.description,
            is_active: sourceData.is_active,
          })
          .returning();

        sourceId = newSource.id;
        sourcesCreated++;
        console.log(`  ✅ Created source: ${sourceData.name}`);
      } else {
        // Update existing source
        const [updatedSource] = await db
          .update(recipeSources)
          .set({
            name: sourceData.name,
            website_url: sourceData.website_url,
            logo_url: sourceData.logo_url,
            description: sourceData.description,
            is_active: sourceData.is_active,
            updated_at: new Date(),
          })
          .where(eq(recipeSources.slug, sourceData.slug))
          .returning();

        sourceId = updatedSource.id;
        sourcesUpdated++;
        console.log(`  ♻️  Updated source: ${sourceData.name}`);
      }

      // Add source types
      for (const typeData of sourceData.types) {
        // Check if type already exists
        const existingType = await db
          .select()
          .from(recipeSourceTypes)
          .where(eq(recipeSourceTypes.source_id, sourceId))
          .limit(1);

        if (existingType.length === 0) {
          await db.insert(recipeSourceTypes).values({
            source_id: sourceId,
            name: typeData.name,
            description: typeData.description,
          });

          typesCreated++;
          console.log(`    ➕ Added type: ${typeData.name}`);
        } else {
          console.log(`    ⏭️  Type already exists: ${typeData.name}`);
        }
      }

      console.log(''); // Blank line for readability
    } catch (error) {
      console.error(`  ❌ Error processing source ${sourceData.name}:`, error);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Sources created: ${sourcesCreated}`);
  console.log(`  Sources updated: ${sourcesUpdated}`);
  console.log(`  Source types created: ${typesCreated}`);
  console.log(`  Total sources: ${RECIPE_SOURCES.length}`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Recipe Sources Seeder\n');
  console.log('=' .repeat(50));
  console.log('');

  try {
    await seedRecipeSources();

    console.log('\n✅ Seeding completed successfully!');
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
