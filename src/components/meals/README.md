# Meal Pairing UI Components

User-friendly interface components for the Recipe Manager's AI-powered meal pairing system.

## Overview

These components provide a complete wizard-based UI for generating balanced multi-course meals. The system uses AI to create harmonious combinations of appetizers, main courses, sides, and desserts based on culinary principles like flavor balance, texture variety, and temperature progression.

## Components

### MealPairingWizard

**Main entry point** - Multi-step wizard for meal generation.

**Features:**
- 4-step wizard (Mode → Constraints → Generation → Results)
- 4 generation modes: Cuisine, Theme, Main-First, Freestyle
- Dietary restrictions and ingredient preferences
- Time and serving constraints
- Progress tracking with visual feedback
- Loading states during AI generation
- Regenerate and save options

**Usage:**
```tsx
import { MealPairingWizard } from '@/components/meals';

function MealPairingPage() {
  const handleComplete = (mealPlan: MealPlan) => {
    // Save meal plan or navigate to results
    console.log('Generated meal:', mealPlan);
  };

  return (
    <MealPairingWizard
      onComplete={handleComplete}
      onCancel={() => router.back()}
    />
  );
}
```

**Props:**
- `onComplete?: (mealPlan: MealPlan) => void` - Called when user saves the meal plan
- `onCancel?: () => void` - Called when user cancels the wizard

---

### MealPlanDisplay

**Results viewer** - Displays the complete generated meal plan.

**Features:**
- Responsive grid layout for all 4 courses
- Integrated MealBalanceDashboard
- Chef's notes section
- Visual course organization

**Usage:**
```tsx
import { MealPlanDisplay } from '@/components/meals';

function MealResultsPage({ mealPlan }: { mealPlan: MealPlan }) {
  return (
    <MealPlanDisplay
      mealPlan={mealPlan}
      showAnalysis={true}
    />
  );
}
```

**Props:**
- `mealPlan: MealPlan` - The generated meal plan to display
- `showAnalysis?: boolean` - Whether to show the balance dashboard (default: true)

---

### CourseCard

**Individual course display** - Shows details for a single course.

**Features:**
- Temperature indicators (hot/cold/room)
- Pairing rationale explanation
- Key ingredients and textures
- Dominant flavors display
- Link to full recipe (if available)
- Prep time and metadata

**Usage:**
```tsx
import { CourseCard } from '@/components/meals';

function CourseDetail({ course }: { course: MealPlanCourse }) {
  return (
    <CourseCard
      course={course}
      courseType="main"
    />
  );
}
```

**Props:**
- `course: MealPlanCourse` - Course data to display
- `courseType: 'appetizer' | 'main' | 'side' | 'dessert'` - Course category

---

### MealBalanceDashboard

**Analytics visualization** - Shows meal balance and nutritional metrics.

**Features:**
- Total preparation time
- Texture variety score with progress bar
- Cultural coherence indicator
- Color palette visualization
- Temperature progression timeline
- Macronutrient balance (carbs/protein/fat)

**Usage:**
```tsx
import { MealBalanceDashboard } from '@/components/meals';

function AnalyticsView({ mealPlan }: { mealPlan: MealPlan }) {
  return (
    <MealBalanceDashboard mealPlan={mealPlan} />
  );
}
```

**Props:**
- `mealPlan: MealPlan` - Meal plan to analyze and visualize

---

## Server Actions

The components integrate with server actions in `src/app/actions/meal-pairing.ts`:

### generateMealPairing (alias: generateBalancedMeal)

Generate a balanced meal plan using AI.

```typescript
import { generateMealPairing } from '@/app/actions/meal-pairing';

const result = await generateMealPairing({
  cuisine: 'Italian',
  servings: 4,
  dietary: ['vegetarian'],
  maxTime: 90
});

if (result.success) {
  console.log('Meal plan:', result.data);
}
```

### saveMealPlanFromPairing

Save a generated meal plan to the database.

```typescript
import { saveMealPlanFromPairing } from '@/app/actions/meal-pairing';

const result = await saveMealPlanFromPairing(
  mealPlan,
  'Italian Date Night',
  'date night'
);

if (result.success) {
  console.log('Saved meal ID:', result.data);
}
```

### getMealPairingHistory

Retrieve user's previously generated meal plans.

```typescript
import { getMealPairingHistory } from '@/app/actions/meal-pairing';

const result = await getMealPairingHistory();

if (result.success) {
  console.log('User meals:', result.data);
  console.log('Pagination:', result.pagination);
}
```

---

## Data Types

### MealPlan

Complete meal plan structure:

```typescript
interface MealPlan {
  appetizer: MealPlanCourse;
  main: MealPlanCourse;
  side: MealPlanCourse;
  dessert: MealPlanCourse;
  meal_analysis: {
    total_prep_time: number;
    texture_variety_count: number;
    color_palette: string[];
    temperature_progression: string[];
    cultural_coherence: string;
    estimated_macros: {
      carbs_percent: number;
      protein_percent: number;
      fat_percent: number;
    };
    chef_notes: string;
  };
}
```

### MealPlanCourse

Individual course details:

```typescript
interface MealPlanCourse {
  name: string;
  description: string;
  weight_score?: number;
  richness_score?: number;
  acidity_score?: number;
  sweetness_level?: 'light' | 'moderate' | 'rich';
  dominant_textures: string[];
  dominant_flavors?: string[];
  temperature: 'hot' | 'cold' | 'room';
  prep_time_minutes: number;
  key_ingredients: string[];
  pairing_rationale: string;
  cuisine_influence?: string;
  recipe_id?: string; // Link to existing recipe
}
```

### SimpleMealRequest

Input for meal generation:

```typescript
interface SimpleMealRequest {
  cuisine?: string;
  theme?: string;
  mainDish?: string;
  dietary?: string[];
  ingredients?: string[];
  maxTime?: number;
  servings?: number;
}
```

---

## Mobile Responsiveness

All components are designed mobile-first:

- **MealPairingWizard**: Stacks vertically on mobile, full-width cards
- **MealPlanDisplay**: Single column on mobile, 2-column grid on desktop
- **CourseCard**: Responsive card layout with optimized spacing
- **MealBalanceDashboard**: Grid adapts from 1 column (mobile) to 3 columns (desktop)

Touch targets are minimum 44x44px for accessibility.

---

## Styling

Components use the Recipe Manager's design system:

- **shadcn/ui components**: Card, Button, Badge, Progress, Tabs
- **Tailwind CSS v4**: Utility-first styling
- **Lucide Icons**: Consistent iconography
- **Dark mode support**: All components support light/dark themes

---

## Error Handling

Components handle errors gracefully:

- **Network errors**: Toast notifications with error messages
- **Validation errors**: Inline feedback on form fields
- **Loading states**: Skeleton loaders and spinners
- **Empty states**: Clear messaging when no data available

---

## Accessibility

- **Semantic HTML**: Proper heading hierarchy and ARIA labels
- **Keyboard navigation**: All interactive elements accessible via keyboard
- **Screen reader support**: Descriptive labels and alt text
- **Focus indicators**: Clear visual focus states
- **Color contrast**: WCAG AA compliant

---

## Performance

- **Code splitting**: Components are lazy-loaded where appropriate
- **Server actions**: AI generation happens server-side
- **Optimized rendering**: React.memo and useMemo for expensive operations
- **Image optimization**: Next.js Image component for recipe images

---

## Example Page

Complete example integrating all components:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MealPairingWizard } from '@/components/meals';
import { saveMealPlanFromPairing } from '@/app/actions/meal-pairing';
import { toast } from '@/lib/toast';
import type { MealPlan } from '@/types';

export default function MealBuilderPage() {
  const router = useRouter();

  const handleComplete = async (mealPlan: MealPlan) => {
    const mealName = `${mealPlan.meal_analysis.cultural_coherence} Meal`;

    const result = await saveMealPlanFromPairing(
      mealPlan,
      mealName,
      'generated'
    );

    if (result.success) {
      toast.success('Meal plan saved!');
      router.push(`/meals/${result.data}`);
    } else {
      toast.error(result.error || 'Failed to save meal plan');
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Meal Builder</h1>
      <MealPairingWizard
        onComplete={handleComplete}
        onCancel={() => router.push('/meals')}
      />
    </div>
  );
}
```

---

## Testing

To test the components:

```bash
# Start development server
pnpm dev

# Visit the meal pairing page
# http://localhost:3002/meal-builder (or your route)

# Test different modes:
# 1. Cuisine-based (e.g., "Italian")
# 2. Theme-based (e.g., "Summer BBQ")
# 3. Main-first (e.g., "Grilled Salmon")
# 4. Freestyle (with dietary restrictions)
```

---

## Future Enhancements

- [ ] Recipe image generation for courses without linked recipes
- [ ] Wine pairing suggestions
- [ ] Shopping list generation from meal plan
- [ ] Meal plan templates (e.g., "Romantic Dinner", "Family Gathering")
- [ ] Social sharing (share meal plans with friends)
- [ ] Meal plan collections (save favorite combinations)
- [ ] Nutrition tracking integration

---

## Support

For issues or questions:
- Check the main project README.md
- Review the meal pairing engine documentation in `src/lib/ai/meal-pairing-engine.ts`
- Consult the prompt engineering guide in `src/lib/ai/prompts/meal-pairing.ts`

---

**Last Updated**: 2025-10-19
**Component Version**: 1.0.0
**Recipe Manager Version**: 0.6.0+
