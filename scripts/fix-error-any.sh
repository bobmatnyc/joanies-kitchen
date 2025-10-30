#!/bin/bash

# Batch fix error: any to error: unknown in TypeScript files

FILES=(
  "src/app/actions/ingredient-search.ts"
  "src/app/actions/ingredients.ts"
  "src/app/actions/meal-pairing.ts"
  "src/app/actions/rate-recipe.ts"
  "src/app/actions/recipe-crawl.ts"
  "src/app/actions/recipe-search.ts"
  "src/app/actions/semantic-search.ts"
  "src/app/actions/admin.ts"
  "src/app/actions/ai-recipes.ts"
  "src/app/actions/inventory.ts"
  "src/app/actions/recipe-ingestion.ts"
  "src/app/actions/recipes.ts"
  "src/app/actions/user-profiles.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing $file..."

    # Add import if not exists
    if ! grep -q "import.*toErrorMessage.*from.*@/lib/utils/error-handling" "$file"; then
      # Find the last import line and add after it
      sed -i '' "/^import.*from/a\\
import { toErrorMessage } from '@/lib/utils/error-handling';
" "$file" 2>/dev/null || true
    fi

    # Replace error: any with error: unknown
    sed -i '' 's/catch (error: any)/catch (error: unknown)/g' "$file"
    sed -i '' 's/(error: any)/(error: unknown)/g' "$file"

    echo "  ✓ Fixed $file"
  fi
done

echo "Done! Fixed ${#FILES[@]} files."
