# Image Upload API

## Overview

The `/api/upload` endpoint allows authenticated users to upload images to Vercel Blob Storage and receive CDN URLs for use in recipes.

## Endpoint

```
POST /api/upload
```

## Authentication

Requires a valid Clerk session. Users must be authenticated to upload images.

## Request

### Content-Type

```
multipart/form-data
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Image file to upload |

### Constraints

- **Max file size**: 5MB
- **Allowed types**:
  - `image/jpeg`
  - `image/png`
  - `image/webp`

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "url": "https://[blob-storage-url]/recipe-images/[timestamp]-[random].png"
}
```

### Error Responses

#### 401 Unauthorized

User is not authenticated.

```json
{
  "success": false,
  "error": "Unauthorized. Please sign in to upload images."
}
```

#### 400 Bad Request

No file was provided in the request.

```json
{
  "success": false,
  "error": "No file provided. Please include a file in the request."
}
```

#### 413 Payload Too Large

File size exceeds 5MB limit.

```json
{
  "success": false,
  "error": "File size exceeds 5MB limit. File size: [size]MB"
}
```

#### 415 Unsupported Media Type

File type is not allowed.

```json
{
  "success": false,
  "error": "Unsupported file type: [type]. Allowed types: image/jpeg, image/png, image/webp"
}
```

#### 500 Internal Server Error

Upload failed or server error.

```json
{
  "success": false,
  "error": "Failed to upload to storage. Please try again."
}
```

## Example Usage

### JavaScript/TypeScript (Client-Side)

```typescript
async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.url;
}

// Usage in a React component
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const url = await uploadImage(file);
    console.log('Uploaded image URL:', url);
    // Use the URL in your recipe data
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### cURL

```bash
curl -X POST https://your-domain.com/api/upload \
  -H "Cookie: __session=your-clerk-session" \
  -F "file=@/path/to/image.jpg"
```

## Implementation Details

### File Storage

- Images are stored in Vercel Blob Storage
- Folder: `recipe-images/`
- Public access enabled for CDN delivery
- Filenames are auto-generated: `[timestamp]-[random].[ext]`

### Security

- Authentication required via Clerk session
- File size validation (max 5MB)
- File type validation (images only)
- Unique filename generation prevents conflicts

### Performance

- Files are uploaded directly to Vercel Blob CDN
- No server-side storage or processing
- Optimized for global CDN delivery

## Integration with RecipeUploadWizard

The upload endpoint is designed to work seamlessly with the `RecipeUploadWizard` component:

1. User selects an image in the wizard
2. Component immediately uploads to `/api/upload`
3. Receives CDN URL in response
4. Stores URL in recipe data
5. Displays uploaded image to user

This replaces the previous data URL approach, providing:
- Smaller payload sizes
- Faster recipe submission
- Persistent image storage
- CDN-optimized delivery

## Error Handling

The endpoint provides specific error messages for:
- Authentication failures
- Missing files
- File size violations
- File type violations
- Upload failures

Client applications should handle these errors gracefully and provide user feedback.

## Future Enhancements

Potential improvements for future versions:

- [ ] Image resizing/optimization before storage
- [ ] Multiple file upload support
- [ ] Progress tracking for large uploads
- [ ] Image format conversion (auto-convert to WebP)
- [ ] Thumbnail generation
- [ ] Upload analytics and monitoring
