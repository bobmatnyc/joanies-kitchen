# Recipe Draft Auto-Save Implementation

## Overview
Implemented comprehensive auto-save functionality for the RecipeUploadWizard to prevent data loss when users navigate away or close the browser.

## Files Created

### 1. `/src/hooks/useRecipeDraftAutoSave.ts`
Custom React hook for managing recipe draft auto-save functionality.

**Features:**
- Auto-saves form data to localStorage every 30 seconds (debounced)
- Saves immediately on step changes
- Handles storage errors gracefully (quota exceeded, corrupted data)
- Supports versioning for future migrations
- User-specific draft storage (`recipe-draft-${userId}`)
- Returns: `{ saveDraft, loadDraft, clearDraft, hasDraft, lastSaved, isSaving, saveError }`

**Additional Exports:**
- `useAutoSaveEffect`: Debounced auto-save effect hook
- `formatSavedTime`: Utility function to format timestamps (e.g., "2 minutes ago")

### 2. `/src/components/recipe/DraftResumeDialog.tsx`
Dialog component that appears when a user visits the upload page with an existing draft.

**Features:**
- Shows draft preview (recipe name, current step, progress percentage)
- Displays time since last save
- Two action buttons: "Resume Draft" and "Start Fresh"
- Accessible design with ARIA labels
- Mobile-responsive layout

### 3. `/src/components/recipe/RecipeUploadWizard.tsx` (Updated)
Updated the main wizard component to integrate auto-save functionality.

**New Features:**
- Loads draft on component mount
- Shows draft resume dialog if draft exists
- Auto-saves every 30 seconds (debounced)
- Saves immediately on step changes
- Displays save status indicator ("Saving...", "Saved X minutes ago")
- Shows draft restored banner after resuming
- Clears draft on successful submission
- Browser navigation warning for unsaved changes
- Handles storage errors with user-friendly alerts

## User Experience Flow

### 1. **First Visit (No Draft)**
- User starts filling out recipe form
- Auto-save kicks in after 30 seconds
- Save status indicator shows "Saving..." then "Saved X ago"
- User can navigate between steps (triggers immediate save)

### 2. **Returning User (Draft Exists)**
- Dialog appears: "Draft Found"
- Shows draft details: recipe name, last step, progress %
- User chooses:
  - **Resume Draft**: Restores all data and returns to last step
  - **Start Fresh**: Clears draft and starts new recipe

### 3. **Draft Restored**
- Blue banner appears: "Draft from X ago restored" with clear button
- All form data pre-filled
- User continues from where they left off
- Auto-save continues in background

### 4. **Successful Submission**
- Draft automatically cleared
- Navigation warning removed
- User redirected to recipe page

### 5. **Browser Navigation**
- If user tries to close tab/window with unsaved changes
- Browser shows: "Changes you made may not be saved"
- Prevents accidental data loss

## Technical Implementation Details

### Auto-Save Strategy
```typescript
// Debounced auto-save (30 seconds)
useAutoSaveEffect(formData, currentStep, saveDraft, hasUnsavedChanges && !isSubmitting);

// Immediate save on step changes
const handleNext = () => {
  saveDraft(formData, nextStep);
  setCurrentStep(nextStep);
};
```

### Storage Key Format
```typescript
const STORAGE_KEY = `recipe-draft-${userId || 'anonymous'}`;
```

### Draft Data Structure
```typescript
interface DraftData {
  data: RecipeFormData;      // Complete form state
  savedAt: string;            // ISO timestamp
  version: number;            // For future migrations
  step: string;               // Current wizard step
}
```

### Error Handling
- **Quota Exceeded**: Shows error alert, disables auto-save
- **Corrupted Data**: Clears corrupt draft, shows error
- **Private Browsing**: localStorage failures handled gracefully
- **Multiple Tabs**: Last write wins (localStorage behavior)

## UI Components

### Save Status Indicator
```
Last saved: 2 minutes ago | Saving... | Saved ✓
```
- Green checkmark with timestamp when saved
- Blue spinner when saving
- Only shows when there are unsaved changes

### Draft Banner
```
📝 Draft from 2 hours ago restored [×]
```
- Blue background
- Dismissible with X button
- Shows after resuming draft

### Draft Dialog
```
Found a saved draft from 2 hours ago

Recipe: [draft.name or "Untitled"]
Last step: [step name]
Progress: [40%]

[Start Fresh] [Resume Draft]
```

## Success Criteria

All requirements met:
- ✅ Auto-saves every 30 seconds (debounced)
- ✅ Saves immediately on step changes
- ✅ Loads draft on mount if exists
- ✅ Shows draft resume dialog
- ✅ Clears draft on successful submission
- ✅ Shows last saved indicator
- ✅ Warns on navigation with unsaved changes
- ✅ Handles storage errors gracefully
- ✅ TypeScript with proper types
- ✅ Biome linting compliant
- ✅ No breaking changes to existing functionality

## Testing Recommendations

### Manual Testing
1. **Create Draft**
   - Start recipe, fill in basic info
   - Wait 30 seconds, verify "Saved" indicator appears
   - Change steps, verify immediate save

2. **Resume Draft**
   - Close tab with unsaved changes
   - Reopen recipe upload page
   - Verify dialog appears with correct data
   - Click "Resume Draft", verify data restored

3. **Start Fresh**
   - With existing draft, click "Start Fresh"
   - Verify form is empty
   - Verify draft cleared from localStorage

4. **Browser Warning**
   - Make changes to form
   - Try to close tab
   - Verify browser warning appears

5. **Successful Submission**
   - Fill out complete recipe
   - Submit successfully
   - Verify draft cleared (no dialog on next visit)

6. **Storage Errors**
   - Fill localStorage to quota
   - Verify error alert appears
   - Verify auto-save disabled gracefully

### Edge Cases
- Multiple browser tabs (verify last write wins)
- Private browsing mode (verify no crashes)
- Corrupted localStorage data (verify clear and error)
- Anonymous users (verify userId=null works)
- Network errors during submission (verify draft preserved)

## Browser Compatibility

**localStorage Support:**
- Chrome: ✅ (v4+)
- Firefox: ✅ (v3.5+)
- Safari: ✅ (v4+)
- Edge: ✅ (All versions)

**BeforeUnload Event:**
- All modern browsers support beforeunload warning
- Note: Custom message text no longer customizable (browser security)

## Performance Considerations

- **Debouncing**: Prevents excessive saves (30s interval)
- **Change Detection**: Only saves if data actually changed
- **JSON Size**: Recipe form data typically <50KB
- **localStorage Limit**: 5-10MB per origin (plenty of space)

## Future Enhancements

Possible improvements:
1. **IndexedDB**: For offline support and larger data
2. **Cloud Sync**: Save drafts to user account (cross-device)
3. **Version History**: Multiple draft versions
4. **Auto-delete Old Drafts**: Clean up after X days
5. **Draft Analytics**: Track save frequency, completion rates
6. **Conflict Resolution**: Handle multiple tab edits better

## Accessibility

- ARIA labels on all interactive elements
- Keyboard navigation support
- Screen reader friendly
- High contrast mode compatible
- Focus management on dialog open/close

## Code Quality

- **TypeScript**: Full type safety
- **Linting**: Biome compliant
- **Documentation**: Inline JSDoc comments
- **Error Handling**: Comprehensive try/catch blocks
- **Code Organization**: Separated concerns (hook, dialog, wizard)

## Dependencies

No new external dependencies added. Uses existing:
- React hooks (useState, useEffect, useCallback, useRef)
- Clerk (@clerk/nextjs) for user authentication
- Shadcn/ui components (Alert, AlertDialog, Badge, Button, etc.)
- Lucide icons

## Deployment Notes

- No database migrations required
- No environment variables needed
- Client-side only (localStorage)
- Works in development and production
- No server-side changes needed

---

**Implementation Date**: 2025-10-30
**Status**: Complete
**Testing**: Manual testing recommended before production deployment
