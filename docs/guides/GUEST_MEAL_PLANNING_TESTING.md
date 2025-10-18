# Guest Meal Planning - Testing Guide

## Quick Test Script

### Test 1: Basic Guest Meal Creation
**Expected Time**: 3 minutes

1. **Open incognito/private window** (to simulate guest user)
2. Navigate to http://localhost:3002/meals
3. Verify: Page loads, shows "No meals yet" empty state
4. Click "Create New Meal"
5. Fill in meal details:
   - Name: "Test Dinner"
   - Description: "My test meal"
   - Type: "Dinner"
   - Serves: 4
6. Add 2-3 recipes from the dialog
7. Click "Create Meal"
8. **Expected**:
   - Toast: "Meal saved in browser!"
   - Dialog appears: "Sign in to Save Your Work"
   - Shows: "1 meal" count
9. Click "Continue as Guest"
10. **Expected**: Redirected to meal detail page
11. Refresh the page
12. **Expected**: Meal still appears (data persisted)

### Test 2: Guest Shopping List
**Expected Time**: 2 minutes

1. From meal detail page (from Test 1)
2. Click "Generate Shopping List"
3. **Expected**:
   - Toast: "Shopping list generated!"
   - Shopping list section shows items
   - Items grouped by ingredient
4. Refresh page
5. **Expected**: Shopping list still visible

### Test 3: Guest Data Persistence
**Expected Time**: 1 minute

1. Navigate to /meals
2. **Expected**: See "Test Dinner" meal card
3. **Expected**: Guest banner: "Your 1 meal is stored in your browser"
4. Close browser tab
5. Reopen http://localhost:3002/meals
6. **Expected**: Meal still appears

### Test 4: Data Migration
**Expected Time**: 4 minutes

1. **Still in incognito/private window** with guest meal
2. Click "Sign In to Save" button (on guest banner)
3. Complete sign-in process
4. **Expected**: After sign-in, migration dialog appears
5. **Expected**: Dialog shows "Found in your browser: 1 meal, 1 shopping list"
6. Click "Save to Account"
7. **Expected**:
   - Loading state: "Migrating..."
   - Success: "Successfully migrated 1 meal!"
   - Check icon appears
   - Auto-redirect to /meals
8. **Expected**: Meal now shows without guest banner
9. Refresh page
10. **Expected**: Meal persists (now in database)
11. Open browser DevTools → Application → Local Storage
12. **Expected**: No `guest_meals` key (data cleared)

### Test 5: Filter Guest Meals
**Expected Time**: 2 minutes

1. As guest, create 3 meals:
   - "Breakfast Bowl" (Type: Breakfast)
   - "Lunch Salad" (Type: Lunch)
   - "Dinner Party" (Type: Dinner)
2. Go to /meals
3. Use filter dropdown: Select "Breakfast"
4. **Expected**: Only "Breakfast Bowl" shows
5. Select "All Types"
6. **Expected**: All 3 meals show

### Test 6: Skip Migration
**Expected Time**: 3 minutes

1. Create guest meal
2. Sign in
3. When migration dialog appears, click "Keep in Browser"
4. **Expected**: Dialog closes
5. Open DevTools → Local Storage
6. **Expected**: `guest_meals` still exists
7. Go to /meals
8. **Expected**: Guest banner still shows
9. Refresh page
10. **Expected**: Guest meal still appears

### Test 7: Discard Guest Data
**Expected Time**: 2 minutes

1. Create guest meal
2. Sign in
3. When migration dialog appears, click "Discard"
4. Confirm the alert
5. **Expected**:
   - Toast: "Guest data cleared"
   - Dialog closes
   - Redirected to /meals
6. **Expected**: No guest meals, no banner
7. Check Local Storage
8. **Expected**: No `guest_meals` key

## Browser Compatibility Tests

### Chrome/Edge
- [ ] localStorage works
- [ ] Migration works
- [ ] No console errors

### Firefox
- [ ] localStorage works
- [ ] Migration works
- [ ] No console errors

### Safari
- [ ] localStorage works
- [ ] Migration works
- [ ] Private mode gracefully fails
- [ ] No console errors

### Mobile Safari (iOS)
- [ ] Touch targets are 44x44px minimum
- [ ] Guest banner readable
- [ ] Migration dialog usable
- [ ] No horizontal scroll

### Mobile Chrome (Android)
- [ ] Touch targets adequate
- [ ] localStorage works
- [ ] Migration smooth

## Edge Case Tests

### Test: Safari Private Mode
1. Open Safari private window
2. Try to create meal
3. **Expected**: Should fail gracefully (localStorage unavailable)

### Test: Multiple Tabs
1. Open tab 1: Create guest meal
2. Open tab 2: Navigate to /meals
3. **Expected**: Tab 2 doesn't show meal immediately (no cross-tab sync)
4. Refresh tab 2
5. **Expected**: Now shows meal (loaded from localStorage)

### Test: Malformed localStorage Data
1. Open DevTools → Console
2. Run: `localStorage.setItem('guest_meals', 'invalid json')`
3. Navigate to /meals
4. **Expected**: Page loads, shows empty state, no crash

### Test: Network Failure During Migration
1. Create guest meal
2. Open DevTools → Network tab
3. Set throttling to "Offline"
4. Sign in and attempt migration
5. **Expected**: Error toast, data stays in localStorage

### Test: Large Guest Dataset
1. Create 20 guest meals
2. Verify all appear on /meals
3. Migrate all 20
4. **Expected**: All migrate successfully
5. Check migration time (should be <30 seconds)

## Automated Test Commands

### Type Check
```bash
npx tsc --noEmit
```

### Build Check
```bash
pnpm build
```

### Start Dev Server
```bash
pnpm dev
```

## Debugging Tips

### Check localStorage Contents
```javascript
// In browser console
console.log(JSON.parse(localStorage.getItem('guest_meals')))
console.log(JSON.parse(localStorage.getItem('guest_meal_recipes')))
console.log(JSON.parse(localStorage.getItem('guest_shopping_lists')))
```

### Clear All Guest Data
```javascript
// In browser console
localStorage.removeItem('guest_meals')
localStorage.removeItem('guest_meal_recipes')
localStorage.removeItem('guest_shopping_lists')
```

### Check Migration Flag
```javascript
// In browser console
console.log(sessionStorage.getItem('has_guest_data'))
```

### Trigger Migration Dialog Manually
```javascript
// In browser console (when signed in)
sessionStorage.setItem('has_guest_data', 'true')
// Refresh page
```

## Common Issues

### Issue: Migration dialog doesn't appear
**Check**:
- sessionStorage has `has_guest_data: 'true'`
- localStorage has guest_meals
- User is authenticated (userId present)

### Issue: Guest meals not persisting
**Check**:
- localStorage is available (not private mode)
- No browser storage quota errors in console
- Data actually saved (check DevTools)

### Issue: Shopping list not generating
**Check**:
- Meal has recipes
- Recipes have ingredients
- No console errors

### Issue: Type errors
**Check**:
- Run `npx tsc --noEmit`
- Check any cast overrides are correct

## Performance Benchmarks

### Expected Performance
- Guest meal creation: <100ms
- Migration (5 meals): <5 seconds
- Migration (20 meals): <30 seconds
- localStorage read: <10ms
- Shopping list generation: <500ms

### Performance Testing
```javascript
// In browser console
console.time('migration')
// Perform migration
console.timeEnd('migration')
```

## Reporting Issues

When reporting issues, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Console errors (screenshot)
5. localStorage contents (sanitized)
6. Network tab (if migration issue)

## Success Metrics

After testing, confirm:
- [ ] All 7 main tests pass
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Migration completes successfully
- [ ] localStorage cleared after migration
- [ ] Guest banner shows/hides correctly
- [ ] Data persists on refresh
- [ ] Works in incognito mode
- [ ] Mobile-friendly (tested on real device)

---

**Last Updated**: 2025-10-18
**Testing Time**: ~30 minutes for complete suite
