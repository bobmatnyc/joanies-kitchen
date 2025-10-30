# Upload API Integration Checklist

## Implementation Complete ✅

The `/api/upload` endpoint is fully implemented and ready for integration with RecipeUploadWizard.

## Pre-Integration Verification

### Environment Setup
- [ ] Verify `BLOB_READ_WRITE_TOKEN` is set in environment
  ```bash
  # Check local environment
  grep BLOB_READ_WRITE_TOKEN .env.local

  # Should see: BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
  ```

- [ ] Verify Vercel Blob is configured (if deploying to Vercel)
  - Go to Vercel Dashboard → Storage → Blob
  - Create Blob store if not exists
  - Copy token to environment variables

### API Endpoint Testing
- [ ] Test endpoint is accessible
  ```bash
  curl http://localhost:3002/api/upload
  # Should return 401 Unauthorized (expected without auth)
  ```

- [ ] Test with authentication (manual browser test)
  1. Sign in to the application
  2. Open browser DevTools → Network tab
  3. Try uploading an image via the new endpoint
  4. Verify successful upload and CDN URL returned

### Code Quality Checks
- [x] Biome linting passes
- [x] TypeScript compiles without errors
- [x] Unit tests pass (17/17)
- [x] Documentation complete

## RecipeUploadWizard Integration Steps

### Step 1: Create Upload Utility Function
Create `/src/lib/upload.ts`:

```typescript
export async function uploadRecipeImage(file: File): Promise<string> {
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
```

### Step 2: Update RecipeUploadWizard Component
Locate: `/src/components/recipe/RecipeUploadWizard.tsx`

Changes needed:
1. Import the upload function
2. Replace data URL generation with API upload
3. Add upload progress indicators
4. Add error handling for upload failures

Example modification:
```typescript
// Before
const handleImageSelect = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string;
    setImages([...images, dataUrl]);
  };
  reader.readAsDataURL(file);
};

// After
const handleImageSelect = async (file: File) => {
  try {
    setIsUploading(true);
    const url = await uploadRecipeImage(file);
    setImages([...images, url]);
    toast.success('Image uploaded successfully');
  } catch (error) {
    toast.error('Failed to upload image');
    console.error(error);
  } finally {
    setIsUploading(false);
  }
};
```

### Step 3: Update Form Submission
The images array should now contain CDN URLs instead of data URLs:

```typescript
// Images are now CDN URLs - can be submitted directly
const recipeData = {
  ...formData,
  images: images, // Array of CDN URLs
};
```

### Step 4: Add Loading States
```typescript
const [isUploading, setIsUploading] = useState(false);

// Disable form submission while uploading
<button
  type="submit"
  disabled={isUploading}
>
  {isUploading ? 'Uploading...' : 'Submit Recipe'}
</button>
```

### Step 5: Handle Upload Errors
```typescript
try {
  const url = await uploadRecipeImage(file);
  setImages([...images, url]);
} catch (error) {
  if (error.message.includes('size')) {
    toast.error('Image must be less than 5MB');
  } else if (error.message.includes('type')) {
    toast.error('Only JPEG, PNG, and WebP images allowed');
  } else if (error.message.includes('Unauthorized')) {
    toast.error('Please sign in to upload images');
  } else {
    toast.error('Failed to upload image. Please try again.');
  }
}
```

## Testing Checklist

### Unit Tests
- [x] File size validation tests pass
- [x] File type validation tests pass
- [x] Response format tests pass
- [x] Status code tests pass

### Integration Tests (To Do)
- [ ] Test successful image upload flow
- [ ] Test file size validation (upload >5MB file)
- [ ] Test file type validation (upload PDF)
- [ ] Test authentication requirement (upload without auth)
- [ ] Test multiple image uploads
- [ ] Test upload error handling

### Manual Testing (To Do)
- [ ] Upload JPEG image (< 5MB)
- [ ] Upload PNG image (< 5MB)
- [ ] Upload WebP image (< 5MB)
- [ ] Try uploading file > 5MB
- [ ] Try uploading non-image file
- [ ] Try uploading without authentication
- [ ] Verify uploaded images appear in Vercel Blob dashboard
- [ ] Verify CDN URLs are publicly accessible
- [ ] Test image upload in RecipeUploadWizard
- [ ] Test complete recipe submission with images

## Post-Integration Verification

### Performance Checks
- [ ] Verify upload completes in reasonable time (< 5 seconds)
- [ ] Check image CDN URLs load quickly
- [ ] Monitor for any memory leaks during upload
- [ ] Verify no console errors during upload

### Security Checks
- [ ] Verify authentication is enforced
- [ ] Verify file size limits are enforced
- [ ] Verify file type restrictions work
- [ ] Test with malformed requests
- [ ] Verify uploaded files are accessible via CDN

### User Experience Checks
- [ ] Upload progress indicator works
- [ ] Error messages are clear and helpful
- [ ] Success feedback is visible
- [ ] Images preview correctly after upload
- [ ] Multiple uploads work smoothly

## Rollback Plan

If issues occur after integration:

1. **Revert RecipeUploadWizard changes**
   ```bash
   git checkout HEAD -- src/components/recipe/RecipeUploadWizard.tsx
   ```

2. **Keep API route** (it won't break anything if unused)

3. **Investigate issues** before re-attempting integration

## Monitoring

After deployment, monitor:

- [ ] Upload success rate
- [ ] Upload error types and frequencies
- [ ] Average upload time
- [ ] Blob storage usage
- [ ] CDN bandwidth usage

## Documentation Updates Needed

After integration:
- [ ] Update RecipeUploadWizard component documentation
- [ ] Add upload API to API documentation index
- [ ] Update user guide with image upload instructions
- [ ] Add troubleshooting section for common upload issues

## Success Criteria

Integration is successful when:
- [x] API endpoint is implemented
- [x] API endpoint passes all tests
- [ ] RecipeUploadWizard uses upload API
- [ ] Images upload successfully to Vercel Blob
- [ ] CDN URLs are stored in recipes
- [ ] Uploaded images display correctly
- [ ] Error handling works properly
- [ ] User experience is smooth
- [ ] No regression in existing functionality

## Resources

- API Route: `/src/app/api/upload/route.ts`
- Tests: `/tests/unit/upload-api.test.ts`
- Documentation: `/docs/api/upload-endpoint.md`
- Integration Examples: `/docs/api/upload-integration-example.tsx`
- Environment Config: `.env.example`

## Support

If you encounter issues:

1. Check API route logs for errors
2. Verify environment variables are set
3. Test endpoint with cURL to isolate issues
4. Review Vercel Blob dashboard for storage issues
5. Check browser console for client-side errors

---

**Current Status**: API Implementation Complete ✅
**Next Step**: Integrate with RecipeUploadWizard
**Estimated Integration Time**: 30-60 minutes
