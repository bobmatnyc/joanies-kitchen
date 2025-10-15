#!/bin/bash

# Load API key from .env.local
source .env.local

echo "Testing HuggingFace API..."
echo ""

# Test the API endpoint
curl -X POST "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2" \
  -H "Authorization: Bearer $HUGGINGFACE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"inputs": "test text", "options": {"wait_for_model": true}}' \
  -w "\n\nHTTP Status: %{http_code}\n"
