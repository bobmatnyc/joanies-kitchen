#!/usr/bin/env tsx
import * as path from 'node:path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.HUGGINGFACE_API_KEY;

async function testAPIKey() {
  console.log('Testing HuggingFace API Key...\n');
  console.log('API Key present:', !!API_KEY);
  console.log('API Key prefix:', API_KEY?.substring(0, 6) || 'N/A');
  console.log('API Key length:', API_KEY?.length || 0);
  console.log('');

  // Test 1: Try a different model that's more common
  console.log('Test 1: Testing with bert-base-uncased (common model)');
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/bert-base-uncased', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: 'test text' }),
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response type:`, typeof data);
    console.log(`Response sample:`, JSON.stringify(data).substring(0, 200));
    console.log('');
  } catch (error: any) {
    console.log(`✗ Failed: ${error.message}\n`);
  }

  // Test 2: Original model with feature extraction
  console.log('Test 2: sentence-transformers/all-MiniLM-L6-v2 with /pipeline/feature-extraction');
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test text', options: { wait_for_model: true } }),
      }
    );
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    if (response.status === 401 || response.status === 403) {
      console.log('✗ Authentication failed! API key may be invalid or expired.');
    } else if (response.status === 404) {
      console.log('✗ Endpoint not found! The /pipeline/ endpoint may be deprecated.');
    }
    console.log(`Response:`, JSON.stringify(data).substring(0, 200));
    console.log('');
  } catch (error: any) {
    console.log(`✗ Failed: ${error.message}\n`);
  }

  // Test 3: Try direct model endpoint
  console.log('Test 3: sentence-transformers/all-MiniLM-L6-v2 with /models endpoint');
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: 'test text' }),
      }
    );
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data).substring(0, 200));
    if (Array.isArray(data)) {
      console.log(`✓ Got array response with length: ${data.length}`);
    }
    console.log('');
  } catch (error: any) {
    console.log(`✗ Failed: ${error.message}\n`);
  }
}

testAPIKey().then(() => {
  console.log('Tests complete!');
  process.exit(0);
});
