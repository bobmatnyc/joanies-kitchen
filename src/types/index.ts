// Re-export database types
export type {
  NewRecipe,
  Recipe,
  RecipeLicense,
} from '@/lib/db/schema';

// UI-specific types
export interface RecipeFilters {
  search?: string;
  cuisine?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  maxPrepTime?: number;
  maxCookTime?: number;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity?: string;
  category?: string;
  checked: boolean;
}

export interface MealPlanEntry {
  date: string;
  breakfast?: number; // Recipe ID
  lunch?: number; // Recipe ID
  dinner?: number; // Recipe ID
  snack?: number; // Recipe ID
}

// Meal Pairing Types (re-export from meal-pairing-engine)
export type {
  MealGenerationResult,
  MealPairingInput,
  MealPairingMode,
  MealPlan,
  MealPlanCourse,
  SimpleMealRequest,
} from '@/lib/ai/meal-pairing-engine';
