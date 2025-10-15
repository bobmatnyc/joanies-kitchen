# Recipe Manager - Development Workflows

## Setup Workflow
```bash
# 1. Clone and install
pnpm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with DATABASE_URL, OPENROUTER_API_KEY, Clerk keys

# 3. Initialize database
pnpm db:push

# 4. (Optional) Seed system recipes
pnpm db:seed:system

# 5. Start development server
pnpm dev
# Opens at http://localhost:3004
```

## Database Workflow
```bash
# Schema changes workflow
1. Edit src/lib/db/schema.ts
2. pnpm db:generate    # Generate migration
3. Review drizzle/*.sql files
4. pnpm db:migrate     # Apply migration
# OR for development:
pnpm db:push          # Push schema directly (no migration)

# Database management
pnpm db:studio        # Open Drizzle Studio at http://localhost:4983
```

## Authentication Workflow
```bash
# Validate setup
pnpm auth:validate

# Test environment switching
1. Visit http://localhost:3004
2. Sign in with dev credentials
3. Visit http://localhost:3004?env=prod
4. Sign in with production credentials
5. Toggle environment in UI (dev mode only)
```

## Feature Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/your-feature

# 2. Develop with hot reload
pnpm dev

# 3. Test changes
# (Quality commands to be implemented)

# 4. Build and verify
pnpm build

# 5. Commit and push
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

## Common Tasks

### Adding a New Recipe Field
1. Update `src/lib/db/schema.ts`
2. Run `pnpm db:push`
3. Update TypeScript types (auto-inferred)
4. Update Zod schemas (auto-generated)
5. Update UI components

### Adding a New AI Feature
1. Add function to `src/lib/ai/recipe-generator.ts`
2. Create server action in `src/app/actions/ai-recipes.ts`
3. Add UI component in `src/components/recipe/`
4. Test with various AI models via OpenRouter

### Adding a New shadcn/ui Component
```bash
# Install component
npx shadcn@latest add [component-name]
# Component added to src/components/ui/
```

## Port Configuration
- **Dev Server**: 3004 (configured in package.json: `next dev -p 3004`)
- **Drizzle Studio**: 4983 (default)
- **Production**: 3000 (default Next.js port for `pnpm start`)

## Environment Files
- `.env.local` - Local development (gitignored)
- `.env.example` - Template for required variables
- `.env.local.example` - Detailed template with explanations
- `.env.production.example` - Production environment template
