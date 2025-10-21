# Functional Test Plan - Task 7.2
## Fridge Flow and Mobile Experience Testing

**Test Execution Date**: 2025-10-21
**Tester**: Web QA Agent
**Application**: Joanie's Kitchen - Zero-Waste Recipe Platform
**Version**: 0.45.0 (Mobile Parity Release)
**Environment**: Development (http://localhost:3002)

---

## Executive Summary

This test plan covers comprehensive functional testing of the core fridge-to-recipe user journey and mobile experience validation across multiple device sizes and browsers. The goal is to ensure launch readiness for the mobile parity release.

**Critical Success Factors**:
- Fridge flow works seamlessly for new and signed-in users
- Mobile experience is smooth across all target device sizes (375px to 768px)
- No blocking bugs for launch
- Performance targets met (<500ms fridge search, <2s recipe page load)

---

## Test Scope

### In Scope
1. **Fridge Flow Testing**: Complete journey from ingredient entry to recipe selection
2. **Mobile Experience**: Responsive layouts, touch targets, navigation
3. **Browser Compatibility**: Chrome, Safari, Firefox (desktop + mobile)
4. **Performance**: Search response times, page load metrics

### Out of Scope
- Authentication flows (covered in separate testing)
- Recipe creation/editing features
- Meal planning functionality
- Admin features

---

## Test Environments

### Development Environment
- **URL**: http://localhost:3002
- **Database**: Neon PostgreSQL (development)
- **Auth**: Clerk (dual-environment: dev + production)
- **AI**: OpenRouter API (Gemini 2.0 Flash)

### Browser Matrix
| Browser | Desktop Version | Mobile Version | Priority |
|---------|----------------|----------------|----------|
| Chrome | Latest (130+) | Android/iOS Latest | 🔴 Critical |
| Safari | Latest (17+) | iOS Latest | 🔴 Critical |
| Firefox | Latest (120+) | Android Latest | 🟡 High |

### Device/Viewport Matrix
| Device Type | Width | Height | Target Devices |
|-------------|-------|--------|----------------|
| Mobile Small | 375px | 667px | iPhone SE, iPhone 8 |
| Mobile Standard | 390px | 844px | iPhone 14, iPhone 15 |
| Mobile Large | 430px | 932px | iPhone 14 Pro Max |
| Tablet | 768px | 1024px | iPad, iPad Mini |
| Desktop Small | 1024px | 768px | Small laptops |
| Desktop Large | 1920px | 1080px | Standard desktop |

---

## Test Cases

## Section 1: Fridge Flow Testing (Critical Path)

### 1.1 New User - First Time Experience

**Objective**: Verify that a new, unauthenticated user can successfully complete the fridge-to-recipe journey

**Test ID**: FRIDGE-001
**Priority**: 🔴 Critical
**Prerequisites**: None (fresh browser session)

**Test Steps**:

1. **Homepage Landing**
   - Navigate to http://localhost:3002
   - Verify homepage loads successfully
   - Verify hero section displays "Joanie's Kitchen" heading
   - Verify "What's in your fridge?" FridgeInput component is visible
   - Verify placeholder text: "What's in your fridge? (e.g., chicken, rice, carrots)"

2. **Ingredient Entry - Simple Input**
   - Click on the fridge input field
   - Type: "chicken, rice, onions, garlic, tomatoes"
   - Verify input accepts comma-separated values
   - Verify text is visible and readable
   - Press Enter key OR click "Find Recipes" button

3. **Search Execution**
   - Verify loading state appears (spinner + "Searching...")
   - Verify navigation to /fridge/results?ingredients=chicken,rice,onions,garlic,tomatoes
   - Verify no errors in browser console

4. **Results Page Display**
   - Verify "Recipe Matches" heading appears
   - Verify "Found X recipes using your ingredients" subheading
   - Verify selected ingredients displayed as badge chips with checkmarks
   - Verify each ingredient chip shows: chicken, rice, onions, garlic, tomatoes
   - Verify recipe cards display in responsive grid

5. **Recipe Card Analysis**
   - Verify each recipe shows match percentage badge (e.g., "85% Match")
   - Verify match percentage color coding:
     - Green badge for 90%+ matches
     - Yellow badge for 70-89% matches
     - Orange badge for <70% matches
   - Verify "You Have: X / Y" indicator below each card
   - Verify "X missing" indicator when applicable

6. **Filter and Sort Controls**
   - Verify "Sort by:" dropdown with options:
     - Best Match (default)
     - Fewest Missing
     - Cook Time
   - Verify "Min Match:" filter with options:
     - All Matches (default)
     - 50%+
     - 70%+
     - 90%+
   - Change sort to "Fewest Missing" - verify recipe order changes
   - Change filter to "70%+" - verify only high-match recipes shown

7. **Recipe Selection**
   - Click on a recipe card with 80%+ match
   - Verify navigation to recipe detail page (/recipes/[id])
   - Verify recipe displays correctly
   - Verify "Inventory Match" section exists (if implemented)

**Expected Results**:
- ✅ All steps complete without errors
- ✅ Search completes in <500ms
- ✅ Results page loads in <2s
- ✅ Recipe cards display match data accurately
- ✅ Filters work as expected
- ✅ No console errors

**Pass Criteria**: All expected results met

---

### 1.2 Signed-In User - Inventory Tracking

**Objective**: Verify that authenticated users can use personal inventory for recipe matching

**Test ID**: FRIDGE-002
**Priority**: 🔴 Critical
**Prerequisites**: User account created, signed in to application

**Test Steps**:

1. **Sign In**
   - Navigate to http://localhost:3002
   - Click "Sign In" button
   - Complete Clerk authentication flow
   - Verify successful redirect to homepage
   - Verify user profile icon/name appears in header

2. **Navigate to Fridge Page**
   - Click "What's in Your Fridge" CTA button OR
   - Click on "Cook From Your Fridge" card
   - Verify navigation to /fridge
   - Verify page heading: "What's in Your Fridge?"

3. **Fridge Inventory Management (if implemented)**
   - Check if personal inventory section exists
   - If exists:
     - Add ingredients to inventory: "salmon, quinoa, kale, lemon"
     - Verify ingredients persist on page refresh
     - Verify "Search from inventory" option available
   - If not implemented:
     - Use standard fridge input: "salmon, quinoa, kale, lemon"

4. **Search Execution**
   - Enter or select ingredients
   - Click "Find Recipes"
   - Verify results page loads

5. **Personalization Verification**
   - If signed in, check for any personalized features:
     - Previously viewed recipes
     - Favorite recipes highlighted
     - Recipe recommendations based on history
   - Verify "Edit Ingredients" button present
   - Verify ingredients persist if navigating back

6. **Edit Ingredients Flow**
   - On results page, click "Edit Ingredients" button
   - Verify navigation back to /fridge
   - Verify previous ingredients are pre-populated
   - Modify ingredients (add "bell pepper", remove "lemon")
   - Submit new search
   - Verify updated results

**Expected Results**:
- ✅ Authentication works seamlessly
- ✅ Inventory persists (if implemented)
- ✅ Edit ingredients flow works smoothly
- ✅ Results reflect ingredient changes
- ✅ No data loss when navigating between pages

**Pass Criteria**: All expected results met

---

### 1.3 Edge Cases and Error Handling

**Objective**: Verify robust handling of edge cases and error conditions

**Test ID**: FRIDGE-003
**Priority**: 🟡 High
**Prerequisites**: None

**Test Cases**:

#### 1.3.1 Empty Ingredient Search
- **Steps**:
  1. Navigate to /fridge
  2. Click "Find Recipes" without entering ingredients
  3. Verify button is disabled when input is empty
  4. OR verify helpful error message if submission allowed
- **Expected**: Graceful handling, no crash

#### 1.3.2 Very Specific Ingredient (Rare Item)
- **Steps**:
  1. Enter rare ingredients: "saffron, truffle oil, caviar"
  2. Submit search
  3. Verify results page handles low/zero results gracefully
- **Expected**:
  - Empty state message: "No Recipes Found"
  - Helpful suggestions: "Try removing some ingredients or browse all recipes"
  - "Edit Ingredients" and "Browse All Recipes" buttons

#### 1.3.3 Common Ingredient with 100+ Results
- **Steps**:
  1. Enter single common ingredient: "chicken"
  2. Submit search
  3. Verify results load efficiently
  4. Verify pagination or "Showing X of Y recipes" message
- **Expected**:
  - Results load in <1s
  - UI remains responsive
  - Reasonable result limit (e.g., 50 recipes max)

#### 1.3.4 Ingredient with No Matches
- **Steps**:
  1. Enter nonsensical or non-food terms: "xyz123, abcdef"
  2. Submit search
  3. Verify graceful empty state
- **Expected**:
  - "No Recipes Found" message
  - Helpful guidance
  - No JavaScript errors

#### 1.3.5 Special Characters in Input
- **Steps**:
  1. Enter ingredients with special chars: "chicken & rice, bell-pepper, garlic (minced)"
  2. Submit search
  3. Verify proper parsing and sanitization
- **Expected**:
  - Input parsed correctly
  - Special chars handled gracefully
  - Results returned if matches exist

#### 1.3.6 Very Long Ingredient List
- **Steps**:
  1. Enter 20+ ingredients separated by commas
  2. Submit search
  3. Verify UI doesn't break
- **Expected**:
  - Input accepted (or reasonable limit enforced)
  - Ingredient badges wrap properly
  - Search completes successfully

#### 1.3.7 Mobile Keyboard Behavior
- **Steps**:
  1. Open on mobile device (or DevTools mobile view)
  2. Click fridge input
  3. Verify keyboard appears
  4. Type ingredients
  5. Press "Go" or "Enter" on mobile keyboard
- **Expected**:
  - Keyboard triggers properly
  - "Enter" key submits search
  - No double-submission issues

**Pass Criteria**: All edge cases handled gracefully without crashes or data loss

---

## Section 2: Mobile Experience Testing

### 2.1 Mobile Navigation Testing

**Objective**: Verify mobile navigation menu works correctly across all device sizes

**Test ID**: MOBILE-001
**Priority**: 🔴 Critical
**Prerequisites**: None

**Test Steps** (repeat for each device size: 375px, 390px, 430px, 768px):

1. **Hamburger Menu Access**
   - Navigate to homepage
   - Verify hamburger menu icon (☰) visible in header
   - Verify icon is positioned correctly (right side)
   - Verify icon touch target is ≥44x44px
   - Tap hamburger icon
   - Verify slide-out drawer opens from right side

2. **Menu Content Verification**
   - Verify "Menu" heading appears
   - Verify all navigation links present:
     - ✅ "What's in Your Fridge" (Refrigerator icon)
     - ✅ "Rescue Ingredients" (Recycle icon) - NEW
     - ✅ "Ingredients" (Package icon) - RECENTLY ADDED
     - ✅ "Learn Techniques" (GraduationCap icon)
     - ✅ "Sustainability Chefs" (Leaf icon)
     - ✅ "Philosophy" (Heart icon)
     - Divider
     - "All Recipes" (BookOpen icon)
     - "Zero-Waste Collection" (Leaf icon)
     - "Discover" (Sparkles icon)
   - Verify icons display correctly next to labels
   - Verify text is readable (sufficient contrast)

3. **Link Navigation**
   - Tap "Ingredients" link
   - Verify navigation to /ingredients
   - Verify menu automatically closes on navigation
   - Navigate back to homepage
   - Reopen menu
   - Tap "What's in Your Fridge"
   - Verify navigation to /fridge
   - Verify menu closes

4. **Menu Close Behavior**
   - Open menu
   - Tap outside menu area (on overlay)
   - Verify menu closes
   - Reopen menu
   - Swipe right-to-left (if supported)
   - Verify menu closes

5. **Authentication Section**
   - Scroll to bottom of menu
   - Verify "Sign In" / "Sign Up" buttons (if not authenticated)
   - OR verify user profile link (if authenticated)
   - Verify auth buttons are properly styled and sized

**Expected Results**:
- ✅ Hamburger menu accessible on all mobile sizes
- ✅ All navigation links present and functional
- ✅ "Ingredients" link included (recent fix confirmed)
- ✅ Menu closes on link click
- ✅ Touch targets meet 44x44px minimum
- ✅ Smooth animations, no jank

**Pass Criteria**: All navigation items work correctly on all tested device sizes

---

### 2.2 Fridge Input - Mobile Usability

**Objective**: Verify fridge ingredient input is fully usable on mobile devices

**Test ID**: MOBILE-002
**Priority**: 🔴 Critical
**Prerequisites**: None

**Test Steps** (test on 375px, 390px, 430px viewports):

1. **Homepage Fridge Input**
   - Navigate to homepage
   - Scroll to hero section
   - Verify FridgeInput component visible
   - Verify input field is full-width on mobile
   - Verify input text is large enough (min 16px to prevent zoom on iOS)

2. **Text Contrast and Readability**
   - Click on input field
   - Verify input text color has sufficient contrast against background
   - **CRITICAL**: Verify text is white on dark olive background (recent fix)
   - Type sample text: "chicken, rice, tomatoes"
   - Verify typed text is clearly visible
   - Verify placeholder text has adequate contrast (60% opacity white)

3. **Touch Target Sizing**
   - Verify input field height is ≥44px (iOS guideline)
   - Verify "Find Recipes" button is ≥44px tall
   - Verify comfortable tap area around button

4. **Mobile Keyboard Behavior**
   - Tap input field
   - Verify mobile keyboard appears
   - Verify keyboard doesn't obscure input field
   - Verify page doesn't zoom on focus (font-size ≥16px)
   - Type ingredients using mobile keyboard
   - Verify comma key accessible on keyboard

5. **Enter Key Submission**
   - With text in input, press "Go" or "Enter" on mobile keyboard
   - Verify search initiates
   - Verify loading state shows
   - Verify navigation to results page

6. **Button Touch Feedback**
   - Tap "Find Recipes" button
   - Verify visual feedback (hover/active state)
   - Verify button click registers reliably
   - Verify no accidental double-taps

7. **Dedicated Fridge Page (/fridge)**
   - Navigate to /fridge
   - Verify same input component works identically
   - Verify input is centered and properly sized
   - Verify white card background provides good contrast

**Expected Results**:
- ✅ Input text is clearly visible (white on dark background)
- ✅ No iOS zoom on input focus
- ✅ Touch targets meet 44x44px minimum
- ✅ Enter key submits search
- ✅ Keyboard doesn't obscure input
- ✅ Smooth, responsive interaction

**Pass Criteria**: All interactions work smoothly on mobile without usability issues

---

### 2.3 Recipe Viewing - Mobile Layout

**Objective**: Verify recipe detail pages are fully readable and usable on mobile

**Test ID**: MOBILE-003
**Priority**: 🔴 Critical
**Prerequisites**: Recipe exists in database

**Test Steps** (test on 375px, 390px, 768px viewports):

1. **Recipe Card Readability**
   - Navigate to /discover or /recipes
   - Verify recipe cards stack in single column on mobile (375px-430px)
   - Verify recipe cards display in 2 columns on tablet (768px)
   - Verify recipe images load and scale properly
   - Verify recipe title is readable (not truncated excessively)
   - Verify touch target for entire card is adequate

2. **Recipe Detail Page Layout**
   - Tap a recipe card
   - Navigate to recipe detail page
   - Verify page scrolls smoothly
   - Verify hero image (if present) fits viewport width
   - Verify recipe title is readable and properly wrapped
   - Verify metadata (prep time, cook time, servings) is clearly visible

3. **Ingredients Section**
   - Scroll to ingredients list
   - Verify ingredients list is readable
   - Verify proper spacing between list items
   - Verify checkboxes (if present) are tappable (≥44px target)
   - Verify ingredient text doesn't overflow container

4. **Instructions Section**
   - Scroll to instructions
   - Verify each instruction step is clearly separated
   - Verify step numbers are visible
   - Verify text is large enough to read while cooking (≥16px)
   - Verify proper line spacing (1.5-1.7 for body text)
   - If collapsible sections exist:
     - Tap section header
     - Verify expand/collapse works smoothly
     - Verify adequate touch target for header

5. **Image Gallery (if multi-image)**
   - If recipe has multiple images, verify:
     - Images swipe/scroll horizontally
     - Image dots/pagination visible
     - Smooth swipe gesture
     - Images are optimized for mobile (not huge files)

6. **Action Buttons**
   - Verify all action buttons at bottom are tappable:
     - "Add to Favorites" (if implemented)
     - "Add to Meal Plan"
     - "Share"
     - "Edit" (if owner)
   - Verify buttons stack vertically or wrap on narrow screens
   - Verify touch targets meet 44x44px minimum

7. **Inventory Match Section (if implemented)**
   - If recipe page shows "You Have / You Need":
     - Verify section is readable on mobile
     - Verify ingredient lists are formatted properly
     - Verify substitution suggestions are accessible

**Expected Results**:
- ✅ Recipe content is fully readable on all mobile sizes
- ✅ Images scale appropriately
- ✅ Instruction steps are clearly formatted
- ✅ All interactive elements are tappable
- ✅ No horizontal scrolling issues
- ✅ Collapsible sections work smoothly

**Pass Criteria**: Recipe pages are fully usable for cooking on mobile devices

---

### 2.4 Forms and Inputs - Mobile Interaction

**Objective**: Verify all forms work correctly on mobile (sign-in, fridge search, filters)

**Test ID**: MOBILE-004
**Priority**: 🟡 High
**Prerequisites**: None

**Test Steps**:

1. **Sign-In Form (Clerk)**
   - Navigate to /sign-in on mobile (375px)
   - Verify form is centered and fits viewport
   - Verify input fields are ≥44px tall
   - Verify email/password inputs trigger correct keyboard
     - Email input → email keyboard with @
     - Password input → standard keyboard, hidden chars
   - Verify "Sign In" button is full-width or adequately sized
   - Verify no horizontal scrolling

2. **Fridge Search Filters**
   - Navigate to /fridge/results with ingredients
   - Verify filter controls on mobile:
     - "Sort by:" dropdown
     - "Min Match:" dropdown
   - Tap "Sort by:" dropdown
   - Verify dropdown opens and is usable
   - Verify dropdown options are tappable (≥44px)
   - Select "Fewest Missing"
   - Verify dropdown closes and selection applies
   - Repeat for "Min Match:" filter

3. **Select Dropdown Behavior**
   - On mobile, verify select dropdowns use native picker when possible
   - Verify custom select (shadcn/ui) works on mobile
   - Verify no z-index issues (dropdown visible above other elements)

4. **Touch Keyboard Types**
   - Test different input types trigger correct keyboards:
     - Text input → standard keyboard
     - Email input → email keyboard
     - Number input → numeric keyboard (if any)
     - Search input → keyboard with "Go" button

**Expected Results**:
- ✅ All forms are mobile-friendly
- ✅ Input fields prevent iOS zoom (font-size ≥16px)
- ✅ Correct keyboard types appear
- ✅ Dropdowns/selects are usable
- ✅ No layout breaking on small screens

**Pass Criteria**: All forms and inputs work correctly on mobile devices

---

## Section 3: Browser Compatibility Testing

### 3.1 Chrome (Desktop + Mobile)

**Objective**: Verify full functionality in Chrome browser (most common browser)

**Test ID**: BROWSER-001
**Priority**: 🔴 Critical
**Prerequisites**: Chrome browser installed (latest version)

**Test Steps**:

1. **Desktop Chrome (1920x1080)**
   - Open Chrome browser
   - Navigate to http://localhost:3002
   - Execute FRIDGE-001 test case (New User Flow)
   - Verify all features work
   - Open DevTools Console
   - Check for any JavaScript errors, warnings
   - Check Network tab for any failed requests

2. **Mobile Chrome (DevTools - 390px)**
   - In Chrome, press F12 to open DevTools
   - Click device toolbar icon (Ctrl+Shift+M / Cmd+Shift+M)
   - Select "iPhone 14 Pro" or custom 390x844
   - Refresh page
   - Execute MOBILE-001 test case (Mobile Navigation)
   - Execute MOBILE-002 test case (Fridge Input)
   - Verify responsive layout works
   - Check console for mobile-specific errors

3. **Chrome Mobile (Android Device - Optional)**
   - If Android device available with Chrome:
     - Connect to localhost:3002 via network
     - Navigate to application
     - Test fridge flow end-to-end
     - Test touch interactions
     - Verify keyboard behavior

**Expected Results**:
- ✅ All features work in Chrome desktop
- ✅ All features work in Chrome mobile view
- ✅ No console errors or warnings
- ✅ No failed network requests
- ✅ Smooth performance

**Pass Criteria**: Zero critical errors, all features functional

---

### 3.2 Safari (Desktop + iOS)

**Objective**: Verify compatibility with Safari (critical for iOS users)

**Test ID**: BROWSER-002
**Priority**: 🔴 Critical
**Prerequisites**: Safari browser (macOS) or iOS device

**Test Steps**:

1. **Desktop Safari (macOS)**
   - Open Safari browser
   - Navigate to http://localhost:3002
   - Execute FRIDGE-001 test case
   - Verify all features work
   - Open Web Inspector (Develop > Show Web Inspector)
   - Check Console for errors
   - Test any CSS that may behave differently in Safari:
     - Flexbox layouts
     - Grid layouts
     - CSS custom properties (variables)
     - Backdrop filters

2. **Safari Responsive Design Mode**
   - In Safari, enable Develop menu (Preferences > Advanced)
   - Develop > Enter Responsive Design Mode
   - Select iPhone 14 (390x844)
   - Execute MOBILE-001 and MOBILE-002 test cases
   - Verify iOS-specific behaviors:
     - Input zoom prevention
     - Touch target sizing
     - Scroll behavior

3. **iOS Safari (iPhone - Optional)**
   - If iOS device available:
     - Connect to localhost via network
     - Navigate to application in Safari
     - Test fridge input with iOS keyboard
     - Verify no input zoom on focus
     - Test touch gestures (swipe, tap)
     - Test navigation and back button behavior

4. **Safari-Specific Issues to Check**:
   - ✅ Input field focus doesn't zoom page (font-size ≥16px)
   - ✅ Fixed positioning works correctly
   - ✅ Touch events register properly
   - ✅ CSS Grid/Flexbox render correctly
   - ✅ Dark mode styling (if implemented)

**Expected Results**:
- ✅ All features work in Safari desktop
- ✅ All features work in Safari mobile
- ✅ No iOS-specific layout issues
- ✅ No input zoom on focus
- ✅ Touch interactions work smoothly

**Pass Criteria**: Zero critical Safari-specific bugs

---

### 3.3 Firefox (Desktop + Android)

**Objective**: Verify compatibility with Firefox browser

**Test ID**: BROWSER-003
**Priority**: 🟡 High
**Prerequisites**: Firefox browser installed

**Test Steps**:

1. **Desktop Firefox (1920x1080)**
   - Open Firefox browser
   - Navigate to http://localhost:3002
   - Execute FRIDGE-001 test case
   - Verify all features work
   - Open Developer Tools (F12)
   - Check Console for errors
   - Check for Firefox-specific rendering differences

2. **Firefox Responsive Design Mode**
   - Press Ctrl+Shift+M (Cmd+Shift+M on Mac)
   - Select "iPhone 14 Pro" or custom 390x844
   - Execute MOBILE-001 and MOBILE-002 test cases
   - Verify responsive behavior

3. **Firefox Mobile (Android - Optional)**
   - If Android device with Firefox available:
     - Navigate to application
     - Test fridge flow
     - Verify touch interactions

**Expected Results**:
- ✅ All features work in Firefox desktop
- ✅ All features work in Firefox mobile view
- ✅ No Firefox-specific errors
- ✅ Consistent behavior with Chrome/Safari

**Pass Criteria**: No Firefox-specific critical bugs

---

## Section 4: Performance Testing

### 4.1 Fridge Search Performance

**Objective**: Verify fridge search completes within performance budget

**Test ID**: PERF-001
**Priority**: 🔴 Critical
**Prerequisites**: Chrome browser with DevTools

**Test Steps**:

1. **Measure Search Response Time**
   - Open Chrome DevTools
   - Go to Network tab
   - Navigate to /fridge
   - Enter ingredients: "chicken, rice, garlic, tomatoes"
   - Click "Find Recipes"
   - Record time from click to results display
   - Check Network tab for API call duration
   - Identify `/api/search/...` or server action call
   - Record response time

2. **Test with Varying Ingredient Counts**
   - Test with 1 ingredient: "chicken"
   - Record response time
   - Test with 5 ingredients: "chicken, rice, onions, garlic, tomatoes"
   - Record response time
   - Test with 10 ingredients: "chicken, beef, rice, pasta, onions, garlic, tomatoes, carrots, celery, potatoes"
   - Record response time

3. **Network Throttling Test**
   - In DevTools Network tab, enable throttling
   - Select "Fast 3G" or "Slow 3G"
   - Execute fridge search
   - Record response time
   - Verify loading state shows appropriately
   - Verify no timeout errors

**Performance Targets**:
- ✅ Search API call: <500ms (ideal)
- ✅ Full results page render: <2s
- ✅ On "Fast 3G": <3s
- ✅ Loading state visible during search

**Expected Results**:
- Search completes within target times
- Graceful handling of slower networks
- User feedback during loading

**Pass Criteria**: 90% of searches complete within 500ms on normal connection

---

### 4.2 Page Load Performance

**Objective**: Verify key pages load within acceptable timeframes

**Test ID**: PERF-002
**Priority**: 🟡 High
**Prerequisites**: Chrome DevTools

**Test Steps**:

1. **Homepage Load Time**
   - Open Chrome DevTools
   - Go to Network tab
   - Navigate to http://localhost:3002
   - Record page load metrics:
     - DOMContentLoaded time
     - Full Load time
     - Largest Contentful Paint (LCP)
   - Check Performance tab for detailed metrics

2. **Recipe Page Load Time**
   - Navigate to a recipe detail page
   - Record load metrics:
     - Time to First Byte (TTFB)
     - First Contentful Paint (FCP)
     - Largest Contentful Paint (LCP)
     - Time to Interactive (TTI)

3. **Fridge Results Page Load Time**
   - Execute fridge search
   - Measure results page load time
   - Check for any render-blocking resources

**Performance Targets**:
- ✅ Homepage LCP: <2.5s
- ✅ Recipe page LCP: <2.5s
- ✅ Time to Interactive: <3.5s
- ✅ No render-blocking scripts

**Expected Results**:
- Pages load within target times
- Core Web Vitals in "Good" range
- No excessive JavaScript bundle size

**Pass Criteria**: All Core Web Vitals metrics in "Good" range

---

### 4.3 Lighthouse Mobile Audit

**Objective**: Verify mobile performance score meets targets

**Test ID**: PERF-003
**Priority**: 🟡 High
**Prerequisites**: Chrome browser

**Test Steps**:

1. **Run Lighthouse on Homepage**
   - Open Chrome DevTools
   - Go to Lighthouse tab
   - Select:
     - ☑ Performance
     - ☑ Accessibility
     - ☑ Best Practices
     - ☑ SEO
   - Mode: Navigation
   - Device: Mobile
   - Click "Analyze page load"
   - Wait for report generation
   - Record scores

2. **Run Lighthouse on /fridge Page**
   - Navigate to /fridge
   - Run Lighthouse Mobile audit
   - Record scores

3. **Run Lighthouse on Recipe Detail Page**
   - Navigate to a recipe page
   - Run Lighthouse Mobile audit
   - Record scores

**Lighthouse Score Targets**:
- ✅ Performance: ≥90 (Green)
- ✅ Accessibility: ≥90 (Green)
- ✅ Best Practices: ≥90 (Green)
- ✅ SEO: ≥90 (Green)

**Expected Results**:
- All scores in green range (90+)
- No critical accessibility violations
- Mobile-friendly layout
- Optimized images and assets

**Pass Criteria**: Performance score ≥90 on all tested pages

---

## Test Execution Strategy

### Execution Order
1. **Day 1 Morning**: Fridge Flow Testing (Section 1)
   - Execute FRIDGE-001, FRIDGE-002, FRIDGE-003
   - Document results immediately

2. **Day 1 Afternoon**: Mobile Experience Testing (Section 2)
   - Execute MOBILE-001 through MOBILE-004
   - Test on multiple viewport sizes

3. **Day 1 Evening**: Browser Compatibility (Section 3)
   - Execute BROWSER-001, BROWSER-002, BROWSER-003
   - Test across Chrome, Safari, Firefox

4. **Day 2 Morning**: Performance Testing (Section 4)
   - Execute PERF-001, PERF-002, PERF-003
   - Run Lighthouse audits

### Test Data Requirements
- **Ingredients**: chicken, rice, onions, garlic, tomatoes, salmon, quinoa, kale, lemon, bell pepper, saffron, truffle oil
- **User Accounts**: 1 test user account for signed-in testing
- **Recipes**: Database should have 50+ recipes with varied ingredient lists

### Bug Reporting Template
For any failures, document using this format:

```markdown
## Bug Report: [Short Title]

**Bug ID**: BUG-XXX
**Severity**: Critical / High / Medium / Low
**Test Case**: [Test ID that failed]
**Environment**: [Browser, Device, Viewport]

### Steps to Reproduce:
1. Step one
2. Step two
3. Step three

### Expected Result:
[What should happen]

### Actual Result:
[What actually happened]

### Screenshots:
[Attach if possible]

### Console Errors:
[Paste any relevant errors]

### Priority:
🔴 Critical - Blocks launch
🟡 High - Should fix before launch
🟢 Medium - Can fix post-launch
⚪ Low - Nice to have
```

---

## Risk Assessment

### High-Risk Areas
1. **Mobile Input Text Visibility**: Recent fix applied - needs verification
2. **Mobile Menu Navigation**: "Ingredients" link recently added - needs confirmation
3. **Safari iOS Zoom**: Input field font-size must be ≥16px
4. **Touch Target Sizing**: All interactive elements must be ≥44x44px

### Mitigation Strategies
- Test on actual iOS device if available
- Use browser DevTools for thorough mobile simulation
- Test with real user accounts, not just mock data
- Monitor browser console continuously during testing

---

## Success Criteria Summary

### Must Pass (Critical)
- ✅ Fridge flow works end-to-end for new and signed-in users
- ✅ Mobile navigation includes all links (especially "Ingredients")
- ✅ Fridge input text is visible on dark background (white text)
- ✅ No blocking bugs in Chrome, Safari, Firefox
- ✅ Touch targets meet 44x44px minimum on mobile
- ✅ Search completes in <500ms on normal connection
- ✅ Recipe pages load in <2s

### Should Pass (High Priority)
- ✅ Lighthouse Performance score ≥90 on mobile
- ✅ All edge cases handled gracefully
- ✅ No iOS zoom on input focus
- ✅ Smooth animations and transitions on mobile

### Nice to Have (Medium Priority)
- ✅ Lighthouse scores 90+ across all categories
- ✅ Firefox mobile testing completed
- ✅ Real device testing (not just DevTools)

---

## Test Execution Sign-Off

**Test Execution Start**: [To be filled during execution]
**Test Execution End**: [To be filled during execution]
**Total Test Cases**: 17
**Passed**: [To be filled]
**Failed**: [To be filled]
**Blocked**: [To be filled]
**Pass Rate**: [To be filled]

**Tester Signature**: Web QA Agent
**Date**: 2025-10-21

---

## Appendix A: Test Data

### Sample Ingredient Sets
```
Set 1 (Common): chicken, rice, onions, garlic, tomatoes
Set 2 (Healthy): salmon, quinoa, kale, lemon, avocado
Set 3 (Rare): saffron, truffle oil, caviar, foie gras
Set 4 (Simple): chicken
Set 5 (Many): chicken, beef, rice, pasta, onions, garlic, tomatoes, carrots, celery, potatoes, bell pepper, broccoli
Set 6 (Special Chars): chicken & rice, bell-pepper, garlic (minced)
```

### Expected Recipe Counts
Based on current database (to be verified during testing):
- "chicken" alone: 30+ recipes
- "chicken, rice": 15+ recipes
- "salmon, quinoa, kale": 5-10 recipes
- "saffron, truffle oil": 0-2 recipes

---

## Appendix B: Browser Versions

### Target Browser Versions (as of 2025-10-21)
- **Chrome Desktop**: 130.0.6723.58 or later
- **Chrome Android**: 130.x or later
- **Safari macOS**: 17.6 or later
- **Safari iOS**: 17.6 or later
- **Firefox Desktop**: 131.0 or later
- **Firefox Android**: 131.x or later

### Minimum Supported Versions
- Chrome: 120+
- Safari: 16+
- Firefox: 115+

---

## Appendix C: Performance Metrics Reference

### Core Web Vitals Thresholds
| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| LCP (Largest Contentful Paint) | ≤2.5s | 2.5s-4.0s | >4.0s |
| FID (First Input Delay) | ≤100ms | 100ms-300ms | >300ms |
| CLS (Cumulative Layout Shift) | ≤0.1 | 0.1-0.25 | >0.25 |

### Custom Performance Targets
- **Fridge Search API**: <500ms (P95)
- **Recipe Page Load**: <2s (P95)
- **Bundle Size**: <200KB (gzipped)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-21
**Next Review**: After test execution completion
