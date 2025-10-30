# Recipe Content Flagging UI

## Overview

User-facing interface for reporting inappropriate or problematic recipes. The system allows authenticated users to flag recipes for admin review while preventing abuse through duplicate detection and rate limiting at the server level.

## Components

### 1. FlagButton Component

**Location:** `/src/components/recipe/FlagButton.tsx`

**Purpose:** Entry point button for reporting recipes

**Features:**
- ✅ Icon-based button with tooltip
- ✅ Authentication check (redirects to sign-in if needed)
- ✅ Prevents duplicate flags (checks if user already flagged)
- ✅ Accessible (ARIA labels, keyboard navigation)
- ✅ Loading states while checking flag status
- ✅ Touch-friendly (44px minimum touch target)

**Props:**
```typescript
interface FlagButtonProps {
  recipeId: string;        // Recipe to flag
  recipeName: string;      // For dialog title
  variant?: 'ghost' | 'outline';  // Button style
  size?: 'sm' | 'default';        // Button size
}
```

**States:**
- **Loading:** Checking if user already flagged
- **Enabled:** User can click to report
- **Disabled:** User already reported this recipe
- **Unauthenticated:** Redirects to sign-in on click

**Tooltips:**
- Enabled: "Report this recipe"
- Disabled: "You've already reported this recipe"
- Unauthenticated: "Sign in to report this recipe"

### 2. FlagDialog Component

**Location:** `/src/components/recipe/FlagDialog.tsx`

**Purpose:** Modal form for submitting flag reports

**Features:**
- ✅ Five flag reason categories
- ✅ Optional description field
- ✅ Required description for "Other" reason
- ✅ 500 character limit enforcement
- ✅ Character counter (shows when >400 chars)
- ✅ Form validation
- ✅ Loading states during submission
- ✅ Success/error feedback via toasts
- ✅ Auto-close on success
- ✅ Form reset on cancel/close

**Props:**
```typescript
interface FlagDialogProps {
  recipeId: string;
  recipeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

**Flag Reasons:**

| Value | Label | Description | Requires Description |
|-------|-------|-------------|---------------------|
| `inappropriate` | Inappropriate Content | Offensive or inappropriate material | No |
| `spam` | Spam or Advertising | Promotional content or spam | No |
| `copyright` | Copyright Violation | Unauthorized use of copyrighted material | No |
| `quality` | Poor Quality | Inaccurate or low-quality recipe | No |
| `other` | Other | Another issue not listed above | **Yes** |

**Validation Rules:**
- Must select a reason
- If reason is "other", description is required
- Description max length: 500 characters
- Whitespace-only descriptions are rejected

**User Flow:**
1. User clicks Flag button
2. Dialog opens with reason selection
3. User selects a reason
4. (Optional) User adds description
5. User clicks "Submit Report"
6. Loading state shown
7. On success:
   - Success toast: "Thank you for your report. We'll review it shortly."
   - Dialog closes automatically
   - Flag button becomes disabled
   - Tooltip changes to "Already reported"
8. On error:
   - Error toast with specific message
   - Dialog remains open for retry

## Integration

### Recipe Detail Page

**Location:** `/src/app/recipes/[slug]/page.tsx`

The FlagButton is integrated in the recipe actions toolbar:

```tsx
{/* Report Button - available to all users except recipe owner */}
{!isOwner && <FlagButton recipeId={recipe.id} recipeName={recipe.name} />}
```

**Positioning:**
- Located in the tool buttons row below recipe header
- Appears after Favorite and Clone buttons
- Only visible to non-owners
- Grouped with other engagement actions

**Conditions:**
- ✅ Hidden if current user owns the recipe
- ✅ Visible to authenticated users
- ✅ Visible to unauthenticated users (redirects to sign-in)

## Server Actions

**Location:** `/src/app/actions/flag-recipe.ts`

### Available Actions

#### `flagRecipe(recipeId, reason, description?)`
Submits a flag report for a recipe.

**Parameters:**
- `recipeId: string` - Recipe to flag
- `reason: FlagReason` - One of: inappropriate, spam, copyright, quality, other
- `description?: string` - Optional detailed description

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
  flagId?: string;
}
```

**Server-Side Validation:**
- ✅ User must be authenticated
- ✅ Recipe must exist
- ✅ Reason must be valid
- ✅ Duplicate flags prevented (unique constraint)

#### `hasUserFlagged(recipeId)`
Checks if current user has flagged a recipe.

**Returns:** `boolean`

#### `getFlagCount(recipeId)`
Gets count of pending flags for a recipe.

**Returns:** `number`

## Database Schema

**Table:** `recipeFlags`

```sql
CREATE TABLE recipe_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id),
  user_id TEXT NOT NULL,
  reason TEXT NOT NULL,  -- 'inappropriate' | 'spam' | 'copyright' | 'quality' | 'other'
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate flags from same user
  UNIQUE(recipe_id, user_id)
);
```

## Design & Styling

### Visual Design
- **Button:** Ghost or outline variant, flag icon
- **Dialog:** Standard modal with shadcn/ui components
- **Colors:** Neutral (not alarming red)
- **Tone:** Professional, community-focused
- **Size:** Touch-friendly 44px minimum

### Accessibility
- ✅ ARIA labels on all interactive elements
- ✅ Keyboard navigation support
- ✅ Focus management (trap focus in dialog)
- ✅ Screen reader friendly
- ✅ Clear error messages
- ✅ Loading states announced
- ✅ Required fields marked with asterisk

### Mobile Responsiveness
- ✅ Touch targets 44px minimum
- ✅ Dialog adapts to mobile screens
- ✅ Textarea resizes appropriately
- ✅ Buttons stack on mobile

## User Experience

### Success Flow
1. User finds problematic recipe
2. Clicks flag button (icon or icon+text)
3. Dialog opens with clear explanation
4. Selects appropriate reason
5. Optionally adds details
6. Submits report
7. Sees thank you message
8. Button becomes disabled (prevents duplicates)

### Error Handling

**Unauthenticated User:**
- Redirects to `/sign-in?redirect=/recipes/{recipeId}`
- Returns to recipe after authentication

**Already Flagged:**
- Button appears disabled
- Tooltip: "You've already reported this recipe"
- Cannot submit duplicate

**Network Error:**
- Toast: "Failed to submit report. Please try again."
- Dialog stays open for retry
- No data lost

**Invalid Data:**
- Client-side validation prevents submission
- Submit button stays disabled
- Clear indication of what's required

### Privacy & Safety
- User's flag is **anonymous** to recipe creator
- Only admins see who flagged
- No public count of flags shown
- Recipe creator cannot retaliate

## Admin Integration

Flags are reviewed in the admin dashboard:

**Location:** `/admin/flags`

**Admin Capabilities:**
- View all pending flags
- See flag reason and description
- View recipe content
- Review/Resolve/Dismiss flags
- Add review notes
- Take action on flagged recipes

## Testing

**E2E Tests:** `/tests/e2e/flag-recipe-ui.spec.ts`

**Test Coverage:**
- ✅ Button visibility and states
- ✅ Dialog opening/closing
- ✅ Form validation
- ✅ Submission flow
- ✅ Success/error handling
- ✅ Authentication checks
- ✅ Duplicate prevention
- ✅ Accessibility
- ✅ Keyboard navigation
- ✅ Mobile responsiveness

## Performance Considerations

### Optimizations
- ✅ Server action for fast submission
- ✅ Check flag status on mount (prevents wasted clicks)
- ✅ Lazy load dialog content
- ✅ Debounced character counter
- ✅ Optimistic UI updates where safe

### Metrics to Monitor
- Flag submission rate
- False positive rate
- Time to admin review
- User satisfaction with process

## Security

### Protections
- ✅ Server-side authentication check
- ✅ Recipe existence validation
- ✅ Unique constraint prevents duplicates
- ✅ Input sanitization on server
- ✅ Rate limiting at server level (future)
- ✅ No public exposure of flag counts

### Potential Abuse Vectors
- **Spam Flagging:** Mitigated by duplicate prevention
- **Malicious Descriptions:** Admin reviews all flags
- **Retaliation:** Flags are anonymous to recipe creators
- **False Reports:** Admin can dismiss invalid flags

## Future Enhancements

### Potential Features
- [ ] Flag comments and reviews (not just recipes)
- [ ] Auto-action on threshold (e.g., 5 flags = auto-hide)
- [ ] Email notifications to admins
- [ ] User reputation system (trusted reporters)
- [ ] Appeal process for false flags
- [ ] Public transparency report
- [ ] Machine learning for flag prioritization

### Analytics to Add
- Track flag reason distribution
- Measure admin response time
- Monitor false positive rate
- Identify patterns in flagged content

## Troubleshooting

### Common Issues

**Button not appearing:**
- Check if user is recipe owner (button hidden for owners)
- Verify component is imported in recipe page
- Check authentication state

**Dialog not opening:**
- Check for JavaScript errors in console
- Verify Dialog component is properly exported
- Check z-index conflicts with other modals

**Form won't submit:**
- Verify reason is selected
- Check if "other" reason requires description
- Look for network errors in browser dev tools
- Verify server action is accessible

**Already flagged but button enabled:**
- Check server action `hasUserFlagged` return value
- Verify database constraint is in place
- Look for authentication issues

## Support & Documentation

**Related Docs:**
- [Admin Moderation System](/docs/admin/MODERATION.md)
- [Server Actions Guide](/docs/architecture/SERVER_ACTIONS.md)
- [Component Library](/docs/components/UI_COMPONENTS.md)

**Code References:**
- FlagButton: `/src/components/recipe/FlagButton.tsx`
- FlagDialog: `/src/components/recipe/FlagDialog.tsx`
- Server Actions: `/src/app/actions/flag-recipe.ts`
- Database Schema: `/src/lib/db/schema.ts`
- Admin UI: `/src/app/admin/flags/page.tsx`

---

**Status:** ✅ Complete and Production Ready

**Last Updated:** 2025-10-30
