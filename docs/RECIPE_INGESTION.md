# Recipe Ingestion Feature

## Overview

The Recipe Ingestion feature allows administrators to import recipes from external URLs using Firecrawl for web scraping and Claude Sonnet 4.5 for AI-powered parsing.

## Features

- **URL-based Import**: Paste any recipe URL to automatically fetch and parse
- **Firecrawl Integration**: Clean content extraction from recipe websites
- **AI Parsing**: Claude Sonnet 4.5 extracts structured recipe data
- **Preview & Edit**: Review and modify parsed data before saving
- **Chef Association**: Link recipes to existing chefs
- **License Management**: Proper licensing and rights management
- **Rich Metadata**: Supports images, videos, nutrition info, and more

## Architecture

### Components

1. **Firecrawl Client** (`src/lib/firecrawl/client.ts`)
   - Wrapper around Firecrawl API
   - URL validation and scraping

2. **Recipe Parser** (`src/lib/ai/recipe-ingestion-parser.ts`)
   - LLM-powered recipe parsing
   - Structured ingredient extraction
   - Validation and serialization

3. **Server Actions** (`src/app/actions/recipe-ingestion.ts`)
   - `fetchRecipeFromUrl()` - Fetch content using Firecrawl
   - `parseRecipeContent()` - Parse with LLM
   - `saveIngestedRecipe()` - Save to database
   - `getChefsList()` - Get available chefs
   - `ingestRecipeFromUrl()` - Complete workflow

4. **Admin UI** (`src/app/admin/ingest-recipe/page.tsx`)
   - Multi-step ingestion wizard
   - Inline editing of parsed data
   - Chef and license selection

## Usage

### Admin Access

1. Navigate to `/admin/ingest-recipe`
2. Admin authentication required
3. Enter recipe URL
4. Review and edit parsed data
5. Associate with chef (optional)
6. Select license and visibility settings
7. Save to database

### Workflow Steps

1. **Input**: Admin enters recipe URL
2. **Fetch**: Firecrawl scrapes clean content
3. **Parse**: Claude Sonnet 4.5 extracts structured data
4. **Preview**: Admin reviews and edits
5. **Save**: Recipe saved to database with metadata

## Data Structure

### Ingested Recipe Format

```typescript
{
  name: string;
  description: string | null;
  ingredients: Array<{
    quantity?: string;
    unit?: string;
    name: string;
    notes?: string;
    preparation?: string;
  }>;
  instructions: string[];
  prep_time: number | null;
  cook_time: number | null;
  servings: number | null;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  cuisine: string | null;
  tags: string[];
  image_url?: string | null;
  video_url?: string | null;
}
```

## Configuration

### Environment Variables

Required:
- `FIRECRAWL_API_KEY` - Firecrawl API key
- `OPENAI_API_KEY` - OpenAI API key (for OpenRouter)

### Recipe Schema Compliance

Ensures all ingested recipes match the database schema:
- Required fields: name, ingredients, instructions
- Proper JSON serialization
- Slug generation
- License assignment
- User and chef associations

## Error Handling

- Invalid URL validation
- Firecrawl API failures
- LLM parsing errors
- Duplicate recipe detection (via slug)
- Missing required fields
- Database insertion errors

## Testing

### Test URLs

1. **Epicurious**:
   ```
   https://www.epicurious.com/recipes/food/views/kale-and-white-bean-stew-351254
   ```

2. **AllRecipes**:
   ```
   https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/
   ```

3. **Food Network**:
   ```
   https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-recipe-1939524
   ```

## Best Practices

1. **Review Before Saving**: Always review parsed data for accuracy
2. **License Selection**: Choose appropriate license based on source
3. **Chef Attribution**: Link to chef when known
4. **Image Quality**: Verify image URLs are appropriate
5. **Tag Completeness**: Add relevant tags for discoverability

## Limitations

- Firecrawl may not work on all websites (e.g., paywalls, heavy JavaScript)
- AI parsing may miss or misinterpret some recipe elements
- Rate limiting on Firecrawl and LLM APIs
- Manual review recommended for all ingested recipes

## Future Enhancements

- Batch URL import
- Automatic chef detection and creation
- Image download and hosting
- Duplicate recipe detection
- Automatic ingredient normalization
- Nutrition calculation
- Recipe quality scoring

## Support

For issues or questions, contact the development team or file an issue in the project repository.
