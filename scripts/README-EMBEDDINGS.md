# Embedding Generation Script

Production-ready script for generating semantic embeddings for all recipes.

## Quick Start

```bash
# Test on 10 recipes (dry-run)
pnpm embeddings:generate:test

# Generate embeddings for all recipes
pnpm embeddings:generate

# Resume from checkpoint if interrupted
pnpm embeddings:generate:resume
```

## Features

- ✅ **Checkpoint/Resume**: Saves progress every 50 recipes
- ✅ **Retry Logic**: 3 automatic retries with exponential backoff
- ✅ **Error Logging**: Detailed logs in `tmp/embedding-errors.log`
- ✅ **Progress Tracking**: Real-time ETA and processing rate
- ✅ **Quality Validation**: Validates embedding dimensions and values
- ✅ **Dry-Run Mode**: Test without generating embeddings
- ✅ **Limit Mode**: Test on small batches

## Commands

```bash
# NPM Scripts
pnpm embeddings:generate:dry-run    # Dry run (default)
pnpm embeddings:generate:test       # Test on 10 recipes
pnpm embeddings:generate            # Execute full generation
pnpm embeddings:generate:resume     # Resume from checkpoint

# Manual Commands
npx tsx scripts/generate-all-embeddings.ts                    # Dry run
npx tsx scripts/generate-all-embeddings.ts --execute          # Execute
npx tsx scripts/generate-all-embeddings.ts --limit=10         # Test
npx tsx scripts/generate-all-embeddings.ts --execute --resume # Resume
npx tsx scripts/generate-all-embeddings.ts --batch-size=10    # Custom batch
npx tsx scripts/generate-all-embeddings.ts --delay=2000       # Custom delay
```

## Configuration

- **Model**: BAAI/bge-small-en-v1.5 (384 dimensions)
- **Batch Size**: 10 recipes per batch
- **Delay**: 2000ms between batches
- **Max Retries**: 3 attempts per recipe
- **Checkpoint Interval**: Every 50 recipes

## Estimates (for 3,276 recipes)

- **Time**: ~2.5-3 hours
- **Cost**: $0 (HuggingFace free tier)
- **Rate**: ~15-20 recipes/min

## Output Files

All files saved to `tmp/` directory:

1. `embedding-generation-checkpoint.json` - Progress checkpoint
2. `embedding-errors.log` - Error details
3. `embedding-generation-report-*.json` - Final report

## Troubleshooting

### API Key Missing

```bash
# Add to .env.local
HUGGINGFACE_API_KEY=hf_...
```

Get your key from: https://huggingface.co/settings/tokens

### Resume from Interruption

```bash
pnpm embeddings:generate:resume
```

### Check Progress

```bash
# View checkpoint
cat tmp/embedding-generation-checkpoint.json

# View errors
cat tmp/embedding-errors.log

# Check database coverage
pnpm test:embeddings
```

## Full Documentation

See: `tmp/EMBEDDING_GENERATION_GUIDE.md` for comprehensive guide
