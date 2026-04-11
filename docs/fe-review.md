# Frontend Code Review — April 2026

A targeted refactor of the frontend codebase. Goal: semantic HTML, type safety, consistency,
maintainability. No business logic or layout redesign.

---

## What Was Fixed

### 1. Duplicate Nav Item Lists Eliminated
**Files:** `src/config/navigation.ts` (new), `src/components/navigation/DesktopNav.tsx`,
`src/components/navigation/MobileNav.tsx` (new, was `src/components/mobile/MobileNav.tsx`)

Both `DesktopNav` and `MobileNav` previously maintained identical hardcoded lists of nav items.
Created `src/config/navigation.ts` as a single source of truth with `PRIMARY_NAV_ITEMS` and
`SECONDARY_NAV_ITEMS` arrays. Both nav components now iterate over those arrays. Adding or
renaming a nav item now requires one edit instead of two.

Also moved MobileNav from `components/mobile/` to `components/navigation/` where it belongs
semantically alongside `DesktopNav` and `NavLink`. Updated `layout.tsx` import accordingly.

### 2. Unnecessary `<div>` Wrapper Removed from Layout Header
**File:** `src/app/layout.tsx`

The hamburger button was wrapped in `<div className="flex xl:hidden items-center gap-2">` even
though MobileNav only renders one element. Removed the wrapper; the `xl:hidden` class is now
applied directly on the trigger `<Button>` inside `MobileNav`.

### 3. Debug `console.log` Statements Removed from Homepage
**File:** `src/app/page.tsx`

Two debug-only `console.log` calls (`[Homepage] Rendering with...` and `[Homepage] Recipes of
the Day fetched:`) were left in the production client component, polluting browser consoles for
every user. Removed. Error-level `console.error` calls for data fetch failures were preserved.

### 4. `recipes: any[]` Replaced with `Recipe[]`
**File:** `src/components/recipe/RecipePageContent.tsx`

The `RecipePageContentProps.recipes` prop was typed as `any[]`, disabling all type safety for
the entire recipe list. Changed to `Recipe` from `@/lib/db/schema`.

### 5. `sharedRecipes: any[]` Replaced with `Recipe[]` + Bug Fix
**File:** `src/components/recipe/SharedRecipesContent.tsx`

Same issue as above. Fixing the type immediately surfaced a real bug: the code was accessing
`recipe.isSystemRecipe` (camelCase) while the actual DB column is `is_system_recipe` (snake_case).
This was silently failing at runtime. Fixed both the type and the field name.

### 6. `icon: any` Replaced with `LucideIcon` in RecipeCrawlPanel
**File:** `src/components/recipe/RecipeCrawlPanel.tsx`

The local `ProgressStepIndicator` component used `icon: any` in its prop interface. Replaced
with `LucideIcon` from `lucide-react` for proper type inference and IDE autocomplete.

### 7. Semantic `<time>` Element for Duration
**Files:** `src/components/recipe/RecipeCard.tsx`, `src/components/meals/MealCard.tsx`

Cook time / total time was displayed as plain `<span>` text. Replaced with `<time>` elements
carrying machine-readable `dateTime` attributes in ISO 8601 duration format (`PT{N}M`). This
allows search engines, screen readers, and structured data parsers to understand the duration.

### 8. `<article>` Semantic Wrapping for RecipeCard
**File:** `src/components/recipe/RecipeCard.tsx`

Recipe cards represent self-contained pieces of content. Wrapped the card (both linked and
unlinked variants) in `<article aria-label={recipe.name}>` so assistive technologies can
identify and navigate between recipe items in a list.

### 9. `aria-label` Added to ChefCard Link
**File:** `src/components/chef/ChefCard.tsx`

The `<Link>` had no descriptive label — screen readers would announce the URL or nothing useful.
Added `aria-label={`View ${chef.displayName || chef.name}'s profile`}`.

### 10. `aria-label` Added to Mobile Navigation
**File:** `src/components/navigation/MobileNav.tsx`

The `<nav>` inside the mobile drawer had no label to distinguish it from the outer `<nav>` in
the site header. Added `aria-label="Mobile navigation"`.

### 11. StatsCard `value.toLocaleString()` Safety Fix
**File:** `src/components/admin/StatsCard.tsx`

The `value` prop is typed as `number | string`. Calling `.toLocaleString()` unconditionally would
throw at runtime when `value` is a string that's not a number. Added a type guard: numeric values
use `.toLocaleString()`, string values render as-is.

### 12. IngredientCard Design Token Alignment
**File:** `src/components/ingredient/IngredientCard.tsx`

The card used generic Tailwind `gray-*` classes (`gray-200`, `gray-300`, `gray-900`, `gray-500`,
etc.) inconsistent with the rest of the JK design system. Replaced all color classes with JK
design tokens (`jk-sage`, `jk-olive`, `jk-clay`, `jk-charcoal`, `jk-linen`). Also added
`aria-label` to the link and `aria-hidden` to the decorative fallback icon.

### 13. About Page Semantic Improvements
**File:** `src/app/about/page.tsx`

- Changed root element from `<main>` to `<article>`. The layout already provides a `<main>`
  landmark; nesting another `<main>` is invalid HTML.
- Removed the `<div className="clear-both">` — a CSS float hack that predates flex/grid layout.
  The float on the portrait image can be cleared via modern CSS if needed; the empty div adds
  no semantic value.

### 14. IngredientsList `cn()` and `aria-label`
**File:** `src/components/recipe/IngredientsList.tsx`

- Replaced string concatenation for conditional classNames with `cn()` from `@/lib/utils` for
  consistency with the rest of the codebase.
- Added `aria-label="Ingredients"` to the `<ul>` so screen readers announce the list purpose.

---

## What Remains (Deferred)

### A. `RecipeCard.test.tsx` Stale Mock Data
The test fixture is missing `last_cleaned_at`, `last_cleaned_model`, `moderation_status`,
`moderation_notes` and other recently added schema fields. The test file needs its mock recipe
object updated to match the current schema. **Not changed** — the test is pre-existing and out of
scope for this refactor.

### B. `RecipeForm.tsx` (391 lines) and `MealPairingWizard.tsx` (459 lines)
Both exceed the 200-line guidance. They could be split into smaller sub-components (e.g.,
`RecipeFormBasicInfo`, `RecipeFormIngredients`, `RecipeFormInstructions`). Deferred because
splitting them safely requires understanding wizard state flow and is more than cosmetic cleanup.

### C. `MealDetailContent.tsx` (501 lines) — `items: any[]`
Line 159 has `const items: any[] = []`. Needs a proper shopping list item type. Deferred.

### D. `InventoryList.tsx` — `onValueChange: (v: any) => ...`
The Select `onValueChange` callbacks cast to `any`. These should use the actual string union
types matching the filter options. Deferred.

### E. Home Page is a Client Component
`src/app/page.tsx` is `'use client'` and uses `useEffect` to fetch data on mount. This adds a
client-side waterfall for the recipes and background images. These could be fetched in a Server
Component instead for better performance. Deferred — requires restructuring the page architecture.

### F. `about/page.tsx` Float Layout
The portrait image uses CSS `float-left` with `mr-8 mb-6`. Modern best practice is CSS grid or
flex. The float approach works but can cause layout issues at certain viewport sizes. Deferred
since it requires visual QA.

---

## Patterns to Adopt Going Forward

1. **Always type lists with their domain type** — never `any[]`. If you don't have the type,
   create or import it. Typed lists catch field name bugs at compile time.

2. **Single source of truth for repeated content** — nav items, color maps, status labels. Define
   them once as a typed constant, iterate. Never copy-paste.

3. **Use `cn()` for all conditional class composition** — not template literals or ternary
   string concatenation. `cn()` handles conflicts and is consistent across the codebase.

4. **Semantic time elements** — use `<time dateTime="PT{N}M">` for any duration display,
   `<time dateTime="YYYY-MM-DD">` for any date display. Both benefit SEO and accessibility.

5. **Semantic article/section/nav landmarks** — recipe cards → `<article>`, nav lists → `<nav>`
   with `aria-label` when multiple navs exist, page headers → `<header>` (already used well).

6. **No debug `console.log` in production client components** — use `console.error` for genuine
   errors only, or structured logging if needed.

7. **`aria-label` on icon-only or ambiguous links** — links whose visible text is just a name or
   icon need descriptive aria-labels for screen reader users.
