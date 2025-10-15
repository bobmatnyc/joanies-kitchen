# Quality Standards

Code quality guidelines and standards for the Recipe Manager project.

## Code Style

### TypeScript

- Use strict mode
- Prefer interfaces over types for objects
- Use type inference where possible
- Avoid `any` - use `unknown` if type is truly unknown

```typescript
// Good
interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
}

// Avoid
type Recipe = {
  id: any;  // Too permissive
  name: string;
};
```

### File Organization

- Group by feature, not by type
- One component per file
- Co-locate related files
- Use index.ts for clean exports

```
features/
└── recipes/
    ├── RecipeCard.tsx
    ├── RecipeList.tsx
    ├── RecipeForm.tsx
    ├── useRecipes.ts
    └── index.ts
```

### Naming Conventions

- **Components**: PascalCase (`RecipeCard`)
- **Functions**: camelCase (`createRecipe`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RECIPES`)
- **Files**: Match export name (`RecipeCard.tsx`)

## Performance

### Database Queries

- Use indexes for frequently queried fields
- Limit result sets with LIMIT clause
- Use connection pooling
- Avoid N+1 queries

```typescript
// Good - Single query
const recipes = await db.select()
  .from(recipes)
  .where(eq(recipes.userId, userId))
  .limit(20);

// Bad - N+1 query
for (const recipe of recipes) {
  const ratings = await db.select()
    .from(recipeRatings)
    .where(eq(recipeRatings.recipeId, recipe.id));
}
```

### React Components

- Use React.memo for expensive renders
- Implement proper key props in lists
- Avoid inline function definitions in render
- Use useCallback and useMemo appropriately

```tsx
// Good
const MemoizedRecipeCard = React.memo(RecipeCard);

// Avoid
{recipes.map(recipe => (
  <RecipeCard onClick={() => handleClick(recipe.id)} />
))}
```

### API Calls

- Implement proper loading states
- Handle errors gracefully
- Use caching when appropriate
- Debounce user input

## Testing

### Coverage Requirements

- **Minimum**: 80% coverage for new code
- **Unit Tests**: All utility functions
- **Integration Tests**: API endpoints
- **E2E Tests**: Critical user flows

### Test Structure

```typescript
describe('RecipeCard', () => {
  it('should display recipe name', () => {
    // Arrange
    const recipe = { name: 'Test Recipe', /* ... */ };

    // Act
    render(<RecipeCard recipe={recipe} />);

    // Assert
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
  });
});
```

## Security

### Authentication

- Always validate userId on server
- Use server actions for mutations
- Never expose API keys to client
- Implement CSRF protection

```typescript
// Good - Server-side validation
export async function createRecipe(recipe: NewRecipe) {
  const { userId } = auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Proceed
}
```

### Input Validation

- Use Zod schemas for all inputs
- Sanitize user-generated content
- Validate file uploads
- Implement rate limiting

```typescript
import { z } from 'zod';

const RecipeSchema = z.object({
  name: z.string().min(1).max(200),
  ingredients: z.array(z.string()).min(1),
  instructions: z.array(z.string()).min(1),
});
```

## Accessibility

### ARIA

- Use semantic HTML elements
- Add ARIA labels where needed
- Implement keyboard navigation
- Test with screen readers

```tsx
<button
  aria-label="Delete recipe"
  onClick={handleDelete}
>
  <TrashIcon />
</button>
```

### Contrast

- Ensure 4.5:1 contrast ratio for text
- Provide focus indicators
- Use color + text/icons (not color alone)

## Documentation

### Code Comments

```typescript
// Good - Explains WHY
// Sort by rating to prioritize quality recipes
recipes.sort((a, b) => b.rating - a.rating);

// Unnecessary - Explains WHAT (obvious from code)
// Sort the recipes array
recipes.sort((a, b) => b.rating - a.rating);
```

### Function Documentation

```typescript
/**
 * Generates recipe embeddings for semantic search.
 *
 * @param recipeText - Combined recipe name, description, and ingredients
 * @returns 384-dimensional embedding vector
 * @throws {Error} If Hugging Face API fails after retries
 */
async function generateEmbedding(recipeText: string): Promise<number[]> {
  // Implementation
}
```

## Error Handling

### User-Facing Errors

```typescript
try {
  await createRecipe(recipe);
  toast.success('Recipe created successfully!');
} catch (error) {
  toast.error('Failed to create recipe. Please try again.');
  console.error('Recipe creation error:', error);
}
```

### API Errors

```typescript
export async function createRecipe(recipe: NewRecipe) {
  try {
    // Attempt operation
    const result = await db.insert(recipes).values(recipe);
    return { success: true, data: result };
  } catch (error) {
    console.error('Database error:', error);
    return {
      success: false,
      error: 'Failed to create recipe',
      code: 'DB_ERROR'
    };
  }
}
```

## Git Workflow

### Commit Messages

```bash
# Format: <type>(<scope>): <subject>

feat(recipes): add semantic search capability
fix(auth): resolve session persistence issue
docs(readme): update installation instructions
refactor(db): optimize recipe query performance
test(api): add integration tests for recipe endpoints
```

### Branch Naming

```bash
feature/semantic-search
fix/auth-session-bug
docs/api-documentation
refactor/database-optimization
```

## File Size Limits

- **Components**: Max 300 lines
- **Utilities**: Max 200 lines
- **Actions**: Max 400 lines
- **Refactor**: Files exceeding limits

## Dependencies

### Adding Dependencies

1. Check bundle size impact
2. Verify maintenance status
3. Review security advisories
4. Use specific versions (not `^` or `~`)

### Allowed Categories

- UI components (shadcn/ui pattern)
- Utilities (lodash, date-fns)
- Database (Drizzle ORM)
- Authentication (Clerk)
- AI APIs (OpenRouter)

## Pull Request Checklist

- [ ] Tests pass locally
- [ ] Code follows style guide
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] Commit messages clear
- [ ] Branch up to date with main
- [ ] No console.log statements
- [ ] Environment variables documented

---

**Last Updated:** October 2025
**Version:** 1.0.0
