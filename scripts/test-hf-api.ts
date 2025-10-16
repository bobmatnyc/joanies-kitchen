#!/usr/bin/env tsx
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY;
const API_URL = 'https://api-inference.huggingface.co/models/BAAI/bge-small-en-v1.5';

async function testAPI() {
  console.log('Testing HuggingFace API...');
  console.log('API Key:', HF_API_KEY ? `${HF_API_KEY.substring(0, 10)}...` : 'NOT SET');

  if (!HF_API_KEY) {
    console.error('❌ HUGGINGFACE_API_KEY not set');
    process.exit(1);
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: 'Test text for embedding',
      }),
    });

    console.log('Status:', response.status, response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const text = await response.text();
    console.log('Response body (first 500 chars):', text.substring(0, 500));

    if (response.ok) {
      const data = JSON.parse(text);
      console.log('✓ API working! Embedding dimension:', Array.isArray(data[0]) ? data[0].length : data.length);
    } else {
      console.error('❌ API error:', text);
    }
  } catch (error: any) {
    console.error('❌ Request failed:', error.message);
  }
}

testAPI();
