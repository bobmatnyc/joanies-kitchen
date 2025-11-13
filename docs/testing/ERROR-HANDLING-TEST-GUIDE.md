# Error Handling Test Guide

Quick reference for testing all error handling improvements.

## Testing Scenarios

### 1. Recipe Search Timeout

**Test:** API timeout handling
**Steps:**
1. Navigate to `/fridge`
2. Select 20+ ingredients
3. Click "Find Recipes"
4. Wait for timeout (10 seconds max per attempt)

**Expected Result:**
- Loading spinner shows for max 30 seconds (3 retries × 10s)
- Error message appears: "The search is taking longer than expected..."
- "Try Again" button available
- "Change Ingredients" button available
- No infinite loading

### 2. Empty Ingredient Validation

**Test:** Prevent search with no ingredients
**Steps:**
1. Navigate directly to `/fridge/results?ingredients=`
2. Or navigate to `/fridge/results` without query params

**Expected Result:**
- Automatic redirect to `/fridge`
- Console warning: "No ingredients provided, redirecting to /fridge"
- No API call made

### 3. Form Validation - Inventory

**Test:** Client-side form validation
**Steps:**
1. Navigate to `/inventory`
2. Try to submit without selecting ingredient
3. Try to submit with quantity = 0
4. Try to submit without unit
5. Try to submit with quantity = 99999

**Expected Results:**
- Submit button disabled until all required fields valid
- Error messages appear below invalid fields
- Red border on invalid fields
- Error messages:
  - "Please select an ingredient from the suggestions"
  - "Quantity must be greater than 0"
  - "Please enter a unit (e.g., lbs, pieces, cups)"
  - "Quantity seems too large. Please check your input"

### 4. Network Error Recovery

**Test:** Handle network failures gracefully
**Steps:**
1. Disconnect from internet
2. Navigate to `/fridge/results?ingredients=tomato,basil`
3. Observe error handling

**Expected Result:**
- Error message: "Network error. Please check your internet connection..."
- "Try Again" button available
- Error logged to console
- No crash or blank screen

### 5. Autocomplete Search Error

**Test:** Handle autocomplete failures
**Steps:**
1. Navigate to `/inventory`
2. Open browser DevTools Console
3. Type in ingredient field (triggers autocomplete)
4. Check for error handling if network fails

**Expected Result:**
- Graceful degradation if autocomplete fails
- Error logged to console
- User can still type and submit (if they know ingredient name)

## Manual Testing Checklist

### Before Testing
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors
- [ ] No console errors on page load

### Results Page (`/fridge/results`)
- [ ] Redirects to `/fridge` if no ingredients
- [ ] Shows loading spinner during search
- [ ] Displays recipes on success
- [ ] Shows error message on failure
- [ ] "Try Again" button works
- [ ] "Change Ingredients" button navigates to `/fridge`
- [ ] No infinite loading (max 30 seconds)
- [ ] Retry count visible in dev mode error details

### Inventory Form (`/inventory`)
- [ ] Ingredient field shows required asterisk (*)
- [ ] Quantity field shows required asterisk (*)
- [ ] Unit field shows required asterisk (*)
- [ ] Storage Location field shows required asterisk (*)
- [ ] Submit button disabled when form invalid
- [ ] Error messages appear below invalid fields
- [ ] Red borders on invalid fields
- [ ] Errors clear when user types
- [ ] Success toast appears on successful add
- [ ] Error toast appears on failure
- [ ] Form resets after successful submission

### Network Conditions
- [ ] Works on fast connection
- [ ] Handles slow connection (retry succeeds)
- [ ] Handles no connection (error displayed)
- [ ] Handles intermittent connection (retry succeeds)

### Edge Cases
- [ ] Empty ingredient list
- [ ] Single ingredient search
- [ ] 50 ingredient search (maximum)
- [ ] 51+ ingredients (validation error)
- [ ] Very long ingredient names (>100 chars)
- [ ] Special characters in ingredient names
- [ ] Negative quantities
- [ ] Zero quantities
- [ ] Very large quantities (>10,000)

## Automated Testing

### Unit Tests (Future)
```typescript
describe('withTimeout', () => {
  it('should timeout after specified duration', async () => {
    const promise = new Promise((resolve) => setTimeout(resolve, 5000));
    await expect(withTimeout(promise, 1000)).rejects.toThrow('timeout');
  });
});

describe('withRetry', () => {
  it('should retry on failure', async () => {
    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error('fail');
      return 'success';
    };

    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });
});
```

### Integration Tests (Future)
```typescript
describe('Recipe Search Error Handling', () => {
  it('should handle empty ingredients', async () => {
    const result = await searchRecipesByIngredients([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Validation error');
  });

  it('should handle network timeout', async () => {
    // Mock slow network
    const result = await searchRecipesByIngredients(['tomato']);
    // Verify timeout handling
  });
});
```

## Performance Benchmarks

### Target Metrics
- **API Timeout:** 10 seconds per attempt
- **Max Total Wait:** 30 seconds (3 retries)
- **Retry Delays:** 1s, 2s, 4s (exponential backoff)
- **Circuit Breaker:** Opens after 5 failures in 60 seconds

### Monitoring
```javascript
// In production, track these metrics:
- Average retry count per search
- Percentage of searches requiring retry
- Timeout occurrence rate
- Circuit breaker activation frequency
```

## Browser Compatibility

### Tested Browsers
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Accessibility Testing

### Screen Reader Testing
- [ ] Error messages announced
- [ ] Form validation errors announced
- [ ] ARIA attributes correct
- [ ] Focus management on errors

### Keyboard Navigation
- [ ] All error actions accessible via keyboard
- [ ] Tab order logical
- [ ] Enter/Space activate buttons
- [ ] Escape closes modals/dropdowns

## Common Issues and Solutions

### Issue: Retry loop
**Symptom:** Page keeps retrying indefinitely
**Solution:** Check circuit breaker is working
**Debug:** Look for "Circuit breaker is OPEN" in console

### Issue: No error message
**Symptom:** Blank screen on error
**Solution:** Check ErrorFallback component is imported
**Debug:** Check browser console for uncaught errors

### Issue: Form submits despite errors
**Symptom:** Invalid form data sent to server
**Solution:** Check `validateForm()` is called before submit
**Debug:** Add breakpoint in `handleSubmit()`

### Issue: Timeout too short
**Symptom:** Legitimate requests timing out
**Solution:** Increase timeout duration in `withTimeout()`
**Debug:** Check network tab for actual request duration

## DevTools Tips

### Console Filtering
```javascript
// Filter by error handling logs
filter: "Recipe search error|Retry attempt|Cache"
```

### Network Throttling
1. Open DevTools > Network tab
2. Select "Slow 3G" or "Offline"
3. Test error handling

### Performance Monitoring
1. Open DevTools > Performance tab
2. Record during search
3. Look for timeout events
4. Check retry timing

## Success Criteria

All checks must pass:
- ✅ No infinite loading states
- ✅ All errors show user-friendly messages
- ✅ All forms validate before submission
- ✅ Network failures handled gracefully
- ✅ 10-second max wait time per attempt
- ✅ "Try Again" functionality works
- ✅ No blank screens on errors
- ✅ All edge cases covered
- ✅ Accessibility requirements met
- ✅ Build passes without errors

---

**Last Updated:** 2025-11-12
**Version:** 0.7.8
