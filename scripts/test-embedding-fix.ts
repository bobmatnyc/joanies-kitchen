#!/usr/bin/env tsx
/**
 * Test script to verify embedding generation fix
 * Tests the improved retry logic and error handling
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { generateEmbedding } from '../src/lib/ai/embeddings';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('='.repeat(60));
  console.log('Testing HuggingFace Embedding Generation Fix');
  console.log('='.repeat(60));
  console.log('');

  // Check API key
  if (!process.env.HUGGINGFACE_API_KEY) {
    console.error('ERROR: HUGGINGFACE_API_KEY not found in environment');
    console.error('Please set it in .env.local');
    process.exit(1);
  }

  console.log('API Key: ✓ Found');
  console.log('');

  // Test 1: Simple embedding generation
  console.log('Test 1: Generate embedding for simple text');
  console.log('----------------------------------------');

  const testText = "Delicious Italian pasta carbonara with eggs, cheese, and pancetta";
  console.log(`Text: "${testText}"`);
  console.log('');

  try {
    const startTime = Date.now();
    console.log('Calling HuggingFace API...');

    const embedding = await generateEmbedding(testText);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('✓ SUCCESS!');
    console.log(`  Duration: ${duration}s`);
    console.log(`  Embedding dimension: ${embedding.length}`);
    console.log(`  Sample values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`);
    console.log('');

    // Verify embedding
    if (embedding.length !== 384) {
      throw new Error(`Wrong dimension: expected 384, got ${embedding.length}`);
    }
    if (embedding.some(v => typeof v !== 'number' || isNaN(v))) {
      throw new Error('Embedding contains invalid values');
    }

    console.log('✓ Validation passed');
    console.log('');
    console.log('='.repeat(60));
    console.log('All tests PASSED! Embedding generation is working correctly.');
    console.log('='.repeat(60));

    process.exit(0);

  } catch (error: any) {
    console.log('');
    console.error('✗ FAILED!');
    console.error(`  Error: ${error.message}`);

    if (error.details) {
      console.error(`  Details:`, JSON.stringify(error.details, null, 2));
    }

    if (error.code) {
      console.error(`  Error code: ${error.code}`);
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Test FAILED! Check the error above.');
    console.log('='.repeat(60));

    process.exit(1);
  }
}

main();
