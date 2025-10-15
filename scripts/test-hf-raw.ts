#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const API_KEY = process.env.HUGGINGFACE_API_KEY;

async function testAPIFormats() {
  console.log('Testing different API formats...\n');

  // Test 1: Object with "inputs" key (current format)
  console.log('Test 1: Object with "inputs" key');
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: 'test text',
        options: { wait_for_model: true }
      }),
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data).substring(0, 150));
    if (Array.isArray(data) && Array.isArray(data[0])) {
      console.log(`✓ Success! Got embedding with ${data[0].length} dimensions\n`);
      return data[0];
    }
  } catch (error: any) {
    console.log(`✗ Failed: ${error.message}`);
  }
  console.log('');

  // Test 2: Plain string
  console.log('Test 2: Plain string (no object wrapper)');
  try {
    const response = await fetch('https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify('test text'),
    });
    const data = await response.json();
    console.log(`Status: ${response.status}`);
    console.log(`Response:`, JSON.stringify(data).substring(0, 150));
    if (Array.isArray(data) && typeof data[0] === 'number') {
      console.log(`✓ Success! Got embedding with ${data.length} dimensions\n`);
      return data;
    }
  } catch (error: any) {
    console.log(`✗ Failed: ${error.message}`);
  }
  console.log('');

  return null;
}

testAPIFormats().then(result => {
  if (result) {
    console.log('SUCCESS! Found working format.');
    console.log(`Embedding dimensions: ${result.length}`);
    console.log(`Sample values: [${result.slice(0, 5).map((v: number) => v.toFixed(4)).join(', ')}, ...]`);
    process.exit(0);
  } else {
    console.log('All formats failed!');
    process.exit(1);
  }
});
