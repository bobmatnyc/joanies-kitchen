# Chef Recipe Instructions Formatter

Automated script to format recipe instructions using LLM analysis.

## Purpose

Converts poorly formatted recipe instructions (run-on text, missing line breaks) into clean, numbered steps suitable for display and cooking guidance.

## Key Features

- 🤖 **LLM-Powered**: Uses OpenRouter API with free models
- 📝 **Content Preservation**: Never changes wording, only formatting
- 💾 **Backup System**: Stores original text in `instructions_backup`
- 🔄 **Retry Logic**: Handles rate limits with exponential backoff
- 🎯 **Smart Detection**: Skips already-formatted recipes
- 🛡️ **Safe by Default**: Dry run mode prevents accidental changes

## Usage

### Preview Changes (Dry Run)
```bash
# Preview all recipes
pnpm tsx scripts/format-chef-instructions.ts

# Preview specific chef
pnpm tsx scripts/format-chef-instructions.ts --chef="kenji-lopez-alt"

# Preview first 5 recipes
pnpm tsx scripts/format-chef-instructions.ts --limit=5
```

### Apply Changes
```bash
# Format all recipes
pnpm tsx scripts/format-chef-instructions.ts --apply

# Format specific chef
pnpm tsx scripts/format-chef-instructions.ts --chef="nancy-silverton" --apply

# Format with limit
pnpm tsx scripts/format-chef-instructions.ts --apply --limit=10
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--apply` | Actually update database | Dry run (preview only) |
| `--chef="slug"` | Process only one chef's recipes | All featured chefs |
| `--limit=N` | Process only first N recipes | All recipes |

## How It Works

### 1. Detection
- Checks if instructions are already JSON array format
- Detects numbered steps (e.g., "1. Step one")
- Skips if backup exists (already processed)

### 2. LLM Formatting
Sends instructions to LLM with strict rules:
- Break into logical steps
- DO NOT change wording
- Preserve all measurements, times, temperatures
- Return JSON array of strings

### 3. Validation
- Ensures response is valid JSON array
- Verifies all steps are strings
- Confirms non-empty array
- Handles parsing errors gracefully

### 4. Database Update
```sql
UPDATE recipes
SET
  instructions = $formatted_json,
  instructions_backup = $original_text,
  updated_at = NOW()
WHERE id = $recipe_id;
```

## LLM Configuration

### Models
- **Primary**: `meta-llama/llama-3.2-3b-instruct:free`
- **Fallback**: `mistralai/mistral-7b-instruct:free`

### Settings
- **Temperature**: 0.1 (low for consistency)
- **Max Tokens**: 4000
- **Retry Limit**: 3 attempts
- **Rate Limiting**: 2s delay between recipes

## Example Transformation

### Before
```
Adjust oven rack to middle position and preheat oven to 300°F. In a large Dutch oven, heat oil over medium-high heat until shimmering. Season beef with salt and pepper. Cook until browned, about 10 minutes. Transfer to plate.
```

### After
```json
[
  "Adjust oven rack to middle position and preheat oven to 300°F.",
  "In a large Dutch oven, heat oil over medium-high heat until shimmering.",
  "Season beef with salt and pepper.",
  "Cook until browned, about 10 minutes.",
  "Transfer to plate."
]
```

## Output Format

### Progress Display
```
================================================================================
Recipe: All-American Beef Stew
Chef: J. Kenji López-Alt
ID: 08dfdbda-aa89-4a9e-9e01-1e709b4c15f3

Original instructions (first 300 chars):
  Combine stock, tomato paste, anchovies...

  🤖 Formatting with LLM...

  ✓ Formatted into 24 steps

Formatted instructions:
  1. Combine stock, tomato paste, anchovies...
  2. Adjust oven rack to lowest position...
  ...

  ✅ Database updated
```

### Summary Report
```
================================================================================
📊 Summary
================================================================================
Total recipes: 87
Already formatted: 24
Processed: 63
Updated: 63
Skipped: 0
Errors: 0
```

## Error Handling

### Rate Limiting
- Retries with exponential backoff (1s, 2s, 4s)
- Switches between models on rate limits
- Maximum 3 retry attempts

### LLM Errors
- Logs error message with model name
- Continues to next recipe
- Reports errors in summary

### Database Errors
- Logs error message
- Skips recipe
- Increments error counter

## Safety Features

### Dry Run Mode
- **Default behavior**: Preview only, no database changes
- Must explicitly use `--apply` to modify data
- Shows exactly what will be changed

### Backup System
- Original instructions stored in `instructions_backup`
- Easy rollback if needed
- Prevents re-processing (skips if backup exists)

### Detection Logic
Prevents unnecessary processing:
- JSON array format: Already formatted
- Numbered steps (3+): Already formatted
- Has backup: Already processed

## Rollback

### Restore Single Recipe
```sql
UPDATE recipes
SET instructions = instructions_backup,
    instructions_backup = NULL
WHERE id = 'recipe-id-here';
```

### Restore All
```sql
UPDATE recipes
SET instructions = instructions_backup,
    instructions_backup = NULL
WHERE instructions_backup IS NOT NULL;
```

### Restore By Chef
```sql
UPDATE recipes
SET instructions = instructions_backup,
    instructions_backup = NULL
WHERE chef_id = (SELECT id FROM chefs WHERE slug = 'kenji-lopez-alt')
  AND instructions_backup IS NOT NULL;
```

## Requirements

### Environment Variables
```env
DATABASE_URL=postgresql://...           # Neon PostgreSQL
OPENROUTER_API_KEY=sk-or-...           # OpenRouter API
NEXT_PUBLIC_APP_URL=http://localhost:3002
```

### Dependencies
```json
{
  "dotenv": "^16.0.0",
  "@neondatabase/serverless": "^0.10.0",
  "openai": "^4.0.0"
}
```

## Featured Chefs

The script processes recipes from these 11 featured chefs:
1. Alton Brown
2. Gordon Ramsay
3. Ina Garten
4. J. Kenji López-Alt
5. Jacques Pépin
6. Lidia Bastianich
7. Madhur Jaffrey
8. Nancy Silverton
9. Nigella Lawson
10. Samin Nosrat
11. Yotam Ottolenghi

## Troubleshooting

### "Rate limit exceeded"
- Script automatically retries with different model
- If persistent, add longer delays between recipes
- Check OpenRouter quota at https://openrouter.ai/account

### "Response is not an array"
- LLM returned invalid JSON
- Script skips recipe and continues
- Review recipe manually if needed

### "Empty response from LLM"
- Temporary API issue
- Script retries automatically
- Re-run script for failed recipes

### All recipes showing "Already formatted"
- Recipes already in JSON format
- Check if backup exists (already processed)
- Verify detection logic in script

## Performance

### Timing
- **Single Recipe**: 3-5 seconds
- **10 Recipes**: ~1 minute
- **All 87 Recipes**: ~5-10 minutes

### API Costs
- Uses FREE OpenRouter models
- No API costs for basic usage
- Rate limits: ~60 requests/minute

## Best Practices

### Before Running
1. ✅ Always dry run first
2. ✅ Test with `--limit=1` on new chef
3. ✅ Verify environment variables set
4. ✅ Check OpenRouter API quota

### During Processing
1. 👀 Monitor progress output
2. 📊 Watch for errors in real-time
3. ⏸️ Cancel if unexpected behavior (Ctrl+C)

### After Running
1. ✅ Review summary statistics
2. ✅ Spot-check sample recipes
3. ✅ Verify backup column populated
4. ✅ Test frontend display

## Related Scripts

- `generate-all-embeddings.ts` - Generate recipe embeddings
- `extract-ingredients.ts` - Parse recipe ingredients
- `populate-slideshow-db.ts` - Populate hero slideshow
- `upload-slideshow-images.ts` - Upload slideshow images

## Documentation

- **Implementation Summary**: `docs/reference/CHEF_INSTRUCTIONS_FORMATTING.md`
- **Database Schema**: `src/lib/db/schema.ts`
- **Chef Actions**: `src/app/actions/chefs.ts`
- **OpenRouter Integration**: `src/lib/ai/openrouter-server.ts`

---

**Script**: `scripts/format-chef-instructions.ts`
**Last Updated**: 2025-10-17
**Status**: Production-ready ✅
