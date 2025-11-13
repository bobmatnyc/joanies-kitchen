# System Recipe Ingestion - Manual Test Checklist

**Tester**: _________________
**Date**: _________________
**Browser**: _________________
**Admin User**: _________________

---

## Pre-Test Setup

- [ ] Server running on `http://localhost:3002`
- [ ] Logged in as admin user
- [ ] Browser DevTools open (Console tab)
- [ ] Ready to take screenshots if needed

---

## Test 1: Navigation Link (2 min)

**URL**: `http://localhost:3002/admin`

- [ ] Admin page loads successfully
- [ ] Locate "Quick Actions" section
- [ ] Find "System Recipe Ingest" button
- [ ] Button has **purple background** (bg-purple-600)
- [ ] Click the button
- [ ] URL changes to `/admin/system-recipe-ingest`
- [ ] Page loads without redirect loop

**Result**: ✅ PASS / ❌ FAIL
**Notes**: ___________________________________________________

---

## Test 2: Page Load & Server Function Error (2 min)

**URL**: `http://localhost:3002/admin/system-recipe-ingest`

- [ ] Page loads successfully
- [ ] Main heading: "System Recipe Ingestion"
- [ ] Two tabs visible: "URL Input" and "Text Input"
- [ ] **Check console**: NO "Server Functions cannot be called during initial render" error
- [ ] Wait 2 seconds for async operations
- [ ] **Check console again**: No errors appear
- [ ] Chefs dropdown loads (watch Network tab for API call)

**Console Output**:
```
Expected: Clean (no errors)
Actual: _______________________________________________
```

**Result**: ✅ PASS / ❌ FAIL
**Notes**: ___________________________________________________

---

## Test 3: URL Input - Valid Recipe (5 min)

**Tab**: URL Input

### Step 1: Use Example URL
- [ ] Click "AllRecipes: Chocolate Chip Cookies" example button
- [ ] URL field populated: `https://www.allrecipes.com/recipe/10813/...`
- [ ] Click "Scrape and Parse Recipe" button

### Step 2: Processing
- [ ] Loading spinner appears
- [ ] Message: "Scraping and parsing recipe..."
- [ ] Wait 15-45 seconds
- [ ] **Check console**: No errors during processing

### Step 3: Preview
- [ ] Preview section appears
- [ ] Recipe name field filled (e.g., "Best Chocolate Chip Cookies")
- [ ] Description field has content
- [ ] Ingredients JSON textarea has content (starts with `[`)
- [ ] Instructions JSON textarea has content (starts with `[`)
- [ ] Prep time field has number (e.g., 15)
- [ ] Cook time field has number (e.g., 11)
- [ ] Servings field has number (e.g., 48)
- [ ] Toast notification: "Recipe processed successfully!"
- [ ] Toast notification: "Detection confidence: ____%"

### Step 4: Data Type Check
**Open Console and run**:
```javascript
// Check ingredients
const ingredients = document.querySelector('#ingredients').value;
console.log('Ingredients type:', typeof ingredients);
console.log('Is array?', ingredients.startsWith('['));

// Check instructions
const instructions = document.querySelector('#instructions').value;
console.log('Instructions type:', typeof instructions);
console.log('Is array?', instructions.startsWith('['));

// Check numeric fields
const prepTime = document.querySelector('#prep-time').value;
const cookTime = document.querySelector('#cook-time').value;
const servings = document.querySelector('#servings').value;
console.log('Prep time:', prepTime, 'Type:', typeof prepTime);
console.log('Cook time:', cookTime, 'Type:', typeof cookTime);
console.log('Servings:', servings, 'Type:', typeof servings);
```

**Console Output**:
```
Expected: Ingredients and instructions are JSON strings (for editing)
          Numeric fields are strings (DOM inputs are always strings)
          BUT they will be converted to numbers on save
Actual: _______________________________________________
```

- [ ] Ingredients look valid (array of objects)
- [ ] Instructions look valid (array of strings)
- [ ] No console errors or warnings

**Result**: ✅ PASS / ❌ FAIL
**Notes**: ___________________________________________________

---

## Test 4: Text Input - Valid Recipe (5 min)

**Tab**: Text Input

### Step 1: Load Example
- [ ] Click "Text Input" tab
- [ ] Click "Load example recipe text" button
- [ ] Textarea fills with chocolate chip cookie recipe

### Step 2: Parse
- [ ] Click "Parse Recipe" button
- [ ] Loading spinner appears
- [ ] Message: "Parsing recipe..."
- [ ] Wait 10-30 seconds
- [ ] **Check console**: No errors

### Step 3: Preview
- [ ] Preview section appears
- [ ] Recipe name: "Chocolate Chip Cookies"
- [ ] Ingredients populated
- [ ] Instructions populated
- [ ] Toast: "Detection confidence: ____%"
- [ ] Confidence is > 80%

**Result**: ✅ PASS / ❌ FAIL
**Notes**: ___________________________________________________

---

## Test 5: Edge Cases (5 min)

### 5.1: Empty URL
- [ ] URL Input tab
- [ ] Leave URL field empty
- [ ] Click "Scrape and Parse Recipe"
- [ ] Toast error: "Please enter a URL"
- [ ] No console errors

**Result**: ✅ PASS / ❌ FAIL

### 5.2: Invalid URL Format
- [ ] Enter: `not-a-valid-url`
- [ ] Click "Scrape and Parse Recipe"
- [ ] Error message appears
- [ ] Message mentions "Invalid URL format" or similar

**Result**: ✅ PASS / ❌ FAIL

### 5.3: Non-Recipe Text
- [ ] Text Input tab
- [ ] Paste: "This is just a blog post about my favorite restaurants. I love Italian food."
- [ ] Click "Parse Recipe"
- [ ] Wait for processing
- [ ] Error message: "No recipe found in the provided text"
- [ ] Preview does NOT appear

**Result**: ✅ PASS / ❌ FAIL

### 5.4: Short Text
- [ ] Text Input tab
- [ ] Enter: "Cookies are great"
- [ ] Click "Parse Recipe"
- [ ] Error: "Text is too short to be a recipe (minimum 100 characters)"

**Result**: ✅ PASS / ❌ FAIL

### 5.5: Missing Required Field
- [ ] Parse any valid recipe
- [ ] In preview, **clear the Recipe Name field completely**
- [ ] Click "Save System Recipe"
- [ ] Error: "Recipe name is required"
- [ ] Stays on preview page (doesn't save)

**Result**: ✅ PASS / ❌ FAIL

---

## Test 6: Save Functionality (5 min)

**Prerequisites**: Have a recipe parsed and in preview

### Step 1: Edit Recipe
- [ ] Change recipe name to: "[TEST] Chocolate Chip Cookies"
- [ ] Edit prep time to: 25
- [ ] Edit tags to: "test, cookies, dessert"
- [ ] Select license: "Public Domain"
- [ ] Select a chef (if available in dropdown)

### Step 2: Save
- [ ] Click "Save System Recipe" button
- [ ] Loading spinner appears
- [ ] Message: "Saving recipe to database..."
- [ ] Wait 1-3 seconds
- [ ] **Check console**: No errors

### Step 3: Success
- [ ] Success page appears
- [ ] Green checkmark icon visible
- [ ] Message: "Recipe Saved Successfully!"
- [ ] Two buttons: "View Recipe" and "Ingest Another Recipe"

### Step 4: View Recipe
- [ ] Click "View Recipe" button
- [ ] Recipe page loads
- [ ] Recipe name: "[TEST] Chocolate Chip Cookies"
- [ ] Prep time: 25 minutes (check the display)
- [ ] Tags include: "test", "cookies", "dessert"
- [ ] **"Shared" badge visible** (indicates system recipe)
- [ ] OR **Lock icon** with "Shared" text

### Step 5: Verify in Admin
- [ ] Navigate back to `/admin`
- [ ] Find the recipe in the list
- [ ] **"System" badge visible** (blue badge)
- [ ] Recipe is marked as system recipe

**Result**: ✅ PASS / ❌ FAIL
**Notes**: ___________________________________________________

---

## Test 7: Data Verification (Optional - Advanced)

**After saving a recipe**, verify in database or admin panel:

- [ ] `is_system_recipe` = `true`
- [ ] `is_public` = `true`
- [ ] `prep_time` is a **number** (not string)
- [ ] `cook_time` is a **number** (not string)
- [ ] `servings` is a **number** (not string)
- [ ] `ingredients` is an **array of objects**
- [ ] `instructions` is an **array of strings**
- [ ] `tags` is an **array of strings**

**Database Query** (optional):
```sql
SELECT
  name,
  is_system_recipe,
  is_public,
  prep_time,
  cook_time,
  servings,
  ingredients,
  instructions
FROM recipes
WHERE name LIKE '%[TEST]%'
ORDER BY created_at DESC
LIMIT 1;
```

**Result**: ✅ PASS / ❌ FAIL
**Notes**: ___________________________________________________

---

## Test 8: Reset Functionality (2 min)

**Prerequisites**: On success page after saving

- [ ] Click "Ingest Another Recipe" button
- [ ] Page returns to input state
- [ ] URL field is empty
- [ ] Text field is empty
- [ ] "URL Input" tab is active
- [ ] All state cleared

**Result**: ✅ PASS / ❌ FAIL
**Notes**: ___________________________________________________

---

## Console Error Check

**Review console output for entire test session**:

### Expected (OK):
- [ ] Toast notifications (info level)
- [ ] Network requests to `/api/...`
- [ ] State updates (if React DevTools installed)

### NOT Expected (ERRORS):
- [ ] ❌ "Server Functions cannot be called during initial render"
- [ ] ❌ "Converting string to number"
- [ ] ❌ "Invalid ingredient format"
- [ ] ❌ Type errors
- [ ] ❌ Unhandled promise rejections
- [ ] ❌ React hydration errors

**Console Status**: ✅ CLEAN / ⚠️ WARNINGS / ❌ ERRORS

**Error Details** (if any):
```
___________________________________________________________
___________________________________________________________
___________________________________________________________
```

---

## Final Summary

| Test | Result | Time | Notes |
|------|--------|------|-------|
| 1. Navigation Link | ☐ Pass ☐ Fail | ___min | |
| 2. Page Load | ☐ Pass ☐ Fail | ___min | |
| 3. URL Input | ☐ Pass ☐ Fail | ___min | |
| 4. Text Input | ☐ Pass ☐ Fail | ___min | |
| 5. Edge Cases | ☐ Pass ☐ Fail | ___min | |
| 6. Save Functionality | ☐ Pass ☐ Fail | ___min | |
| 7. Data Verification | ☐ Pass ☐ Fail ☐ Skip | ___min | |
| 8. Reset | ☐ Pass ☐ Fail | ___min | |

**Total Tests**: ___/8 passed
**Total Time**: ___minutes
**Overall Status**: ☐ PASS ☐ FAIL

---

## Issues Found

### Critical Issues (Blocking)
```
1. ___________________________________________________________
2. ___________________________________________________________
```

### Major Issues (Should Fix)
```
1. ___________________________________________________________
2. ___________________________________________________________
```

### Minor Issues (Nice to Fix)
```
1. ___________________________________________________________
2. ___________________________________________________________
```

---

## Screenshots

**Attach screenshots for**:
1. [ ] Navigation button (purple)
2. [ ] Page load (two tabs)
3. [ ] Preview with populated data
4. [ ] Success page
5. [ ] Recipe page with "Shared" badge
6. [ ] Admin page with "System" badge
7. [ ] Any errors encountered

---

## Sign-off

**Tester Signature**: _________________
**Date Completed**: _________________
**Overall Verdict**: ☐ APPROVED ☐ REJECTED ☐ NEEDS FIXES

**Recommendation**:
```
___________________________________________________________
___________________________________________________________
___________________________________________________________
```

---

## Reference

**Code Review Report**: `TEST-REPORT-SYSTEM-RECIPE-INGEST-FIXES.md`
**Test Summary**: `TEST-SUMMARY-SYSTEM-RECIPE-FIXES.md`
**UAT Report**: `test-screenshots/UAT-REPORT-SYSTEM-RECIPE-INGEST.md`
