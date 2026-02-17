#!/usr/bin/env tsx

/**
 * Generate Professional Chef Headshot for Gordon Ramsay
 *
 * This script generates a professional AI headshot for Gordon Ramsay using OpenRouter's
 * Gemini 2.5 Flash Image Preview model and saves it to the chef avatars directory.
 *
 * Features:
 * - Generates square (1:1) aspect ratio professional headshot
 * - Uses AI to create chef portrait in whites
 * - Saves to public/chefs/avatars/gordon-ramsay.jpg
 * - Optimized for web (target: 20-50KB)
 *
 * Usage:
 *   npx tsx scripts/generate-gordon-ramsay-avatar.ts
 *
 * Environment Variables Required:
 *   OPENROUTER_API_KEY - OpenRouter API key
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import OpenAI from 'openai';

// Configuration
const IMAGE_GENERATION_MODEL = 'google/gemini-2.5-flash-image-preview';
const OUTPUT_DIR = 'public/chefs/avatars';
const OUTPUT_FILENAME = 'gordon-ramsay.jpg';
const ASPECT_RATIO = '1:1'; // Square for consistent avatar display
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// OpenRouter client
let openRouterClient: OpenAI | null = null;

function getOpenRouterClient(): OpenAI {
  if (!openRouterClient) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is not set');
    }

    openRouterClient = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002',
        'X-Title': 'Recipe Manager - Chef Avatar Generation',
      },
    });
  }
  return openRouterClient;
}

/**
 * Generate professional chef headshot prompt
 */
function generateChefHeadshotPrompt(chefName: string): string {
  return `Professional chef portrait of ${chefName}, wearing pristine white chef's coat,
facing camera directly with confident and professional expression. Clean neutral background,
studio-quality professional photography, excellent lighting with soft shadows, sharp focus on face,
high-quality headshot suitable for professional culinary website. Square composition, centered subject,
photorealistic style, editorial quality, warm and approachable yet professional demeanor.
Style: corporate headshot photography, professional chef portrait, clean and timeless aesthetic.`;
}

/**
 * Generate an image using OpenRouter API
 */
async function generateImage(prompt: string, attempt: number = 1): Promise<string | null> {
  const client = getOpenRouterClient();

  try {
    console.log(`   🎨 Generating image (attempt ${attempt}/${MAX_RETRIES})...`);

    const response = await client.chat.completions.create({
      model: IMAGE_GENERATION_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      // @ts-expect-error - OpenRouter specific parameters
      modalities: ['image', 'text'],
      image_config: {
        aspect_ratio: ASPECT_RATIO,
      },
      stream: false,
    });

    // Extract image data from response
    const choice = response.choices?.[0];
    if (!choice?.message) {
      throw new Error('No response from image generation API');
    }

    // @ts-expect-error - OpenRouter returns images in a specific format
    const images = choice.message.images;
    if (!images || images.length === 0) {
      throw new Error('No images generated in response');
    }

    // Extract base64 image data
    const imageData = images[0];
    const base64Data = imageData.image_url?.url;

    if (!base64Data) {
      throw new Error('No image URL in response');
    }

    // Remove data URL prefix if present
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');

    return base64Image;
  } catch (error) {
    console.error(`   ❌ Error generating image (attempt ${attempt}):`, error);

    // Retry logic
    if (attempt < MAX_RETRIES) {
      console.log(`   ⏳ Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return generateImage(prompt, attempt + 1);
    }

    return null;
  }
}

/**
 * Save base64 image to file system
 */
function saveImageToFile(base64Data: string, filename: string): string | null {
  try {
    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`   📁 Created directory: ${OUTPUT_DIR}`);
    }

    const filepath = join(OUTPUT_DIR, filename);

    // Convert base64 to buffer and write to file
    const buffer = Buffer.from(base64Data, 'base64');
    writeFileSync(filepath, buffer);

    const fileSizeKB = (buffer.length / 1024).toFixed(2);
    console.log(`   💾 Saved image: ${filepath}`);
    console.log(`   📊 File size: ${fileSizeKB} KB`);

    return filepath;
  } catch (error) {
    console.error(`   ❌ Error saving image:`, error);
    return null;
  }
}

/**
 * Main script execution
 */
async function main() {
  console.log(`\n${'═'.repeat(70)}`);
  console.log('🎨 AI CHEF AVATAR GENERATION - GORDON RAMSAY');
  console.log(`${'═'.repeat(70)}\n`);

  try {
    const chefName = 'Gordon Ramsay';

    console.log(`👨‍🍳 Chef: ${chefName}`);
    console.log(`📁 Output: ${OUTPUT_DIR}/${OUTPUT_FILENAME}`);
    console.log(`📐 Aspect Ratio: ${ASPECT_RATIO} (Square)`);
    console.log(`🤖 Model: ${IMAGE_GENERATION_MODEL}`);
    console.log('─'.repeat(70));

    // Generate image prompt
    const prompt = generateChefHeadshotPrompt(chefName);
    console.log(`\n📝 Prompt:\n   ${prompt.substring(0, 200)}...\n`);

    // Generate image
    console.log('🎨 Generating professional headshot...\n');
    const base64Image = await generateImage(prompt);

    if (!base64Image) {
      console.log(`\n❌ Failed to generate image after ${MAX_RETRIES} attempts`);
      console.log('\n💡 Troubleshooting:');
      console.log('   1. Check OPENROUTER_API_KEY is valid');
      console.log('   2. Verify API quota at: https://openrouter.ai/account');
      console.log('   3. Check model availability: https://openrouter.ai/models');
      console.log('   4. Review API status: https://status.openrouter.ai\n');
      process.exit(1);
    }

    // Save image to file
    console.log('\n💾 Saving image to filesystem...\n');
    const filepath = saveImageToFile(base64Image, OUTPUT_FILENAME);

    if (!filepath) {
      console.log('\n❌ Failed to save image to file');
      process.exit(1);
    }

    // Success summary
    console.log(`\n${'═'.repeat(70)}`);
    console.log('✅ SUCCESS');
    console.log('═'.repeat(70));
    console.log(`🎉 Chef avatar generated successfully!`);
    console.log(`📁 Location: ${filepath}`);
    console.log(`\n💡 Next steps:`);
    console.log(`   1. Verify the image looks professional and meets requirements`);
    console.log(`   2. If satisfied, the image is ready to use`);
    console.log(`   3. If not, run this script again to regenerate`);
    console.log(`   4. Update database if needed using save-chef-avatars.ts`);
    console.log(`${'═'.repeat(70)}\n`);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Verify OPENROUTER_API_KEY is set correctly');
    console.log('   2. Check network connectivity');
    console.log('   3. Verify write permissions for public/chefs/avatars/');
    console.log('   4. Check OpenRouter API status: https://status.openrouter.ai\n');
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('✅ Script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
