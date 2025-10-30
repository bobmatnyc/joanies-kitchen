# Recipe Flagging UI - User Walkthrough

## Visual User Journey

### Step 1: Discovering the Flag Button

**Where:** Recipe detail page (e.g., `/recipes/classic-margherita-pizza`)

**What users see:**
```
┌─────────────────────────────────────────────┐
│ 🍕 Classic Margherita Pizza                 │
│                                             │
│ ❤️ Favorite  📋 Clone  🚩 Report  ✨ Similar │
└─────────────────────────────────────────────┘
```

- Small flag icon (🚩) button
- Appears after favorite/clone buttons
- Tooltip on hover: "Report this recipe"
- **NOT visible to recipe owner**

### Step 2: Clicking the Flag Button

**For authenticated users:**
- Dialog opens immediately

**For unauthenticated users:**
- Redirects to `/sign-in`
- Returns to recipe after login
- Dialog opens automatically

### Step 3: Report Dialog Opens

```
┌─────────────────────────────────────────────────────┐
│ Report Recipe                                    ✕  │
│                                                     │
│ Help us maintain quality by reporting issues        │
│ with "Classic Margherita Pizza"                     │
│                                                     │
│ Reason for Report                                   │
│                                                     │
│ ○ Inappropriate Content                             │
│   Offensive or inappropriate material               │
│                                                     │
│ ○ Spam or Advertising                               │
│   Promotional content or spam                       │
│                                                     │
│ ○ Copyright Violation                               │
│   Unauthorized use of copyrighted material          │
│                                                     │
│ ○ Poor Quality                                      │
│   Inaccurate or low-quality recipe                  │
│                                                     │
│ ○ Other                                             │
│   Another issue not listed above                    │
│                                                     │
│ Additional Details                                  │
│ ┌─────────────────────────────────────────────┐   │
│ │ Provide additional details (optional)...    │   │
│ │                                             │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│           [Cancel]  [Submit Report]                 │
└─────────────────────────────────────────────────────┘
```

### Step 4: Selecting a Reason

**User clicks one of the radio buttons:**

```
┌─────────────────────────────────────────────────────┐
│ Reason for Report                                   │
│                                                     │
│ ○ Inappropriate Content                             │
│ ○ Spam or Advertising                               │
│ ● Poor Quality  ← SELECTED                          │
│   Inaccurate or low-quality recipe                  │
│ ○ Other                                             │
│                                                     │
│ [Cancel]  [Submit Report] ← NOW ENABLED             │
└─────────────────────────────────────────────────────┘
```

**Submit button:**
- ❌ Disabled if no reason selected
- ✅ Enabled once reason selected

### Step 5A: Optional Description

**User can add details (not required for most reasons):**

```
┌─────────────────────────────────────────────────────┐
│ Additional Details                                  │
│ ┌─────────────────────────────────────────────┐   │
│ │ The cooking time is way too short. My       │   │
│ │ pizza burned at 450°F for 15 minutes.       │   │
│ │ Should be 10-12 minutes max.                │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│           [Cancel]  [Submit Report]                 │
└─────────────────────────────────────────────────────┘
```

**Character limit:**
- Max 500 characters
- Counter appears after 400 characters
- Shows: "50 characters remaining"

### Step 5B: "Other" Reason (REQUIRES Description)

```
┌─────────────────────────────────────────────────────┐
│ ● Other                                             │
│   Another issue not listed above                    │
│                                                     │
│ Additional Details *                                │
│ ┌─────────────────────────────────────────────┐   │
│ │ Please provide details about the issue...   │   │
│ │                                             │   │
│ └─────────────────────────────────────────────┘   │
│                                                     │
│ [Cancel]  [Submit Report] ← DISABLED (needs text)  │
└─────────────────────────────────────────────────────┘
```

**If "Other" selected:**
- Description becomes **required** (marked with *)
- Placeholder text changes
- Submit disabled until description provided

### Step 6: Submitting the Report

**User clicks "Submit Report":**

```
┌─────────────────────────────────────────────────────┐
│           [Cancel]  [Submitting...]                 │
└─────────────────────────────────────────────────────┘
```

**Loading state:**
- Submit button shows "Submitting..."
- Button disabled
- Cancel button disabled
- User cannot close dialog

**Duration:** 1-2 seconds typically

### Step 7: Success Confirmation

**Success toast appears:**

```
┌─────────────────────────────────────┐
│ ✓ Thank you for your report.        │
│   We'll review it shortly.          │
└─────────────────────────────────────┘
```

**Dialog closes automatically**

**Flag button updates:**
```
┌─────────────────────────────────────┐
│ 🚩 Report  ← NOW GRAYED OUT          │
└─────────────────────────────────────┘
```

**New tooltip:**
- "You've already reported this recipe"
- Button is disabled (cannot report twice)

## Alternative Flows

### Flow A: User Already Reported

**If user previously flagged this recipe:**

```
┌─────────────────────────────────────┐
│ 🚩 Report  ← DISABLED/GRAYED         │
└─────────────────────────────────────┘
```

- Button appears disabled on page load
- Tooltip: "You've already reported this recipe"
- Clicking does nothing

### Flow B: Error During Submission

**If network error or server issue:**

```
┌─────────────────────────────────────┐
│ ✕ Failed to submit report.          │
│   Please try again.                 │
└─────────────────────────────────────┘
```

**Dialog stays open:**
- Form data preserved
- User can retry immediately
- Can also cancel and try later

### Flow C: Canceling the Report

**User clicks "Cancel" or X button:**
- Dialog closes immediately
- Form data is cleared
- Flag button returns to normal state
- User can re-open and try again

### Flow D: Recipe Owner

**If user owns the recipe:**
- Flag button does **not appear** at all
- Owners cannot flag their own recipes
- This prevents abuse

## What Happens Next?

### Behind the Scenes

1. **Flag is stored in database:**
   - Recipe ID, user ID, reason, description
   - Status: "pending"
   - Timestamp recorded

2. **Admin notification:**
   - Admins see new flag in dashboard
   - Can review at `/admin/flags`

3. **Admin reviews flag:**
   - Views recipe content
   - Reads flag reason and description
   - Decides action:
     - ✅ Resolved (issue fixed)
     - ✅ Dismissed (false report)
     - ⚠️ Take action (hide/delete recipe)

4. **Recipe status may change:**
   - Recipe may be hidden pending review
   - Recipe may be edited/corrected
   - Recipe may be deleted if severe

### User Privacy

- ✅ Your report is **anonymous** to recipe creator
- ✅ Only admins know who reported
- ✅ Recipe creator cannot see your username
- ✅ No public count of flags shown
- ✅ No retaliation possible

## Mobile Experience

### Mobile Layout

**Smaller screens:**
```
┌─────────────────────┐
│ ❤️ 📋 🚩 ✨         │  ← Icon-only buttons
└─────────────────────┘
```

**Dialog on mobile:**
- Full-screen on very small devices
- Optimized for touch
- Larger touch targets (44px min)
- Easy to scroll through reasons

## Accessibility Features

### Keyboard Navigation

1. **Tab to Flag button**
2. **Enter to open dialog**
3. **Tab through radio buttons**
4. **Arrow keys to select reason**
5. **Tab to description textarea**
6. **Tab to Cancel/Submit**
7. **Enter to submit**
8. **Escape to cancel**

### Screen Readers

- All buttons have descriptive labels
- Form fields have clear labels
- Error messages are announced
- Success/failure announced
- Loading states announced

## Common User Questions

**Q: Will the recipe creator know I reported them?**
A: No, your report is anonymous to the recipe creator. Only admins can see who submitted reports.

**Q: Can I report a recipe multiple times?**
A: No, you can only report each recipe once. The button will be disabled after your first report.

**Q: What happens if I report by mistake?**
A: Contact support to retract a report. Otherwise, admins will review and dismiss false reports with no penalty.

**Q: How long does admin review take?**
A: Most reports are reviewed within 24-48 hours. Severe issues may be addressed faster.

**Q: What if my report is dismissed?**
A: Dismissed reports don't count against you. Admins may determine the content is acceptable under community guidelines.

**Q: Can I see the status of my report?**
A: Currently no. This feature may be added in the future.

## Developer Notes

### Component Locations

- **FlagButton:** `/src/components/recipe/FlagButton.tsx`
- **FlagDialog:** `/src/components/recipe/FlagDialog.tsx`
- **Server Actions:** `/src/app/actions/flag-recipe.ts`
- **Integration:** `/src/app/recipes/[slug]/page.tsx` (line 516)

### Customization Points

**Button styling:**
```tsx
<FlagButton
  recipeId={recipe.id}
  recipeName={recipe.name}
  variant="ghost" // or "outline"
  size="sm"       // or "default"
/>
```

**Dialog customization:**
- Edit `FLAG_OPTIONS` array for different reasons
- Adjust `MAX_DESCRIPTION_LENGTH` constant
- Customize toast messages

---

**User Experience Rating:** ⭐⭐⭐⭐⭐

**Implementation Status:** ✅ Complete

**Last Updated:** 2025-10-30
