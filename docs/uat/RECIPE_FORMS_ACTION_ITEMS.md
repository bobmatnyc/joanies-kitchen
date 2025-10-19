# Recipe Forms UAT - Action Items

**Generated**: October 19, 2025
**Priority**: CRITICAL for v0.55.0 release
**Estimated Effort**: 1-2 days for critical fixes, 1 week for full polish

---

## 🔴 CRITICAL - Block Release

### 1. Restore Tag Input System (2-3 hours)

**Problem**: SemanticTagInput component was removed from RecipeForm, breaking recipe categorization

**Evidence**:
```typescript
// RecipeForm.tsx lines 55-78
const handleArrayChange = (
  field: 'ingredients' | 'instructions',  // ❌ 'tags' was removed
  index: number,
  value: string
) => { ... }
```

**Fix**:
```tsx
// 1. Restore 'tags' to field union types (lines 56, 66, 73)
const handleArrayChange = (
  field: 'ingredients' | 'instructions' | 'tags',
  index: number,
  value: string
) => { ... }

// 2. Restore SemanticTagInput component (add after Instructions card, before line 358)
import { SemanticTagInput } from './SemanticTagInput';

<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Tag className="w-5 h-5" />
      Tags
    </CardTitle>
    <CardDescription>
      Add tags to help categorize and discover your recipe. Tags are automatically grouped
      by type (cuisine, dietary, etc.)
    </CardDescription>
  </CardHeader>
  <CardContent>
    <SemanticTagInput
      selectedTags={formData.tags}
      onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
      placeholder="Type to search or add tags..."
      maxTags={20}
      showPopular
    />
  </CardContent>
</Card>

// 3. Update data submission (line 108)
tags: formData.tags.length > 0 ? JSON.stringify(formData.tags) : null,
```

**Files to modify**:
- `src/components/recipe/RecipeForm.tsx`

**Testing**:
- [ ] Can add tags to new recipe
- [ ] Can remove tags
- [ ] Tags saved to database
- [ ] Tags display on recipe page
- [ ] Tag search/filter works

---

### 2. Add Public/Private Toggle to Creation Form (30 mins)

**Problem**: Public/private toggle only shown when editing, not during creation

**Evidence**:
```tsx
// RecipeForm.tsx line 358
{recipe && (  // ❌ Only shown in edit mode
  <Card>
    <CardHeader>
      <CardTitle>Sharing Settings</CardTitle>
      ...
```

**Fix**:
```tsx
// Remove the conditional wrapper - show on both create and edit
<Card>
  <CardHeader>
    <CardTitle>Sharing Settings</CardTitle>
    <CardDescription>Control who can see this recipe</CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between space-x-4">
      <div className="flex items-center space-x-2">
        {formData.isPublic ? (
          <Globe className="w-5 h-5 text-primary" />
        ) : (
          <Lock className="w-5 h-5 text-muted-foreground" />
        )}
        <Label htmlFor="public-toggle" className="text-base">
          {formData.isPublic ? 'Public Recipe' : 'Private Recipe'}
        </Label>
      </div>
      <Switch
        id="public-toggle"
        checked={formData.isPublic}
        onCheckedChange={(checked) =>
          setFormData((prev) => ({ ...prev, isPublic: checked }))
        }
      />
    </div>
    <p className="text-sm text-muted-foreground mt-2">
      {formData.isPublic
        ? 'This recipe is visible to everyone and can be discovered by other users.'
        : 'This recipe is only visible to you. You can make it public later.'}
    </p>
  </CardContent>
</Card>
```

**Files to modify**:
- `src/components/recipe/RecipeForm.tsx` (lines 358-391)

**Testing**:
- [ ] Toggle visible on creation form
- [ ] Can create public recipe
- [ ] Can create private recipe
- [ ] Default is private (security best practice)

---

### 3. Prevent Tab Switching Data Loss (1 hour)

**Problem**: Switching between AI Upload and Detailed Form loses all entered data

**Fix Option A - Add Warning Dialog** (Quick fix):
```tsx
// src/app/recipes/new/page.tsx
'use client';

import { useState } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

export default function NewRecipePage() {
  const [activeTab, setActiveTab] = useState('ai');
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleTabChange = (newTab: string) => {
    if (hasUnsavedChanges && newTab !== activeTab) {
      setPendingTab(newTab);
    } else {
      setActiveTab(newTab);
    }
  };

  const confirmTabSwitch = () => {
    if (pendingTab) {
      setActiveTab(pendingTab);
      setPendingTab(null);
      setHasUnsavedChanges(false);
    }
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        {/* ... */}
      </Tabs>

      <AlertDialog open={!!pendingTab} onOpenChange={(open) => !open && setPendingTab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              Switching tabs will lose your current progress. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPendingTab(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmTabSwitch}>Switch Anyway</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

**Fix Option B - Shared State** (Better UX, more work):
```tsx
// Create shared context
const RecipeFormContext = createContext<{
  formData: Partial<Recipe>;
  setFormData: (data: Partial<Recipe>) => void;
}>({ formData: {}, setFormData: () => {} });

// Use context in both AIRecipeUploader and RecipeForm
```

**Files to modify**:
- `src/app/recipes/new/page.tsx`
- Optional: Create `src/contexts/RecipeFormContext.tsx`

**Testing**:
- [ ] Warning shows when switching with unsaved changes
- [ ] Can cancel tab switch
- [ ] Can confirm tab switch
- [ ] No warning when form is empty

---

## 🟡 HIGH PRIORITY - UX Improvements

### 4. Improve AI Upload Error Feedback (1 hour)

**Problem**: Generic errors don't help users recover

**Fix**:
```tsx
// src/components/recipe/AIRecipeUploader.tsx
const handleTextUpload = async () => {
  setIsLoading(true);
  setError(null);
  setSuccess(null);

  try {
    const result = await uploadRecipeWithAI({ text });

    if (result.success && result.recipe) {
      setSuccess('Recipe parsed successfully! Redirecting...');
      setTimeout(() => {
        router.push(`/recipes/${result.recipe.id}`);
      }, 1000);
    } else {
      // ✅ Better error handling
      let errorMessage = result.error || 'Failed to parse recipe';

      // Check for specific error types
      if (errorMessage.includes('ingredients')) {
        errorMessage = "Couldn't find ingredients. Try formatting like:\n- 2 cups flour\n- 1 cup sugar";
      } else if (errorMessage.includes('instructions')) {
        errorMessage = "Couldn't find instructions. Number your steps:\n1. Mix ingredients\n2. Bake";
      } else if (errorMessage.includes('rate limit')) {
        errorMessage = 'AI service is busy. Please try again in a moment.';
      }

      setError(errorMessage);

      // ✅ Suggest fallback
      setError(prev => prev + '\n\nTry the Detailed Form for manual entry.');
    }
  } catch (err) {
    console.error('Upload failed:', err);
    setError('An unexpected error occurred. Please try the Detailed Form instead.');
  } finally {
    setIsLoading(false);
  }
};
```

**Files to modify**:
- `src/components/recipe/AIRecipeUploader.tsx`

**Testing**:
- [ ] Specific error messages for common failures
- [ ] Suggests Detailed Form as fallback
- [ ] Error messages are user-friendly

---

### 5. Add Cuisine Autocomplete (30 mins)

**Problem**: Free text leads to inconsistent data

**Fix**:
```tsx
// src/components/recipe/RecipeForm.tsx
import { Combobox } from '@/components/ui/combobox';

const POPULAR_CUISINES = [
  'American', 'Italian', 'Mexican', 'Chinese', 'Japanese',
  'Thai', 'Indian', 'French', 'Mediterranean', 'Greek',
  'Spanish', 'Korean', 'Vietnamese', 'Middle Eastern',
  'Caribbean', 'African', 'Latin American', 'German',
  'British', 'Cajun', 'Creole', 'Fusion'
].sort();

// Replace Input with Combobox
<Label htmlFor="cuisine">Cuisine</Label>
<Combobox
  value={formData.cuisine}
  onChange={(value) => setFormData((prev) => ({ ...prev, cuisine: value }))}
  options={POPULAR_CUISINES.map(c => ({ label: c, value: c }))}
  placeholder="Select or type cuisine..."
  allowCustom
/>
```

**Files to modify**:
- `src/components/recipe/RecipeForm.tsx`

**Testing**:
- [ ] Can select from dropdown
- [ ] Can type custom cuisine
- [ ] Autocomplete works
- [ ] Data saves correctly

---

### 6. Add AI Processing Time Indicator (30 mins)

**Problem**: No indication of how long AI will take

**Fix**:
```tsx
// src/components/recipe/AIRecipeUploader.tsx
const [estimatedTime, setEstimatedTime] = useState(0);

const handleTextUpload = async () => {
  setIsLoading(true);
  setEstimatedTime(15); // Start at 15 seconds

  // Countdown timer
  const timer = setInterval(() => {
    setEstimatedTime(prev => Math.max(0, prev - 1));
  }, 1000);

  try {
    const result = await uploadRecipeWithAI({ text });
    // ...
  } finally {
    clearInterval(timer);
    setIsLoading(false);
  }
};

// In JSX
{isLoading && (
  <div className="flex items-center gap-2">
    <Loader2 className="w-4 h-4 animate-spin" />
    <span>
      Parsing with AI... ~{estimatedTime}s remaining
    </span>
  </div>
)}
```

**Files to modify**:
- `src/components/recipe/AIRecipeUploader.tsx`

**Testing**:
- [ ] Countdown shows during AI processing
- [ ] Doesn't go negative
- [ ] Clears after completion

---

## 🟢 MEDIUM PRIORITY - Future Enhancements

### 7. Add Responsive Grid Breakpoints (30 mins)

**Fix**:
```tsx
// src/components/recipe/RecipeForm.tsx
// Line 178: Change 2-column grid
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

// Line 207: Change 3-column grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

### 8. Add Character Limits (30 mins)

**Fix**:
```tsx
<Input
  id="name"
  value={formData.name}
  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
  placeholder="e.g., Chocolate Chip Cookies"
  maxLength={200}
  required
/>
<p className="text-xs text-muted-foreground mt-1">
  {formData.name.length}/200 characters
</p>
```

### 9. Add Ingredient/Instruction Limits (30 mins)

**Fix**:
```tsx
const MAX_INGREDIENTS = 30;
const MAX_INSTRUCTIONS = 30;

const addArrayItem = (field: 'ingredients' | 'instructions') => {
  if (field === 'ingredients' && formData.ingredients.length >= MAX_INGREDIENTS) {
    toast.error(`Maximum ${MAX_INGREDIENTS} ingredients allowed`);
    return;
  }
  if (field === 'instructions' && formData.instructions.length >= MAX_INSTRUCTIONS) {
    toast.error(`Maximum ${MAX_INSTRUCTIONS} steps allowed`);
    return;
  }
  setFormData((prev) => ({
    ...prev,
    [field]: [...prev[field], ''],
  }));
};
```

### 10. Add Preview Feature (1 hour)

**Fix**:
```tsx
// Add "Preview" button after AI parse
<Button onClick={handlePreview} variant="outline">
  Preview Recipe
</Button>

// Show preview dialog with parsed data
<Dialog open={showPreview}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Recipe Preview</DialogTitle>
    </DialogHeader>
    <div>
      <h3>{parsedRecipe.name}</h3>
      <p>Ingredients: {parsedRecipe.ingredients.length}</p>
      <p>Instructions: {parsedRecipe.instructions.length}</p>
      {/* ... */}
    </div>
    <DialogFooter>
      <Button onClick={handleEdit}>Edit in Detailed Form</Button>
      <Button onClick={handleSave}>Save Recipe</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Testing Checklist

### Critical Fixes Testing
- [ ] Tags can be added to new recipes
- [ ] Tags display on recipe page
- [ ] Public/private toggle works on creation
- [ ] Tab switching shows warning dialog
- [ ] AI errors are user-friendly

### Regression Testing
- [ ] Existing recipes still load
- [ ] Recipe editing still works
- [ ] Image upload works
- [ ] All validation still works
- [ ] Mobile layout not broken

### Integration Testing
- [ ] AI Upload → Detailed Form flow
- [ ] Recipe creation → Display flow
- [ ] Tags → Search/Filter flow

---

## Deployment Plan

1. **Phase 1 - Critical Fixes** (Day 1)
   - Restore tag input
   - Add public/private toggle
   - Add tab switch warning

2. **Phase 2 - UX Improvements** (Day 2)
   - Better AI errors
   - Cuisine autocomplete
   - Processing time indicator

3. **Phase 3 - Polish** (Day 3-5)
   - Responsive grids
   - Character limits
   - Preview feature

4. **Testing & Release** (Day 6-7)
   - Full regression testing
   - Mobile device testing
   - Production deployment

---

## Success Criteria

- [ ] All critical issues resolved
- [ ] No data loss when switching tabs
- [ ] Tags work end-to-end
- [ ] Public/private on creation
- [ ] Better error messages
- [ ] 95%+ form completion rate (track in analytics)
- [ ] < 5% error rate on AI uploads

---

**Next Steps**:
1. Review with PM
2. Prioritize fixes
3. Assign to engineers
4. Schedule regression testing
5. Update UAT test suite

**Estimated Total Effort**: 8-12 hours for critical fixes, 2-3 days for full polish
