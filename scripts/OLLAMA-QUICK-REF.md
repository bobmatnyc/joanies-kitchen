# Ollama Quick Reference

## One-Time Setup

```bash
# 1. Install Ollama
brew install ollama

# 2. Pull recommended model
ollama pull mistral:latest

# 3. Start server (keep running)
ollama serve
```

## Daily Usage

```bash
# Make sure Ollama is running
ollama serve  # In separate terminal

# Test extraction
pnpm tsx scripts/test-ollama-simple.ts

# Run scraping (dry run)
pnpm tsx scripts/scrape-curated-chef-recipes.ts

# Apply to database
APPLY_CHANGES=true pnpm tsx scripts/scrape-curated-chef-recipes.ts
```

## Model Selection

```bash
# Fast (default)
OLLAMA_MODEL=mistral:latest pnpm tsx scripts/...

# Better quality
OLLAMA_MODEL=mistral-small3.2:latest pnpm tsx scripts/...

# Best quality (slow)
OLLAMA_MODEL=qwen2.5:72b pnpm tsx scripts/...
```

## Troubleshooting

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# List installed models
ollama list

# Pull missing model
ollama pull mistral:latest

# Restart Ollama
pkill ollama && ollama serve
```

## Performance

| Model | Speed | Quality | Use When |
|-------|-------|---------|----------|
| mistral:latest | 8-10s | Very Good | Default, production |
| mistral-small3.2 | 15-20s | Excellent | Need better quality |
| qwen2.5:72b | 60s+ | Best | Maximum quality only |

## Key Benefits

- **$0 cost** (vs $0.0005/recipe with OpenRouter)
- **Works offline**
- **Full privacy** (data never leaves your machine)
- **No API keys** needed for AI extraction
