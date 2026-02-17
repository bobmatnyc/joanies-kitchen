#!/bin/bash
cd /Users/masa/Projects/recipe-manager
source .env.local

echo "Testing HuggingFace API with array format..."
curl -s -X POST "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2" \
  -H "Authorization: Bearer $HUGGINGFACE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '["test text for embedding"]' > /tmp/hf-response.json

echo "Response saved to /tmp/hf-response.json"
cat /tmp/hf-response.json | python3 -m json.tool | head -20
