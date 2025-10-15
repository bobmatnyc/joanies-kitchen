# Brave Search API Integration

## Overview
This document describes the Brave Search API integration for the Recipe Manager project.

## API Route
**Endpoint:** `/api/brave-search`
**Method:** `POST`
**Authentication:** Required (Clerk)

## Setup

### Environment Variables
Add the following to your `.env.local` file:

```bash
BRAVE_SEARCH_API_KEY=your_brave_search_api_key_here
```

To get an API key:
1. Visit [Brave Search API](https://brave.com/search/api/)
2. Sign up for an account
3. Create a new API key
4. Copy the key to your environment file

## Request Format

### Request Body
```typescript
{
  "query": string,      // Required: Search query (non-empty string)
  "count": number       // Optional: Number of results (1-100, default: 10)
}
```

### Example Request
```bash
curl -X POST http://localhost:3004/api/brave-search \
  -H "Content-Type: application/json" \
  -H "Cookie: __session=your_clerk_session_token" \
  -d '{
    "query": "chocolate chip cookie recipe",
    "count": 10
  }'
```

## Response Format

### Success Response (200)
```typescript
{
  "type": "search",
  "query": {
    "original": "chocolate chip cookie recipe",
    "show_strict_warning": false
  },
  "web": {
    "results": [
      {
        "title": "Best Chocolate Chip Cookies Recipe",
        "url": "https://example.com/recipe",
        "description": "This recipe makes the best chocolate chip cookies...",
        "age": "2023-10-15",
        "language": "en"
      }
      // ... more results
    ]
  }
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "details": "You must be signed in to use search"
}
```

#### 400 Bad Request
```json
{
  "error": "Invalid query",
  "details": "Query must be a non-empty string"
}
```

#### 429 Rate Limit Exceeded
```json
{
  "error": "Rate limit exceeded",
  "details": "Too many requests. Please try again later."
}
```

#### 503 Service Unavailable
```json
{
  "error": "Search service unavailable",
  "details": "Search service is not configured"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Search failed",
  "details": "An unexpected error occurred while processing your request"
}
```

## Security Features

### Authentication
- All requests must include a valid Clerk session
- Unauthenticated requests return 401
- User ID is logged for audit purposes

### Input Validation
- Query must be a non-empty string
- Count must be a number between 1-100
- Malformed JSON returns 400

### API Key Protection
- API key is stored in environment variables only
- Never exposed in responses or client-side code
- Missing API key returns 503 (not 500)

### Error Handling
- Invalid API keys (401) return 503 to client
- Rate limits (429) pass through to client
- All errors are logged server-side
- Client receives user-friendly error messages

## Usage Example

### TypeScript/React Example
```typescript
async function searchRecipes(query: string) {
  try {
    const response = await fetch('/api/brave-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        count: 10
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.details || error.error);
    }

    const data = await response.json();
    return data.web?.results || [];
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}
```

### Next.js Server Component Example
```typescript
// Note: For server components, use the Brave Search API directly
// This route is designed for client-side use with authentication
```

## Implementation Details

### File Location
`/Users/masa/Projects/recipe-manager/src/app/api/brave-search/route.ts`

### Dependencies
- `next` - Next.js framework
- `@clerk/nextjs/server` - Authentication via `auth()` helper

### HTTP Methods
- `POST` - Execute search (implemented)
- `GET`, `PUT`, `DELETE`, `PATCH` - Return 405 Method Not Allowed

### Logging
- All requests log: userId, query (truncated), count
- Successful searches log: userId, result count
- All errors log to console with context
- API key issues logged with error level

## Testing

### Manual Testing
1. Start the development server: `npm run dev`
2. Sign in to the application (Clerk)
3. Use the example cURL command above (update cookie)
4. Or integrate into a React component

### Test Cases
- ✅ Valid authenticated request returns results
- ✅ Unauthenticated request returns 401
- ✅ Empty query returns 400
- ✅ Invalid count (<1 or >100) returns 400
- ✅ Missing API key returns 503
- ✅ Invalid API key returns 503 (not 401)
- ✅ Rate limit returns 429
- ✅ Other HTTP methods return 405

## Integration Checklist
- [ ] Add `BRAVE_SEARCH_API_KEY` to `.env.local`
- [ ] Test authentication flow
- [ ] Test with valid search queries
- [ ] Handle error responses in UI
- [ ] Add loading states
- [ ] Add rate limiting feedback to users
- [ ] Consider caching results (optional)
- [ ] Monitor API usage in Brave dashboard

## Rate Limits
Brave Search API rate limits depend on your subscription tier:
- Free tier: Limited requests per day
- Paid tiers: Higher limits

Monitor your usage in the Brave Search dashboard to avoid rate limit errors.

## Future Enhancements
- Add response caching (Redis/memory)
- Add request rate limiting (per user)
- Add search analytics/logging
- Support additional Brave Search features (news, images, etc.)
- Add search filters (date range, language, etc.)

## Troubleshooting

### "Search service unavailable" error
- Check that `BRAVE_SEARCH_API_KEY` is set in `.env.local`
- Restart the development server after adding the key

### "Unauthorized" error
- Ensure user is signed in via Clerk
- Check that authentication is properly configured

### "Rate limit exceeded" error
- Check your Brave Search dashboard for usage limits
- Consider implementing request caching
- Upgrade to a higher tier if needed

### No results returned
- Verify the query is valid
- Check Brave Search API status
- Review server logs for detailed error messages
