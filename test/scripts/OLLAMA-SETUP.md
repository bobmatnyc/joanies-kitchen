# Ollama Local AI Setup for Recipe Extraction

This project now uses **Ollama** for local AI-powered recipe extraction instead of cloud APIs (OpenRouter/Claude). This means:

- **Zero API costs** - runs completely locally
- **No API keys needed** for AI extraction
- **Full privacy** - recipe data never leaves your machine
- **Fast extraction** - local inference with optimized models

## Quick Start

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download
```

### 2. Start Ollama Server

```bash
ollama serve
```

Keep this running in a terminal window.

### 3. Pull Recommended Model

```bash
# Default model (recommended) - Fast and reliable
ollama pull mistral:latest

# Alternative models (optional)
ollama pull mistral-small3.2:latest  # Better quality, slower
ollama pull qwen2.5:72b              # Best quality, very slow
```

### 4. Run Recipe Scraping

```bash
# Test with mock data
pnpm tsx scripts/test-ollama-simple.ts

# Test with single URL (requires Firecrawl)
pnpm tsx scripts/test-ollama-extraction.ts

# Run full scraping (dry run)
pnpm tsx scripts/scrape-curated-chef-recipes.ts

# Apply changes to database
APPLY_CHANGES=true pnpm tsx scripts/scrape-curated-chef-recipes.ts
```

## Model Comparison

### mistral:latest (Default)
- **Size**: 4.4 GB
- **Speed**: ~8-10 seconds per recipe
- **Quality**: Very good for recipe extraction
- **Recommended**: Best balance of speed/quality

### mistral-small3.2:latest
- **Size**: 15 GB
- **Speed**: ~15-20 seconds per recipe
- **Quality**: Better reasoning and accuracy
- **Recommended**: For higher quality needs

### qwen2.5:72b
- **Size**: 47 GB
- **Speed**: ~60+ seconds per recipe
- **Quality**: Best reasoning and structured data extraction
- **Recommended**: Only if you need maximum quality and have powerful hardware

## Using a Different Model

Set the `OLLAMA_MODEL` environment variable:

```bash
# Use mistral-small for better quality
OLLAMA_MODEL=mistral-small3.2:latest pnpm tsx scripts/scrape-curated-chef-recipes.ts

# Use qwen2.5 for best quality (slow)
OLLAMA_MODEL=qwen2.5:72b pnpm tsx scripts/scrape-curated-chef-recipes.ts
```

## Troubleshooting

### Ollama server not running

**Error**: `Ollama server not available at http://localhost:11434`

**Solution**:
```bash
ollama serve
```

### Model not found

**Error**: `model 'mistral:latest' not found`

**Solution**:
```bash
ollama pull mistral:latest
```

### Slow extraction times

If extraction is taking too long:

1. **Check model size** - smaller models are faster
2. **Use faster model**: `OLLAMA_MODEL=mistral:latest`
3. **Check system resources** - close other apps
4. **Reduce batch size** - process fewer recipes at once

### Out of memory

If Ollama crashes or your system freezes:

1. **Use smaller model**: `mistral:latest` instead of `qwen2.5:72b`
2. **Close other applications**
3. **Check available RAM**: Large models need 8-16GB+ RAM

## Performance Metrics

Based on testing with mock recipe data:

| Model | Size | Time/Recipe | Quality | RAM Usage |
|-------|------|-------------|---------|-----------|
| mistral:latest | 4.4 GB | ~8s | Very Good | ~6 GB |
| mistral-small3.2 | 15 GB | ~15s | Excellent | ~12 GB |
| qwen2.5:72b | 47 GB | ~60s+ | Best | ~32 GB |

## Migration from OpenRouter

If you were previously using OpenRouter:

1. **No changes needed** to existing scripts
2. **Remove** `OPENROUTER_API_KEY` from `.env.local` (optional)
3. **Install and start** Ollama (see Quick Start)
4. **Run scripts** normally - they now use Ollama automatically

## Cost Comparison

**Before (OpenRouter + Claude Haiku)**:
- ~$0.03 for 55 URLs
- ~$0.0005 per recipe
- Requires API key and internet connection

**After (Ollama Local)**:
- **$0.00** - completely free
- One-time setup cost (time to download models)
- Works offline

## Advanced Configuration

### Custom Ollama Host

If running Ollama on a different machine:

```typescript
// In scripts/lib/recipe-parser-script.ts
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
```

### Batch Processing

For processing many recipes:

```bash
# Process in batches to avoid overwhelming local resources
for chef in dan-barber rene-redzepi; do
  CHEF=$chef APPLY_CHANGES=true pnpm tsx scripts/scrape-curated-chef-recipes.ts
  sleep 5
done
```

## Files Modified

- `scripts/lib/recipe-parser-script.ts` - Replaced OpenRouter with Ollama
- `scripts/scrape-curated-chef-recipes.ts` - Updated configuration
- `scripts/test-ollama-simple.ts` - New test script
- `scripts/test-ollama-extraction.ts` - Integration test

## Support

If you encounter issues:

1. Check Ollama is running: `curl http://localhost:11434/api/tags`
2. Verify model installed: `ollama list`
3. Check logs: Ollama server shows detailed logs
4. Try different model: `OLLAMA_MODEL=mistral:latest`

## Next Steps

1. Install Ollama and pull `mistral:latest`
2. Run test script: `pnpm tsx scripts/test-ollama-simple.ts`
3. Process recipes: `pnpm tsx scripts/scrape-curated-chef-recipes.ts`

Enjoy free, local AI-powered recipe extraction!
