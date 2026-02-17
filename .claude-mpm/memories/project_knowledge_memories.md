# Project Knowledge - Joanie's Kitchen

**Last Updated**: 2025-11-20
**Project**: joanies-kitchen
**Version**: 0.7.9

---

## Project Identity

**Name**: Joanie's Kitchen
**Tagline**: From Garden to Table — with Heart and Soil
**Type**: AI-Powered Recipe Management & Meal Planning Platform
**Tech Stack**: Next.js 15, TypeScript, PostgreSQL (Neon), Clerk Auth
**Package Manager**: pnpm (NEVER npm or yarn)
**Development Port**: 3002 (primary), 3005 (PM2 secondary)

---

## Critical Project Facts

### Beta Launch
- **Date**: December 1, 2025
- **Status**: Pre-beta, active development
- **Current Version**: 0.7.9
- **Focus**: Stability, performance, core features

### Database Architecture
- **Provider**: Neon PostgreSQL (serverless)
- **Extensions**: pgvector for semantic search
- **ORM**: Drizzle ORM
- **Multi-schema**: schema.ts, ingredients-schema.ts, chef-schema.ts, user-discovery-schema.ts
- **Vector Dimensions**: 384 (sentence-transformers/all-MiniLM-L6-v2)

### Authentication
- **Provider**: Clerk
- **Dual Environment**: Development keys (_DEV suffix), Production keys (_PROD suffix)
- **Auto-selection**: Based on NODE_ENV via src/config/auth.config.ts
- **Admin Access**: Public metadata `{ isAdmin: "true" }`

### Image Storage
- **Primary**: Vercel Blob Storage
- **Legacy**: 19 external images remaining (migration TODO)
- **Token**: BLOB_READ_WRITE_TOKEN
- **Pattern**: *.public.blob.vercel-storage.com

### AI Integration
- **Recipe Generation**: OpenRouter API (Claude, GPT, Gemini)
- **Embeddings**: Hugging Face (sentence-transformers)
- **Local LLM**: Ollama (optional)
- **Image Generation**: Stable Diffusion XL (local, Python)

---

## Project Structure Patterns

### Server Components Default
- Use Server Components by default
- Only add `"use client"` when absolutely necessary
- Client needed for: hooks, event handlers, browser APIs

### Server Actions Pattern
```typescript
// Location: src/app/actions/[domain].ts
'use server';

// Always include:
// 1. Import validation (Zod)
// 2. Authentication check
// 3. Authorization check
// 4. Database mutation
// 5. Cache revalidation
// 6. Return result
```

### File Organization
- Components: `src/components/[domain]/[ComponentName].tsx`
- Server Actions: `src/app/actions/[domain].ts`
- Database: `src/lib/db/[domain]-schema.ts`
- Utilities: `src/lib/utils/[function].ts`
- Validation: `src/lib/validations/[domain]-schema.ts`

---

## Development Server Management

### Known Issues
- **Turbopack**: Can cause ENOENT errors (race conditions)
- **Solution**: Use `make dev-stable` (webpack mode) when encountering issues
- **Port Conflicts**: Run `make dev-stop` before `make dev`

### PM2 Configuration
- **Development**: ecosystem.config.js (port 3002)
- **Secondary**: ecosystem-3005.config.js (port 3005)
- **Production**: ecosystem.config.js (recipe-prod)

---

## Active Features

### Core Features (Launched)
- Recipe CRUD operations
- Semantic search (pgvector)
- Meal planning (drag-and-drop)
- Shopping lists
- Chef profiles
- Recipe collections
- User authentication (Clerk)

### Features in Development
- **Tools Feature**: Kitchen tools catalog and tracking
- **Inventory Management**: Fridge feature for tracking ingredients
- **System Recipe Ingestion**: Admin bulk import tool

### Recent Work (v0.7.9)
- Spice category fix (oz → spice)
- Test script organization
- Performance optimizations
- Beta launch date integration

---

## Common Commands

### Development
```bash
make dev              # Start on port 3002 (Turbopack)
make dev-stable       # Start with webpack (more stable)
make dev-stop         # Stop all servers on port 3002
make dev-clean        # Clean cache and restart
```

### Quality
```bash
make lint-fix         # Fix linting + formatting
make quality          # Run all checks (lint, typecheck, test)
```

### Database
```bash
make db-push          # Push schema (development)
pnpm db:generate      # Generate migrations (production)
pnpm db:migrate       # Apply migrations (production)
make db-studio        # Open Drizzle Studio GUI
```

### Testing
```bash
make test             # Unit tests (Vitest)
make test-e2e         # E2E tests (Playwright)
pnpm test:e2e:ui      # Playwright UI mode
```

---

## Project Conventions

### Naming Conventions
- **Components**: PascalCase (RecipeCard.tsx)
- **Utilities**: kebab-case (parse-ingredients.ts)
- **Server Actions**: kebab-case (create-recipe.ts)
- **Pages**: page.tsx, layout.tsx (Next.js convention)

### Import Order (Biome enforced)
1. External dependencies (react, zod)
2. Absolute imports (@/components, @/lib)
3. Relative imports (./RecipeCard)
4. Types (import type { ... })

### Code Style
- **Line Width**: 100 characters
- **Indentation**: 2 spaces
- **Quotes**: Single for JS, double for JSX
- **Semicolons**: Always
- **TypeScript**: Strict mode, no `any`

---

## Security Rules

### NEVER Commit
- `.env.local` (contains secrets)
- API keys, tokens, credentials
- Clerk secret keys
- Database URLs with credentials

### ALWAYS Validate
- User input with Zod schemas
- Authentication before mutations
- Authorization (user owns resource)
- File uploads (type, size)

### Data Protection
- Use Drizzle ORM (prevents SQL injection)
- Server-side validation only (never trust client)
- Error messages hide internal details
- Admin checks in middleware and actions

---

## Performance Targets

### Web Vitals
- **LCP** (Largest Contentful Paint): < 2s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### Database
- **Query Time**: < 100ms average
- **Connection**: Pooled via Neon
- **Indexes**: HNSW for vector search

### Build
- **Bundle Analysis**: `ANALYZE=true pnpm build`
- **Code Splitting**: Dynamic imports for heavy components
- **Image Optimization**: WebP/AVIF, responsive sizes

---

## Dependencies Management

### Critical Dependencies
- Next.js: 15.5.3 (App Router)
- React: 19.1.0
- TypeScript: 5.x (strict)
- Clerk: 6.33.7
- Drizzle ORM: 0.44.5

### Package Manager
- **Use**: pnpm (ALWAYS)
- **Never**: npm or yarn
- **Reason**: Faster, disk-efficient, strict resolution

---

## Documentation Locations

### AI Agent Instructions
- **CLAUDE.md**: Prioritized instructions for AI agents
- **DEVELOPER.md**: Technical architecture and patterns
- **CODE_STRUCTURE.md**: File organization guide
- **QUICK_START.md**: 5-minute setup guide

### Feature Documentation
- **docs/features/**: Feature specifications
- **docs/guides/**: How-to guides
- **docs/api/**: API documentation
- **docs/troubleshooting/**: Common issues

### Current Documentation
- Over 200 markdown files in docs/
- Organized by category (guides, features, api, etc.)
- Recently reorganized (2025-10-20)

---

## Deployment Architecture

### Platform
- **Vercel**: Primary deployment platform
- **Database**: Neon PostgreSQL (serverless)
- **Storage**: Vercel Blob
- **Auth**: Clerk (managed)

### Environment Variables
- Development: .env.local (gitignored)
- Production: Set in Vercel dashboard
- Dual keys: _DEV and _PROD suffixes for Clerk

### Build Process
1. `pnpm build` (pre-build runs version bump)
2. TypeScript compilation
3. Next.js optimization
4. Deployment to Vercel edge network

---

## Team Workflow

### Git Workflow
- Feature branches: `feature/my-feature`
- Commit format: Conventional Commits (feat:, fix:, docs:, etc.)
- Quality checks before commit: `make quality`
- PR to main for deployment

### Code Review
- TypeScript strict mode enforcement
- Biome linting and formatting
- Test coverage requirements
- Documentation updates

---

## Project History

### Version 0.7.9 (Current)
- Spice categorization fixes
- Test organization improvements
- Performance optimizations
- Beta launch date integration

### Recent Major Changes
- Documentation reorganization (2025-10-20)
- Tools feature development
- Inventory/fridge feature implementation
- System recipe ingestion admin tool

---

## Future Roadmap

### Beta Launch (Dec 1, 2025)
- Complete inventory feature
- Performance optimization
- System recipe ingestion
- Final testing and bug fixes

### Post-Launch
- Recipe versioning
- Collaborative meal planning
- Mobile app (native or PWA)
- Advanced filtering
- Social features expansion

---

## Key Insights for Agents

### When Working on This Project

1. **Always check CLAUDE.md first** - Contains critical rules and constraints
2. **Use pnpm, not npm** - Package manager is pnpm exclusively
3. **Server Components by default** - Only use client when necessary
4. **Database is multi-schema** - Don't forget all schemas in drizzle.config.ts
5. **Beta launch is Dec 1** - Prioritize stability and core features
6. **Port 3002 is standard** - Development server runs on 3002
7. **Vercel Blob for images** - All new images go to Vercel Blob
8. **Dual Clerk keys** - Development and production keys are separate

### Common Pitfalls to Avoid

1. ❌ Using npm/yarn instead of pnpm
2. ❌ Committing .env.local or secrets
3. ❌ Using `any` type in TypeScript
4. ❌ Storing images in public/ folder (user uploads go to Vercel Blob)
5. ❌ Forgetting to revalidate cache after mutations
6. ❌ Skipping authentication/authorization checks
7. ❌ Modifying schema without migrations
8. ❌ Exposing internal errors to users

---

**This knowledge base should be updated as the project evolves.**
